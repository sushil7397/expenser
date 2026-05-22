from django import forms
from .models import Expense

class ExpenseForm(forms.ModelForm):
    
    class Meta:
        model = Expense
        fields = ['expense_place', 'expense_amount', 'transaction_type']
        widgets = {
            'expense_place': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Enter location'
            }),
            'expense_amount': forms.NumberInput(attrs={
                'class': 'form-control',
                'placeholder': '0.00',
                'step': '0.01'
            }),
            'transaction_type': forms.Select(attrs={
                'class': 'form-control'
            }),
        }