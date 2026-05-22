"""Re-save every Expense and UserProfile row so the encrypted fields write
their Fernet ciphertext to disk for data that pre-dates field-level encryption.
"""
from django.db import migrations


def encrypt_existing(apps, schema_editor):
    # Use the historical models so the migration is self-contained.
    Expense = apps.get_model("expense_app", "Expense")
    UserProfile = apps.get_model("expense_app", "UserProfile")

    # Touch every row. Each save() round-trips through EncryptedDecimal/CharField
    # which encrypts on write. The pre-existing plaintext values still parse
    # because to_python() falls back to plain Decimal/str when Fernet fails.
    for exp in Expense.objects.all().iterator():
        exp.save(update_fields=["expense_place", "expense_amount"])

    for profile in UserProfile.objects.all().iterator():
        profile.save(update_fields=["balance"])


def noop_reverse(apps, schema_editor):
    # No automatic reverse: decrypting back to plaintext columns is destructive
    # and would silently weaken security. To roll back, restore from the
    # plaintext backup (db.sqlite3.old-plaintext) before re-running migrations.
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("expense_app", "0005_alter_expense_expense_amount_and_more"),
    ]

    operations = [migrations.RunPython(encrypt_existing, noop_reverse)]
