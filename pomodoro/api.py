import json
from datetime import timedelta
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.http import require_http_methods

from .models import Pomodoro, Tag, UserSettings, PushSubscription


# --- Pomodoro ---

@login_required
@require_http_methods(["POST"])
def pomodoro_start(request):
    data = json.loads(request.body)
    duration = int(data.get('planned_duration_sec', 1500))
    tag_id = data.get('tag_id')

    if Pomodoro.objects.filter(user=request.user, ended_at__isnull=True).exists():
        return JsonResponse({'error': 'already_running'}, status=409)

    tag = None
    if tag_id:
        tag = get_object_or_404(Tag, id=tag_id, user=request.user)

    p = Pomodoro.objects.create(
        user=request.user,
        started_at=timezone.now(),
        planned_duration_sec=duration,
        tag=tag,
    )

    ends_at = p.started_at + timedelta(seconds=duration)

    return JsonResponse({
        'id': p.id,
        'started_at': p.started_at.isoformat(),
        'ends_at': ends_at.isoformat(),
        'planned_duration_sec': duration,
        'tag_id': tag.id if tag else None,
    }, status=201)


@login_required
@require_http_methods(["POST"])
def pomodoro_stop(request, pk):
    data = json.loads(request.body)
    p = get_object_or_404(Pomodoro, id=pk, user=request.user, ended_at__isnull=True)

    p.ended_at = timezone.now()
    p.actual_duration_sec = int(data.get('actual_duration_sec', p.planned_duration_sec))
    p.completed_normally = bool(data.get('completed_normally', False))
    p.save()

    return JsonResponse({'ok': True, 'actual_duration_sec': p.actual_duration_sec})


@login_required
@require_http_methods(["GET"])
def pomodoro_active(request):
    try:
        p = Pomodoro.objects.get(user=request.user, ended_at__isnull=True)
        ends_at = p.started_at + timedelta(seconds=p.planned_duration_sec)
        return JsonResponse({
            'id': p.id,
            'started_at': p.started_at.isoformat(),
            'ends_at': ends_at.isoformat(),
            'planned_duration_sec': p.planned_duration_sec,
            'tag_id': p.tag_id,
        })
    except Pomodoro.DoesNotExist:
        return JsonResponse({}, status=204)


@login_required
@require_http_methods(["GET"])
def pomodoro_list(request):
    qs = Pomodoro.objects.filter(user=request.user, ended_at__isnull=False).order_by('-started_at')

    from_date = request.GET.get('from')
    to_date = request.GET.get('to')
    tag_id = request.GET.get('tag')

    if from_date:
        qs = qs.filter(started_at__date__gte=from_date)
    if to_date:
        qs = qs.filter(started_at__date__lte=to_date)
    if tag_id:
        qs = qs.filter(tag_id=tag_id)

    data = [{
        'id': p.id,
        'started_at': p.started_at.isoformat(),
        'ended_at': p.ended_at.isoformat(),
        'planned_duration_sec': p.planned_duration_sec,
        'actual_duration_sec': p.actual_duration_sec,
        'tag_id': p.tag_id,
        'tag_nazev': p.tag.nazev if p.tag else None,
        'completed_normally': p.completed_normally,
    } for p in qs[:200]]

    return JsonResponse({'results': data})


# --- Settings ---

@login_required
@require_http_methods(["GET"])
def settings_get(request):
    s, _ = UserSettings.objects.get_or_create(user=request.user)
    return JsonResponse({
        'work_duration_sec': s.work_duration_sec,
        'short_break_sec': s.short_break_sec,
        'long_break_sec': s.long_break_sec,
        'long_break_every': s.long_break_every,
        'sound_enabled': s.sound_enabled,
    })


@login_required
@require_http_methods(["POST"])
def settings_update(request):
    data = json.loads(request.body)
    s, _ = UserSettings.objects.get_or_create(user=request.user)
    for field in ['work_duration_sec', 'short_break_sec', 'long_break_sec', 'long_break_every']:
        if field in data:
            setattr(s, field, int(data[field]))
    if 'sound_enabled' in data:
        s.sound_enabled = bool(data['sound_enabled'])
    s.save()
    return JsonResponse({'ok': True})


# --- Tagy ---

