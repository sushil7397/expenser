"""WebAuthn (fingerprint / Touch ID / Windows Hello) endpoints.

Flow:
  Registration (signed-in user adds a device):
    POST /webauthn/register/begin/   -> options JSON, server stores challenge in session
    POST /webauthn/register/finish/  -> client returns attestation, server verifies + saves

  Authentication (passwordless login):
    POST /webauthn/login/begin/      -> client sends username, server returns options
    POST /webauthn/login/finish/     -> client returns assertion, server verifies + login()
"""
import json

from django.conf import settings
from django.contrib.auth import login
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.http import HttpResponse, HttpResponseBadRequest, JsonResponse
from django.shortcuts import redirect, render
from django.utils import timezone
from django.views.decorators.http import require_POST

import webauthn
from webauthn.helpers import base64url_to_bytes, bytes_to_base64url
from webauthn.helpers.structs import (
    AuthenticatorSelectionCriteria,
    PublicKeyCredentialDescriptor,
    ResidentKeyRequirement,
    UserVerificationRequirement,
)

from .models import WebAuthnCredential


# --- helpers ----------------------------------------------------------------

REG_CHALLENGE_KEY = "webauthn_reg_challenge"
AUTH_CHALLENGE_KEY = "webauthn_auth_challenge"
AUTH_USER_PK_KEY = "webauthn_auth_user_pk"


def _user_handle(user: User) -> bytes:
    # WebAuthn's `user.id` must be opaque, stable, and not the username.
    # Django's auto PK is fine as long as we encode it consistently.
    return str(user.pk).encode("utf-8")


# --- registration -----------------------------------------------------------

@login_required
@require_POST
def register_begin(request):
    user = request.user
    existing_ids = [
        PublicKeyCredentialDescriptor(id=base64url_to_bytes(c.credential_id))
        for c in user.webauthn_credentials.all()
    ]
    options = webauthn.generate_registration_options(
        rp_id=settings.WEBAUTHN_RP_ID,
        rp_name=settings.WEBAUTHN_RP_NAME,
        user_id=_user_handle(user),
        user_name=user.username,
        user_display_name=user.get_full_name() or user.username,
        exclude_credentials=existing_ids,
        authenticator_selection=AuthenticatorSelectionCriteria(
            # "platform" = built-in fingerprint/face. Use "cross-platform" to also
            # allow USB security keys.
            authenticator_attachment=None,
            resident_key=ResidentKeyRequirement.PREFERRED,
            user_verification=UserVerificationRequirement.REQUIRED,
        ),
    )
    # Stash the challenge in session so the finish step can verify it. Sessions
    # live in the encrypted DB so this is itself protected at rest.
    request.session[REG_CHALLENGE_KEY] = bytes_to_base64url(options.challenge)
    return HttpResponse(webauthn.options_to_json(options), content_type="application/json")


@login_required
@require_POST
def register_finish(request):
    challenge_b64 = request.session.pop(REG_CHALLENGE_KEY, None)
    if not challenge_b64:
        return HttpResponseBadRequest("no registration in progress")

    try:
        body = json.loads(request.body)
    except json.JSONDecodeError:
        return HttpResponseBadRequest("invalid JSON")

    label = (body.pop("label", None) or "Fingerprint").strip()[:120]

    try:
        verification = webauthn.verify_registration_response(
            credential=body,
            expected_challenge=base64url_to_bytes(challenge_b64),
            expected_rp_id=settings.WEBAUTHN_RP_ID,
            expected_origin=settings.WEBAUTHN_ORIGINS,
            require_user_verification=True,
        )
    except Exception as exc:
        return JsonResponse({"ok": False, "error": str(exc)}, status=400)

    WebAuthnCredential.objects.create(
        user=request.user,
        credential_id=bytes_to_base64url(verification.credential_id),
        public_key=bytes_to_base64url(verification.credential_public_key),
        sign_count=verification.sign_count,
        label=label,
    )
    return JsonResponse({"ok": True, "label": label})


