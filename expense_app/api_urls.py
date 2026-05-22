from django.urls import path
from rest_framework.routers import SimpleRouter

from . import api

router = SimpleRouter()
router.register(r"expenses", api.ExpenseViewSet, basename="expense")

urlpatterns = [
    path("auth/login/", api.login_password, name="api_login"),
    path("auth/logout/", api.logout, name="api_logout"),
    path("auth/me/", api.me, name="api_me"),
    path("analytics/", api.analytics, name="api_analytics"),

    path("webauthn/register/begin/", api.webauthn_register_begin),
    path("webauthn/register/finish/", api.webauthn_register_finish),
    path("webauthn/login/begin/", api.webauthn_login_begin),
    path("webauthn/login/finish/", api.webauthn_login_finish),
    path("webauthn/credentials/", api.webauthn_credentials_list),
    path("webauthn/credentials/<int:pk>/", api.webauthn_credential_delete),
] + router.urls
