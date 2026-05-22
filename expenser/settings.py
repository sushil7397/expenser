"""Django settings for expenser.

Secrets are loaded from a .env file in BASE_DIR. See .env.example.
"""
import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

# Loads SQLCIPHER_KEY, FIELD_ENC_KEY_SEED, DJANGO_SECRET_KEY, etc.
load_dotenv(BASE_DIR / ".env")


def _env(name, default=None, required=False):
    val = os.environ.get(name, default)
    if required and not val:
        raise RuntimeError(f"Required env var {name} is not set")
    return val


SECRET_KEY = _env(
    "DJANGO_SECRET_KEY",
    # Fallback only useful in dev. Production must set its own.
    default="django-insecure-pfz$l&keg8+torfcyn86o_j7cqkonf*ux@iid(n82fv7d8*wc7",
)

DEBUG = _env("DJANGO_DEBUG", "False").lower() in ("1", "true", "yes")

ALLOWED_HOSTS = [
    h.strip()
    for h in _env("DJANGO_ALLOWED_HOSTS", "134.119.214.215,localhost,127.0.0.1").split(",")
    if h.strip()
]

LOGIN_URL = "login"
LOGIN_REDIRECT_URL = "expense_list"

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework.authtoken",
    "corsheaders",
    "expense_app",
]

MIDDLEWARE = [
    # CORS must come before CommonMiddleware so it can set headers on every response.
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "expenser.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": ["templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "expenser.wsgi.application"

DATABASES = {
    "default": {
        "ENGINE": "expenser.sqlcipher_backend",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "Asia/Kolkata"
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATICFILES_DIRS = [os.path.join(BASE_DIR, "static")]

MEDIA_URL = "/media/"
MEDIA_ROOT = os.path.join(BASE_DIR, "media")

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# --- Security hardening ------------------------------------------------------
# Cookies only travel over HTTPS in production. Disabled in dev so login still
# works over the plain HTTP runserver.
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"

# When you put this behind HTTPS (nginx / Cloudflare), set this to True. Until
# then HSTS would lock browsers out of the http:// site.
SECURE_SSL_REDIRECT = False
SECURE_HSTS_SECONDS = 0

X_FRAME_OPTIONS = "DENY"
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "same-origin"

# Auto-logout after 30 minutes of inactivity (payment app — keep tight).
SESSION_COOKIE_AGE = 30 * 60
SESSION_SAVE_EVERY_REQUEST = True

# --- REST framework ---------------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.TokenAuthentication",
        # Session auth kept so the legacy server-rendered pages still work.
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
}

# --- CORS -------------------------------------------------------------------
# Comma-separated origins allowed to call the API. In dev we keep it loose;
# in production set DJANGO_CORS_ORIGINS to your Pages URL only.
CORS_ALLOWED_ORIGINS = [
    o.strip() for o in _env(
        "DJANGO_CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,https://sushil7397.github.io",
    ).split(",") if o.strip()
]
# We use Authorization header tokens, not cookies, so credentials=false is fine.
CORS_ALLOW_CREDENTIALS = False

# --- WebAuthn (fingerprint) --------------------------------------------------
# Effective domain the browser binds biometric credentials to. MUST match the
# hostname users actually visit (no port, no scheme). When you switch to a
# real domain, change this.
WEBAUTHN_RP_ID = _env("WEBAUTHN_RP_ID", "localhost")
WEBAUTHN_RP_NAME = "Expenser"
# Full origin(s) the browser sends. Must include the React app's URL exactly
# as the browser sees it. In prod, set this to "https://sushil7397.github.io".
WEBAUTHN_ORIGINS = [
    o.strip() for o in _env(
        "WEBAUTHN_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,https://sushil7397.github.io",
    ).split(",") if o.strip()
]
