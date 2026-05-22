from django.urls import path

from . import views, webauthn_views

urlpatterns = [
    path('', views.expense_list, name='expense_list'),
    path('add/', views.add_expense, name='add_expense'),
    path('login/', views.login_view, name='login'),
    path('logout/', views.logout_view, name='logout'),
    path('analytics/', views.analytics, name='analytics'),

    # Fingerprint / WebAuthn endpoints.
    path('webauthn/register/begin/', webauthn_views.register_begin, name='webauthn_register_begin'),
    path('webauthn/register/finish/', webauthn_views.register_finish, name='webauthn_register_finish'),
    path('webauthn/login/begin/', webauthn_views.login_begin, name='webauthn_login_begin'),
    path('webauthn/login/finish/', webauthn_views.login_finish, name='webauthn_login_finish'),
    path('webauthn/manage/', webauthn_views.manage, name='webauthn_manage'),
    path('webauthn/delete/<int:pk>/', webauthn_views.delete_credential, name='webauthn_delete'),
]