# --- authentication ---------------------------------------------------------

@require_POST
def login_begin(request):
    try:
        body = json.loads(request.body)
    except json.JSONDecodeError:
        return HttpResponseBadRequest("invalid JSON")

    username = (body.get("username") or "").strip()
    if not username:
        return HttpResponseBadRequest("username required")

    try:
        user = User.objects.get(username=username, is_active=True)
    except User.DoesNotExist:
        # Don't leak which usernames exist. Issue a challenge that no credential
        # can satisfy so the client gets a uniform-looking failure.
        options = webauthn.generate_authentication_options(
            rp_id=settings.WEBAUTHN_RP_ID,
            allow_credentials=[],
            user_verification=UserVerificationRequirement.REQUIRED,
        )
        request.session[AUTH_CHALLENGE_KEY] = bytes_to_base64url(options.challenge)
        request.session[AUTH_USER_PK_KEY] = None
        return HttpResponse(webauthn.options_to_json(options), content_type="application/json")

    creds = list(user.webauthn_credentials.all())
    if not creds:
        return JsonResponse(
            {"ok": False, "error": "No fingerprint registered for this account. "
                                   "Sign in with password first, then register one."},
            status=400,
        )

    options = webauthn.generate_authentication_options(
        rp_id=settings.WEBAUTHN_RP_ID,
        allow_credentials=[
            PublicKeyCredentialDescriptor(id=base64url_to_bytes(c.credential_id))
            for c in creds
        ],
        user_verification=UserVerificationRequirement.REQUIRED,
    )
    request.session[AUTH_CHALLENGE_KEY] = bytes_to_base64url(options.challenge)
    request.session[AUTH_USER_PK_KEY] = user.pk
    return HttpResponse(webauthn.options_to_json(options), content_type="application/json")


@require_POST
def login_finish(request):
    challenge_b64 = request.session.pop(AUTH_CHALLENGE_KEY, None)
    user_pk = request.session.pop(AUTH_USER_PK_KEY, None)
    if not challenge_b64 or not user_pk:
        return JsonResponse({"ok": False, "error": "no login in progress"}, status=400)

    try:
        body = json.loads(request.body)
    except json.JSONDecodeError:
        return HttpResponseBadRequest("invalid JSON")

    credential_id_b64 = body.get("id")
    if not credential_id_b64:
        return JsonResponse({"ok": False, "error": "missing credential id"}, status=400)

    try:
        cred = WebAuthnCredential.objects.get(credential_id=credential_id_b64, user_id=user_pk)
    except WebAuthnCredential.DoesNotExist:
        return JsonResponse({"ok": False, "error": "unknown credential"}, status=400)

    try:
        verification = webauthn.verify_authentication_response(
            credential=body,
            expected_challenge=base64url_to_bytes(challenge_b64),
            expected_rp_id=settings.WEBAUTHN_RP_ID,
            expected_origin=settings.WEBAUTHN_ORIGINS,
            credential_public_key=base64url_to_bytes(cred.public_key),
            credential_current_sign_count=cred.sign_count,
            require_user_verification=True,
        )
    except Exception as exc:
        return JsonResponse({"ok": False, "error": str(exc)}, status=400)

    # Bump the sign counter — protects against cloned authenticators.
    cred.sign_count = verification.new_sign_count
    cred.last_used_at = timezone.now()
    cred.save(update_fields=["sign_count", "last_used_at"])

    # Mark the session as fully authenticated.
    user = cred.user
    user.backend = "django.contrib.auth.backends.ModelBackend"
    login(request, user)
    return JsonResponse({"ok": True, "redirect": str(settings.LOGIN_REDIRECT_URL)})


# --- management UI ----------------------------------------------------------

@login_required
def manage(request):
    creds = request.user.webauthn_credentials.order_by("-created_at")
    return render(request, "webauthn_manage.html", {"credentials": creds})


@login_required
@require_POST
def delete_credential(request, pk):
    request.user.webauthn_credentials.filter(pk=pk).delete()
    return redirect("webauthn_manage")
