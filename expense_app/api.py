"""JSON API consumed by the React frontend.

Auth: DRF Token (Authorization: Token <key>). Tokens are issued on
password login or successful WebAuthn assertion.

CORS-friendly: nothing here relies on session cookies, so the React app
on github.io can talk to this API on a different domain.
"""
from collections import defaultdict
from datetime import datetime, time, timedelta
from decimal import Decimal
import json
import secrets

from django.conf import settings
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, serializers, status, viewsets
from rest_framework.authentication import TokenAuthentication
from rest_framework.authtoken.models import Token
from rest_framework.decorators import action, api_view, authentication_classes, permission_classes
from rest_framework.response import Response

import webauthn
from webauthn.helpers import base64url_to_bytes, bytes_to_base64url
from webauthn.helpers.structs import (
    AuthenticatorSelectionCriteria,
    PublicKeyCredentialDescriptor,
    ResidentKeyRequirement,
    UserVerificationRequirement,
)

from .models import Expense, UserProfile, WebAuthnChallenge, WebAuthnCredential


CHALLENGE_TTL = timedelta(minutes=5)


# --- serializers ------------------------------------------------------------

class ExpenseSerializer(serializers.ModelSerializer):
    # Declared explicitly because EncryptedDecimalField inherits from CharField,
    # so ModelSerializer would otherwise try to build a CharField with
    # max_digits=10 — which CharField rejects.
    expense_amount = serializers.DecimalField(max_digits=10, decimal_places=2)
    expense_place = serializers.CharField(max_length=255)

    class Meta:
        model = Expense
        fields = ["id", "date", "expense_place", "expense_amount", "transaction_type"]
        read_only_fields = ["id", "date"]


class ProfileSerializer(serializers.Serializer):
    username = serializers.CharField()
    balance = serializers.DecimalField(max_digits=12, decimal_places=2)


class WebAuthnCredentialSerializer(serializers.ModelSerializer):
    class Meta:
        model = WebAuthnCredential
        fields = ["id", "label", "created_at", "last_used_at"]


# --- auth -------------------------------------------------------------------

@api_view(["POST"])
@authentication_classes([])
@permission_classes([permissions.AllowAny])
def login_password(request):
    username = (request.data.get("username") or "").strip()
    password = request.data.get("password") or ""
    user = authenticate(username=username, password=password)
    if not user or not user.is_active:
        return Response({"detail": "Invalid credentials."}, status=status.HTTP_401_UNAUTHORIZED)

    UserProfile.objects.get_or_create(user=user)
    token, _ = Token.objects.get_or_create(user=user)
    return Response({
        "token": token.key,
        "user": {"id": user.id, "username": user.username},
    })


@api_view(["POST"])
def logout(request):
    Token.objects.filter(user=request.user).delete()
    return Response({"ok": True})


@api_view(["GET"])
def me(request):
    profile, _ = UserProfile.objects.get_or_create(user=request.user)
    return Response({
        "username": request.user.username,
        "balance": str(Decimal(str(profile.balance))),
    })


# --- expenses ---------------------------------------------------------------

class ExpenseViewSet(viewsets.ModelViewSet):
    serializer_class = ExpenseSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = Expense.objects.filter(user=self.request.user)

        start = self.request.query_params.get("start_date")
        end = self.request.query_params.get("end_date")

        if start:
            try:
                qs = qs.filter(date__gte=datetime.combine(
                    datetime.strptime(start, "%Y-%m-%d").date(), time.min))
            except ValueError:
                pass
        if end:
            try:
                qs = qs.filter(date__lte=datetime.combine(
                    datetime.strptime(end, "%Y-%m-%d").date(), time.max))
            except ValueError:
                pass

        if not start and not end:
            today = datetime.today()
            qs = qs.filter(date__gte=today.replace(
                day=1, hour=0, minute=0, second=0, microsecond=0))

        return qs.order_by("-date")

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


