from django.shortcuts import render, redirect
from django.contrib.auth.decorators import login_required
from .models import Expense, UserProfile
from .forms import ExpenseForm
from django.contrib.auth.forms import AuthenticationForm
from django.contrib.auth import login, logout
from django.contrib import messages

def login_view(request):
    if request.method == 'POST':
        form = AuthenticationForm(data=request.POST)
        if form.is_valid():
            user = form.get_user()
            login(request, user)
            
            # Create user profile if it doesn't exist
            UserProfile.objects.get_or_create(user=user)
            
            next_url = request.GET.get('next', 'expense_list')
            return redirect(next_url)
    else:
        form = AuthenticationForm()
    
    # Add bootstrap classes to form fields
    form.fields['username'].widget.attrs.update({'class': 'form-control'})
    form.fields['password'].widget.attrs.update({'class': 'form-control'})
    
    return render(request, 'login.html', {'form': form})

def logout_view(request):
    logout(request)
    return redirect('login')

from datetime import datetime, time

@login_required
def expense_list(request):
    UserProfile.objects.get_or_create(user=request.user)

    queryset = Expense.objects.filter(user=request.user)

    start_date = request.GET.get('start_date')
    end_date = request.GET.get('end_date')

    # Convert to full datetime range
    if start_date:
        try:
            start_date = datetime.combine(datetime.strptime(start_date, '%Y-%m-%d').date(), time.min)
            queryset = queryset.filter(date__gte=start_date)
        except ValueError:
            pass

    if end_date:
        try:
            end_date = datetime.combine(datetime.strptime(end_date, '%Y-%m-%d').date(), time.max)
            queryset = queryset.filter(date__lte=end_date)
        except ValueError:
            pass

    # Default to current month if no filters
    if not start_date and not end_date:
        today = datetime.today()
        start_of_month = today.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        queryset = queryset.filter(date__gte=start_of_month)

    expenses = queryset.order_by('-date')

    return render(request, 'check_expense.html', {
        'expenses': expenses,
    })
from collections import defaultdict
from decimal import Decimal
from django.utils.timezone import localtime
from datetime import datetime, timedelta, time
def analytics(request):
    UserProfile.objects.get_or_create(user=request.user)

    queryset = Expense.objects.filter(user=request.user)

    start_date = request.GET.get('start_date')
    end_date = request.GET.get('end_date')

    if start_date:
        try:
            start_date = datetime.combine(datetime.strptime(start_date, '%Y-%m-%d').date(), time.min)
            queryset = queryset.filter(date__gte=start_date)
        except ValueError:
            pass

    if end_date:
        try:
            end_date = datetime.combine(datetime.strptime(end_date, '%Y-%m-%d').date(), time.max)
            queryset = queryset.filter(date__lte=end_date)
        except ValueError:
            pass

    # Default to last 6 months if no date filters
    if not start_date and not end_date:
        today = datetime.today()
        six_months_ago = today.replace(day=1) - timedelta(days=180)
        queryset = queryset.filter(date__gte=six_months_ago)

    # Group by month and year
    monthly_data = defaultdict(lambda: {"debit": Decimal("0.00"), "credit": Decimal("0.00")})

    for expense in queryset:
        dt = localtime(expense.date)
        key = dt.strftime('%Y-%m')  # e.g., "2024-03"

        if expense.transaction_type == 'debit':
            monthly_data[key]["debit"] += expense.expense_amount
        else:
            monthly_data[key]["credit"] += expense.expense_amount

    # Prepare sorted data
    sorted_keys = sorted(monthly_data.keys())

    chart_labels = [datetime.strptime(k, "%Y-%m").strftime('%B') for k in sorted_keys]
    debit_data = [float(monthly_data[k]["debit"]) for k in sorted_keys]
    credit_data = [float(monthly_data[k]["credit"]) for k in sorted_keys]
    net_data = [float(monthly_data[k]["credit"] - monthly_data[k]["debit"]) for k in sorted_keys]

    expenses = queryset.order_by('-date')

    return render(request, 'analytics.html', {
        'expenses': expenses,
        'chart_labels': chart_labels,
        'debit_data': debit_data,
        'credit_data': credit_data,
        'net_data': net_data,
    })
    
    
@login_required
def add_expense(request):
    if request.method == 'POST':
        form = ExpenseForm(request.POST)
        if form.is_valid():
            expense = form.save(commit=False)
            expense.user = request.user
            expense.save()
            return redirect('expense_list')
    else:
        form = ExpenseForm()
    
    return render(request, 'add_expense.html', {'form': form})