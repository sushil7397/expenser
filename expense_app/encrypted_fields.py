"""Field-level encryption helpers.

The SQLCipher engine already encrypts the whole DB file. These fields add a
second layer using Fernet (AES-128-CBC + HMAC-SHA256) so that if the database
file is ever decrypted, exported, or copied through application code, the
payment columns themselves are still ciphertext.

Trade-off: encrypted columns are stored as base64 strings, so range filters
(`amount__gt=...`), DB-side aggregates (`Sum`, `Avg`), and ordering by amount
no longer work at the SQL level. Aggregation is done in Python in views.py
where it's needed.
"""
import base64
import hashlib
import os
from decimal import Decimal

from cryptography.fernet import Fernet, InvalidToken
from django import forms
from django.core.validators import DecimalValidator, MaxLengthValidator
from django.core.exceptions import ImproperlyConfigured
from django.db import models


def _fernet() -> Fernet:
    seed = os.environ.get("FIELD_ENC_KEY_SEED")
    if not seed:
        raise ImproperlyConfigured(
            "FIELD_ENC_KEY_SEED env var is not set. Encrypted model fields "
            "cannot read or write data without it."
        )
    # Fernet wants a 32-byte url-safe base64 key. Derive deterministically
    # from the seed so the same .env always produces the same key.
    digest = hashlib.sha256(seed.encode("utf-8")).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


class EncryptedCharField(models.CharField):
    """Stores arbitrary strings as Fernet ciphertext (base64). Treat max_length
    as a guideline only — actual ciphertext is ~100 bytes longer than plaintext.
    """

    description = "Fernet-encrypted CharField"

    def __init__(self, *args, **kwargs):
        # Ciphertext is longer than plaintext; widen the column.
        kwargs.setdefault("max_length", 512)
        super().__init__(*args, **kwargs)

    def from_db_value(self, value, expression, connection):
        return self.to_python(value)

    def to_python(self, value):
        if value is None or value == "":
            return value
        if not isinstance(value, str):
            return value
        try:
            return _fernet().decrypt(value.encode("utf-8")).decode("utf-8")
        except InvalidToken:
            # Plaintext leftover from before encryption was enabled.
            return value

    def get_prep_value(self, value):
        if value is None or value == "":
            return value
        return _fernet().encrypt(str(value).encode("utf-8")).decode("utf-8")


class EncryptedDecimalField(models.CharField):
    """Decimal stored as encrypted text. Inherits from CharField (not
    DecimalField) because the on-disk value is text, not a number.
    """

    description = "Fernet-encrypted DecimalField"

    def __init__(self, *args, max_digits=10, decimal_places=2, **kwargs):
        self.max_digits = max_digits
        self.decimal_places = decimal_places
        kwargs.setdefault("max_length", 256)
        super().__init__(*args, **kwargs)
        self.validators = [
            validator
            for validator in self.validators
            if not isinstance(validator, MaxLengthValidator)
        ]
        self.validators.append(DecimalValidator(self.max_digits, self.decimal_places))

    def deconstruct(self):
        name, path, args, kwargs = super().deconstruct()
        kwargs["max_digits"] = self.max_digits
        kwargs["decimal_places"] = self.decimal_places
        return name, path, args, kwargs

    def from_db_value(self, value, expression, connection):
        return self.to_python(value)

    def to_python(self, value):
        if value is None or value == "":
            return value
        if isinstance(value, Decimal):
            return value
        if isinstance(value, (int, float)):
            return Decimal(str(value))
        try:
            plain = _fernet().decrypt(value.encode("utf-8")).decode("utf-8")
        except InvalidToken:
            # Plaintext leftover from before encryption — parse directly.
            plain = value
        return Decimal(plain)

    def get_prep_value(self, value):
        if value is None or value == "":
            return value
        return _fernet().encrypt(str(Decimal(value)).encode("utf-8")).decode("utf-8")

    def formfield(self, **kwargs):
        # Render the form widget as a decimal input even though the column
        # is varchar under the hood.
        defaults = {
            "max_digits": self.max_digits,
            "decimal_places": self.decimal_places,
            "form_class": forms.DecimalField,
        }
        defaults.update(kwargs)
        allowed_keys = {
            "required",
            "label",
            "initial",
            "help_text",
            "error_messages",
            "show_hidden_initial",
            "validators",
            "localize",
            "disabled",
            "label_suffix",
            "widget",
            "min_value",
            "max_value",
        }
        field_kwargs = {k: v for k, v in defaults.items() if k in allowed_keys}
        return defaults["form_class"](
            max_digits=defaults["max_digits"],
            decimal_places=defaults["decimal_places"],
            **field_kwargs,
        )