@api_view(["GET"])
def analytics(request):
    qs = Expense.objects.filter(user=request.user)

    start = request.query_params.get("start_date")
    end = request.query_params.get("end_date")
    if start:
        try:
            qs = qs.filter(date__gte=datetime.combine(
                datetime.strptime(start, "%Y-%m-%d").date(), time.min))
        except ValueError:
            pass
    if end:
        try:
            qs = qs.filter(date__lte=datetime.combine(
                datetime.strptime(end, "%Y-%m-%d").date(), time.max))
        except ValueError:
            pass
    if not start and not end:
        today = datetime.today()
        qs = qs.filter(date__gte=today.replace(day=1) - timedelta(days=180))

    monthly = defaultdict(lambda: {"debit": Decimal("0.00"), "credit": Decimal("0.00")})
    for exp in qs:
        key = timezone.localtime(exp.date).strftime("%Y-%m")
        monthly[key][exp.transaction_type] += exp.expense_amount

    keys = sorted(monthly)
    return Response({
        "labels": [datetime.strptime(k, "%Y-%m").strftime("%B %Y") for k in keys],
        "debit": [float(monthly[k]["debit"]) for k in keys],
        "credit": [float(monthly[k]["credit"]) for k in keys],
        "net": [float(monthly[k]["credit"] - monthly[k]["debit"]) for k in keys],
    })


# --- WebAuthn ---------------------------------------------------------------

def _make_challenge(challenge_bytes: bytes, kind: str, user: User | None) -> dict:
    token = secrets.token_urlsafe(32)
    WebAuthnChallenge.objects.create(
        token=token,
        challenge=bytes_to_base64url(challenge_bytes),
        kind=kind,
        user=user,
        expires_at=timezone.now() + CHALLENGE_TTL,
    )
    # Best-effort cleanup of stale rows so the table doesn't grow forever.
    WebAuthnChallenge.objects.filter(
        expires_at__lt=timezone.now() - timedelta(hours=1)).delete()
    return token


def _consume_challenge(token: str, kind: str) -> WebAuthnChallenge:
    qs = WebAuthnChallenge.objects.filter(
        token=token, kind=kind, consumed=False, expires_at__gte=timezone.now())
    ch = qs.first()
    if not ch:
        raise serializers.ValidationError("Challenge expired or already used. Try again.")
    ch.consumed = True
    ch.save(update_fields=["consumed"])
    return ch


@api_view(["POST"])
def webauthn_register_begin(request):
    user = request.user
    existing = [
        PublicKeyCredentialDescriptor(id=base64url_to_bytes(c.credential_id))
        for c in user.webauthn_credentials.all()
    ]
    opts = webauthn.generate_registration_options(
        rp_id=settings.WEBAUTHN_RP_ID,
        rp_name=settings.WEBAUTHN_RP_NAME,
        user_id=str(user.pk).encode("utf-8"),
        user_name=user.username,
        user_display_name=user.get_full_name() or user.username,
        exclude_credentials=existing,
        authenticator_selection=AuthenticatorSelectionCriteria(
            resident_key=ResidentKeyRequirement.PREFERRED,
            user_verification=UserVerificationRequirement.REQUIRED,
        ),
    )
    token = _make_challenge(opts.challenge, WebAuthnChallenge.KIND_REGISTER, user)
    return Response({
        "challenge_token": token,
        "options": json.loads(webauthn.options_to_json(opts)),
    })


@api_view(["POST"])
def webauthn_register_finish(request):
    token = request.data.get("challenge_token") or ""
    ch = _consume_challenge(token, WebAuthnChallenge.KIND_REGISTER)
    if ch.user_id != request.user.id:
        return Response({"detail": "challenge user mismatch"}, status=400)

    credential = request.data.get("credential")
    label = (request.data.get("label") or "Fingerprint").strip()[:120]
    if not credential:
        return Response({"detail": "missing credential"}, status=400)

    try:
        v = webauthn.verify_registration_response(
            credential=credential,
            expected_challenge=base64url_to_bytes(ch.challenge),
            expected_rp_id=settings.WEBAUTHN_RP_ID,
            expected_origin=settings.WEBAUTHN_ORIGINS,
            require_user_verification=True,
        )
    except Exception as exc:
        return Response({"detail": f"verification failed: {exc}"}, status=400)

    cred = WebAuthnCredential.objects.create(
        user=request.user,
        credential_id=bytes_to_base64url(v.credential_id),
        public_key=bytes_to_base64url(v.credential_public_key),
        sign_count=v.sign_count,
        label=label,
    )
    return Response(WebAuthnCredentialSerializer(cred).data)