@login_required
@require_http_methods(["GET"])
def tag_list(request):
    tags = Tag.objects.filter(user=request.user).order_by('nazev')
    return JsonResponse({'tags': [{'id': t.id, 'nazev': t.nazev, 'barva': t.barva} for t in tags]})


# --- Push ---

@login_required
@require_http_methods(["POST"])
def push_subscribe(request):
    data = json.loads(request.body)
    PushSubscription.objects.update_or_create(
        endpoint=data['endpoint'],
        defaults={
            'user': request.user,
            'p256dh': data['p256dh'],
            'auth': data['auth'],
            'device_id': data.get('device_id', ''),
            'device_label': data.get('device_label', '')[:100],
        }
    )
    return JsonResponse({'ok': True})


@login_required
@require_http_methods(["POST"])
def push_heartbeat(request):
    data = json.loads(request.body)
    device_id = data.get('device_id', '')
    PushSubscription.objects.filter(
        user=request.user,
        device_id=device_id,
    ).update(last_heartbeat=timezone.now())
    return JsonResponse({'ok': True})


@login_required
@require_http_methods(["POST"])
def pomodoro_delete(request, pk):
    p = get_object_or_404(Pomodoro, id=pk, user=request.user)
    p.delete()
    return JsonResponse({'ok': True})


# --- Statistiky ---

import csv
from django.http import HttpResponse
from .services import get_daily_stats, get_tag_stats, get_kpi, get_daily_stats_by_tag


@login_required
@require_http_methods(["GET"])
def stats_daily(request):
    days = int(request.GET.get('days', 30))
    data = get_daily_stats(request.user, days=days)
    return JsonResponse({
        'data': [
            {
                'day': str(r['day']),
                'total_sec': r['total_sec'] or 0,
                'count': r['count'],
            }
            for r in data
        ]
    })


@login_required
@require_http_methods(["GET"])
def stats_tags(request):
    from_date = request.GET.get('from')
    to_date = request.GET.get('to')
    data = get_tag_stats(request.user, from_date=from_date, to_date=to_date)
    return JsonResponse({
        'data': [
            {
                'tag': r['tag__nazev'] or 'bez tagu',
                'barva': r['tag__barva'] or '#6c757d',
                'total_sec': r['total_sec'] or 0,
                'count': r['count'],
            }
            for r in data
        ]
    })


@login_required
@require_http_methods(["GET"])
def stats_daily_by_tag(request):
    days = int(request.GET.get('days', 30))
    data = get_daily_stats_by_tag(request.user, days=days)
    return JsonResponse({'data': [
        {
            'day': str(r['day']),
            'tag_id': r['tag__id'],
            'tag': r['tag__nazev'] or 'bez tagu',
            'barva': r['tag__barva'] or '#6c757d',
            'total_sec': r['total_sec'] or 0,
        }
        for r in data
    ]})


@login_required
@require_http_methods(["GET"])
def stats_kpi(request):
    return JsonResponse(get_kpi(request.user))


@login_required
@require_http_methods(["GET"])
def export_csv(request):
    qs = Pomodoro.objects.filter(
        user=request.user, ended_at__isnull=False
    ).select_related('tag').order_by('-started_at')

    from_date = request.GET.get('from')
    to_date = request.GET.get('to')
    if from_date:
        qs = qs.filter(started_at__date__gte=from_date)
    if to_date:
        qs = qs.filter(started_at__date__lte=to_date)

    response = HttpResponse(content_type='text/csv; charset=utf-8')
    response['Content-Disposition'] = 'attachment; filename="pomodoro-export.csv"'
    response.write('\ufeff')  # BOM pro Excel

    writer = csv.writer(response)
    writer.writerow(['Datum', 'Začátek', 'Konec', 'Plánováno (min)', 'Skutečně (min)', 'Tag', 'Dokončeno'])
    for p in qs:
        writer.writerow([
            p.started_at.strftime('%Y-%m-%d'),
            p.started_at.strftime('%H:%M'),
            p.ended_at.strftime('%H:%M') if p.ended_at else '',
            round(p.planned_duration_sec / 60, 1),
            round((p.actual_duration_sec or 0) / 60, 1),
            p.tag.nazev if p.tag else '',
            'Ano' if p.completed_normally else 'Ne',
        ])
    return response
