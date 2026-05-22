from django.contrib import admin
from .models import Expense, UserProfile
from django.utils.html import format_html

@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'display_balance')
    search_fields = ('user__username',)
    
    def display_balance(self, obj):
        if obj.balance < 0:
            return format_html('<span style="color: red;">?{}</span>', obj.balance)
        return format_html('?{}', obj.balance)
    
    display_balance.short_description = 'Balance'

@admin.register(Expense)
class ExpenseAdmin(admin.ModelAdmin):
    list_display = ('date', 'expense_place', 'user', 'display_amount', 'transaction_type')
    list_filter = ('transaction_type', 'date', 'user')
    search_fields = ('expense_place', 'user__username')
    
    def display_amount(self, obj):
        if obj.transaction_type == 'debit':
            return format_html('<span style="color: red;">- {}</span>', obj.expense_amount)
        return format_html('<span style="color: green;">+ {}</span>', obj.expense_amount)
    
    display_amount.short_description = 'Amount'
    
    def get_queryset(self, request):
        queryset = super().get_queryset(request)
        # If not superuser, only show own expenses
        if not request.user.is_superuser:
            return queryset.filter(user=request.user)
        return queryset
    
    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        # Limit user selection to logged-in user for non-superusers
        if db_field.name == "user" and not request.user.is_superuser:
            kwargs["queryset"] = User.objects.filter(id=request.user.id)
        return super().formfield_for_foreignkey(db_field, request, **kwargs)
    
    def save_model(self, request, obj, form, change):
        # Auto-set user to current user for non-superusers
        if not request.user.is_superuser and not obj.user_id:
            obj.user = request.user
        super().save_model(request, obj, form, change)