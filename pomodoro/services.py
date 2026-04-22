from django.db.models import Sum, Count
from django.db.models.functions import TruncDate
from django.utils import timezone
from datetime import timedelta
from .models import Pomodoro


def get_daily_stats(user, days=30):
    since = timezone.now() - timedelta(days=days)
    qs = (
        Pomodoro.objects
        .filter(user=user, ended_at__isnull=False, started_at__gte=since)
        .annotate(day=TruncDate('started_at'))
        .values('day')
        .annotate(
            total_sec=Sum('actual_duration_sec'),
            count=Count('id'),
        )
        .order_by('day')
    )
    return list(qs)


def get_tag_stats(user, from_date=None, to_date=None):
    qs = Pomodoro.objects.filter(user=user, ended_at__isnull=False)
    if from_date:
        qs = qs.filter(started_at__date__gte=from_date)
    if to_date:
        qs = qs.filter(started_at__date__lte=to_date)
    return list(
        qs.values('tag__nazev', 'tag__barva')
        .annotate(total_sec=Sum('actual_duration_sec'), count=Count('id'))
        .order_by('-total_sec')
    )


def get_kpi(user):
    now = timezone.now()
    today = now.date()
    week_start = today - timedelta(days=today.weekday())
    month_start = today.replace(day=1)

    def agg(since):
        r = Pomodoro.objects.filter(
            user=user, ended_at__isnull=False, started_at__date__gte=since
        ).aggregate(total_sec=Sum('actual_duration_sec'), count=Count('id'))
        return r['total_sec'] or 0, r['count'] or 0

    today_sec, today_count = agg(today)
    week_sec, week_count = agg(week_start)
    month_sec, month_count = agg(month_start)

    return {
        'today': {'sec': today_sec, 'count': today_count},
        'week': {'sec': week_sec, 'count': week_count},
        'month': {'sec': month_sec, 'count': month_count},
    }
