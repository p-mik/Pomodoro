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
    s = request.user.settings
    return JsonResponse({
        'work_duration_sec': s.work_duration_sec,
        'short_break_sec': s.short_break_sec,
        'long_break_sec': s.long_break_sec,
        'long_break_every': s.long_break_every,
        'sound_enabled': s.sound_enabled,
    })


@login_required
@require_http_methods(["PUT"])
def settings_update(request):
    data = json.loads(request.body)
    s = request.user.settings
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
