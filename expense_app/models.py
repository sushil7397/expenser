from decimal import Decimal

from django.contrib.auth.models import User
from django.db import models

from .encrypted_fields import EncryptedCharField, EncryptedDecimalField


class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    # Balance is encrypted at rest in addition to the file-level SQLCipher layer.
    balance = EncryptedDecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))

    def __str__(self):
        return f"{self.user.username}'s profile"


class Expense(models.Model):
    TRANSACTION_TYPES = (
        ('debit', 'Debit (-)'),
        ('credit', 'Credit (+)'),
    )

    user = models.ForeignKey(User, on_delete=models.CASCADE)
    date = models.DateTimeField(auto_now_add=True)
    expense_place = EncryptedCharField(max_length=512)
    expense_amount = EncryptedDecimalField(max_digits=10, decimal_places=2)
    transaction_type = models.CharField(max_length=6, choices=TRANSACTION_TYPES, default='debit')

    def __str__(self):
        return f"{self.expense_place} - {self.expense_amount}"

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        super().save(*args, **kwargs)

        if is_new:
            profile, _ = UserProfile.objects.get_or_create(user=self.user)
            amount = Decimal(str(self.expense_amount))
            if self.transaction_type == 'debit':
                profile.balance = Decimal(str(profile.balance)) - amount
            else:
                profile.balance = Decimal(str(profile.balance)) + amount
            profile.save()


class WebAuthnChallenge(models.Model):
    """One-time challenge issued by /webauthn/*/begin/, consumed by .../finish/.

    Stateless replacement for storing the challenge in request.session, so the
    API can serve a cross-origin React client that doesn't send session cookies.
    """

    KIND_REGISTER = "register"
    KIND_AUTH = "auth"
    KIND_CHOICES = (
        (KIND_REGISTER, "register"),
        (KIND_AUTH, "auth"),
    )

    token = models.CharField(max_length=64, unique=True, db_index=True)
    challenge = models.TextField()  # base64url
    kind = models.CharField(max_length=10, choices=KIND_CHOICES)
    # For register: the logged-in user. For auth: the user the challenge is for.
    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    consumed = models.BooleanField(default=False)


class WebAuthnCredential(models.Model):
    """A registered fingerprint/biometric credential bound to one user + device."""

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='webauthn_credentials')
    # WebAuthn credential ID, base64url-encoded (returned by the browser).
    credential_id = models.CharField(max_length=512, unique=True)
    # COSE public key bytes, base64url-encoded.
    public_key = models.TextField()
    sign_count = models.PositiveBigIntegerField(default=0)
    # Short human label so users can tell their devices apart.
    label = models.CharField(max_length=120, default='Fingerprint')
    created_at = models.DateTimeField(auto_now_add=True)
    last_used_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.user.username}: {self.label}"