@api_view(["POST"])
@authentication_classes([])
@permission_classes([permissions.AllowAny])
def webauthn_login_begin(request):
    username = (request.data.get("username") or "").strip()
    if not username:
        return Response({"detail": "username required"}, status=400)

    user = User.objects.filter(username=username, is_active=True).first()
    if not user or not user.webauthn_credentials.exists():
        # Issue a dummy challenge to avoid leaking which usernames exist.
        opts = webauthn.generate_authentication_options(
            rp_id=settings.WEBAUTHN_RP_ID,
            allow_credentials=[],
            user_verification=UserVerificationRequirement.REQUIRED,
        )
        token = _make_challenge(opts.challenge, WebAuthnChallenge.KIND_AUTH, None)
        return Response({
            "challenge_token": token,
            "options": json.loads(webauthn.options_to_json(opts)),
        })

    opts = webauthn.generate_authentication_options(
        rp_id=settings.WEBAUTHN_RP_ID,
        allow_credentials=[
            PublicKeyCredentialDescriptor(id=base64url_to_bytes(c.credential_id))
            for c in user.webauthn_credentials.all()
        ],
        user_verification=UserVerificationRequirement.REQUIRED,
    )
    token = _make_challenge(opts.challenge, WebAuthnChallenge.KIND_AUTH, user)
    return Response({
        "challenge_token": token,
        "options": json.loads(webauthn.options_to_json(opts)),
    })


@api_view(["POST"])
@authentication_classes([])
@permission_classes([permissions.AllowAny])
def webauthn_login_finish(request):
    token = request.data.get("challenge_token") or ""
    ch = _consume_challenge(token, WebAuthnChallenge.KIND_AUTH)
    if not ch.user_id:
        return Response({"detail": "no credential available"}, status=400)

    credential = request.data.get("credential")
    if not credential:
        return Response({"detail": "missing credential"}, status=400)

    cred_id_b64 = credential.get("id")
    cred = WebAuthnCredential.objects.filter(
        credential_id=cred_id_b64, user_id=ch.user_id).first()
    if not cred:
        return Response({"detail": "unknown credential"}, status=400)

    try:
        v = webauthn.verify_authentication_response(
            credential=credential,
            expected_challenge=base64url_to_bytes(ch.challenge),
            expected_rp_id=settings.WEBAUTHN_RP_ID,
            expected_origin=settings.WEBAUTHN_ORIGINS,
            credential_public_key=base64url_to_bytes(cred.public_key),
            credential_current_sign_count=cred.sign_count,
            require_user_verification=True,
        )
    except Exception as exc:
        return Response({"detail": f"verification failed: {exc}"}, status=400)

    cred.sign_count = v.new_sign_count
    cred.last_used_at = timezone.now()
    cred.save(update_fields=["sign_count", "last_used_at"])

    auth_token, _ = Token.objects.get_or_create(user=cred.user)
    return Response({
        "token": auth_token.key,
        "user": {"id": cred.user.id, "username": cred.user.username},
    })


@api_view(["GET"])
def webauthn_credentials_list(request):
    qs = request.user.webauthn_credentials.order_by("-created_at")
    return Response(WebAuthnCredentialSerializer(qs, many=True).data)


@api_view(["DELETE"])
def webauthn_credential_delete(request, pk):
    cred = get_object_or_404(request.user.webauthn_credentials, pk=pk)
    cred.delete()
    return Response(status=204)
