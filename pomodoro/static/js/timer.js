'use strict';

const CSRF = document.querySelector('meta[name="csrf-token"]').content;

// --- Stav aplikace ---

const state = {
  mode: 'idle',       // 'idle' | 'running' | 'paused' | 'overflow' | 'break'
  pomodoroId: null,
  startedAt: null,    // ms timestamp
  endsAt: null,       // ms timestamp — plánovaný konec pomodora
  pausedAt: null,     // ms timestamp — kdy byla spuštěna pauza
  plannedSec: null,
  pomodoroCount: 0,   // počet dokončených pomodor v cyklu
  overflowSec: 0,
};

let settings = {
  work_duration_sec: 1500,
  short_break_sec: 300,
  long_break_sec: 900,
  long_break_every: 4,
  sound_enabled: true,
};

let tickInterval = null;

// --- Tick ---

function startTick() {
  if (tickInterval) return;
  tickInterval = setInterval(tick, 200);
}

function stopTick() {
  clearInterval(tickInterval);
  tickInterval = null;
}

function tick() {
  const now = Date.now();

  if (state.mode === 'running') {
    const remaining = Math.ceil((state.endsAt - now) / 1000);
    if (remaining <= 0) {
      state.mode = 'overflow';
      onPomodoroExpired();
    } else {
      document.getElementById('timer-display').textContent = formatTime(remaining);
    }
  } else if (state.mode === 'overflow') {
    const overflow = Math.floor((now - state.endsAt) / 1000);
    state.overflowSec = overflow;
    document.getElementById('overflow-display').textContent = '+' + formatTime(overflow);
  } else if (state.mode === 'break') {
    const remaining = Math.ceil((state.endsAt - now) / 1000);
    if (remaining <= 0) {
      onBreakExpired();
    } else {
      document.getElementById('timer-display').textContent = formatTime(remaining);
    }
  }
}

// --- Formátování ---

function formatTime(sec) {
  if (sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// --- UI ---

function updateUI() {
  const timerEl = document.getElementById('timer-display');
  const overflowEl = document.getElementById('overflow-display');
  const counterEl = document.getElementById('pomodoro-counter');

  document.getElementById('btn-idle').style.display = 'none';
  document.getElementById('btn-running').style.display = 'none';
  document.getElementById('btn-paused').style.display = 'none';
  document.getElementById('btn-overflow').style.display = 'none';
  document.getElementById('btn-break').style.display = 'none';
  overflowEl.style.display = 'none';

  const pos = (state.pomodoroCount % settings.long_break_every) + 1;

  switch (state.mode) {
    case 'idle':
      timerEl.textContent = formatTime(settings.work_duration_sec);
      timerEl.className = 'display-1 fw-bold mb-1';
      counterEl.textContent = `Pomodoro ${pos} / ${settings.long_break_every}`;
      document.getElementById('btn-idle').style.display = '';
      break;

    case 'running':
      timerEl.className = 'display-1 fw-bold mb-1 text-danger';
      counterEl.textContent = `Pomodoro ${pos} / ${settings.long_break_every}`;
      document.getElementById('btn-running').style.display = '';
      break;

    case 'paused': {
      const remaining = Math.ceil((state.endsAt - state.pausedAt) / 1000);
      timerEl.textContent = formatTime(remaining);
      timerEl.className = 'display-1 fw-bold mb-1 text-warning';
      counterEl.textContent = `Pomodoro ${pos} / ${settings.long_break_every} — pozastaveno`;
      document.getElementById('btn-paused').style.display = '';
      break;
    }

    case 'overflow':
      timerEl.textContent = formatTime(state.plannedSec) + ' ✓';
      timerEl.className = 'display-1 fw-bold mb-1 text-danger';
      overflowEl.style.display = '';
      counterEl.textContent = `Pomodoro ${pos} / ${settings.long_break_every}`;
      document.getElementById('btn-overflow').style.display = '';
      break;

    case 'break':
      timerEl.className = 'display-1 fw-bold mb-1 text-primary';
      counterEl.textContent = 'Přestávka';
      document.getElementById('btn-break').style.display = '';
      break;
  }
}

// --- API ---

async function loadSettings() {
  try {
    const resp = await fetch('/api/settings/');
    if (!resp.ok) return;
    settings = await resp.json();
  } catch (e) {}
  document.getElementById('s-work').value = Math.round(settings.work_duration_sec / 60);
  document.getElementById('s-short').value = Math.round(settings.short_break_sec / 60);
  document.getElementById('s-long').value = Math.round(settings.long_break_sec / 60);
  document.getElementById('s-every').value = settings.long_break_every;
  document.getElementById('s-sound').checked = settings.sound_enabled;
}

async function loadTags() {
  try {
    const resp = await fetch('/api/tags/');
    if (!resp.ok) return;
    const data = await resp.json();
    const select = document.getElementById('tag-select');
    select.innerHTML = '<option value="">— bez tagu —</option>';
    data.tags.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.nazev;
      select.appendChild(opt);
    });
  } catch (e) {}
}

async function syncActivePomodoro() {
  try {
    const resp = await fetch('/api/pomodoro/active/');
    if (resp.status === 204) return;
    const data = await resp.json();

    state.pomodoroId = data.id;
    state.startedAt = new Date(data.started_at).getTime();
    state.endsAt = new Date(data.ends_at).getTime();
    state.plannedSec = data.planned_duration_sec;

    state.mode = Date.now() < state.endsAt ? 'running' : 'overflow';
    updateUI();
    startTick();
  } catch (e) {}
}

async function startPomodoro() {
  const tagId = document.getElementById('tag-select').value || null;
  try {
    const resp = await fetch('/api/pomodoro/start/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': CSRF },
      body: JSON.stringify({ planned_duration_sec: settings.work_duration_sec, tag_id: tagId }),
    });
    if (!resp.ok) return;
    const data = await resp.json();

    state.pomodoroId = data.id;
    state.startedAt = new Date(data.started_at).getTime();
    state.endsAt = new Date(data.ends_at).getTime();
    state.plannedSec = data.planned_duration_sec;
    state.mode = 'running';
    state.overflowSec = 0;

    requestNotificationPermission();
    updateUI();
    startTick();
  } catch (e) {}
}

async function stopPomodoro(actualSec, completedNormally) {
  if (!state.pomodoroId) return;
  try {
    await fetch(`/api/pomodoro/${state.pomodoroId}/stop/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': CSRF },
      body: JSON.stringify({ actual_duration_sec: actualSec, completed_normally: completedNormally }),
    });
  } catch (e) {}
  state.pomodoroId = null;
}

function pauseTimer() {
  stopTick();
  state.pausedAt = Date.now();
  state.mode = 'paused';
  updateUI();
}

function resumeTimer() {
  const pausedDuration = Date.now() - state.pausedAt;
  state.endsAt += pausedDuration;
  state.pausedAt = null;
  state.mode = 'running';
  updateUI();
  startTick();
}

async function startBreak(actualSec, completedNormally) {
  await stopPomodoro(actualSec, completedNormally);

  const nextCount = state.pomodoroCount + 1;
  const isLong = nextCount % settings.long_break_every === 0;
  const breakSec = isLong ? settings.long_break_sec : settings.short_break_sec;

  state.mode = 'break';
  state.endsAt = Date.now() + breakSec * 1000;
  state.overflowSec = 0;

  localStorage.setItem('pomodoro_break', JSON.stringify({
    breakEndsAt: state.endsAt,
    pomodoroCount: state.pomodoroCount,
  }));

  updateUI();
  startTick();
}

function clearBreakStorage() {
  localStorage.removeItem('pomodoro_break');
}

function syncBreakFromStorage() {
  try {
    const raw = localStorage.getItem('pomodoro_break');
    if (!raw) return false;
    const { breakEndsAt, pomodoroCount } = JSON.parse(raw);
    if (Date.now() >= breakEndsAt) {
      clearBreakStorage();
      return false;
    }
    state.mode = 'break';
    state.endsAt = breakEndsAt;
    state.pomodoroCount = pomodoroCount;
    return true;
  } catch (e) {
    return false;
  }
}

async function saveSettings() {
  const payload = {
    work_duration_sec: parseInt(document.getElementById('s-work').value) * 60,
    short_break_sec: parseInt(document.getElementById('s-short').value) * 60,
    long_break_sec: parseInt(document.getElementById('s-long').value) * 60,
    long_break_every: parseInt(document.getElementById('s-every').value),
    sound_enabled: document.getElementById('s-sound').checked,
  };
  try {
    const resp = await fetch('/api/settings/update/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': CSRF },
      body: JSON.stringify(payload),
    });
    if (resp.ok) {
      settings = { ...settings, ...payload };
      bootstrap.Modal.getOrCreateInstance(document.getElementById('settingsModal')).hide();
      if (state.mode === 'idle') updateUI();
    }
  } catch (e) {}
}

// --- Events ---

function onPomodoroExpired() {
  updateUI();
  playBeep();
  showNotification('Pomodoro dokončeno! 🍅', 'Čas na přestávku.');
}

function onBreakExpired() {
  stopTick();
  clearBreakStorage();
  state.pomodoroCount++;
  state.mode = 'idle';
  state.endsAt = null;
  playBeep();
  showNotification('Přestávka skončila!', 'Čas na další pomodoro.');
  updateUI();
  loadTodayStats();
}

// --- Overflow modal ---

function showOverflowModal() {
  document.getElementById('modal-planned').textContent = formatTime(state.plannedSec);
  document.getElementById('modal-planned-btn').textContent = formatTime(state.plannedSec);
  document.getElementById('modal-overflow').textContent = formatTime(state.overflowSec);
  document.getElementById('modal-total-btn').textContent = formatTime(state.plannedSec + state.overflowSec);
  bootstrap.Modal.getOrCreateInstance(document.getElementById('overflowModal')).show();
}

// --- Zvuk ---

function playBeep() {
  if (!settings.sound_enabled) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.8);
  } catch (e) {}
}

// --- Notifikace ---

function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

function showNotification(title, body) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  new Notification(title, { body });
}

// --- Dnešní statistiky ---

async function loadTodayStats() {
  try {
    const today = new Date().toISOString().split('T')[0];
    const resp = await fetch(`/api/pomodoro/?from=${today}&to=${today}`);
    if (!resp.ok) return;
    const data = await resp.json();
    const completed = data.results.filter(p => p.completed_normally);
    const totalSec = completed.reduce((sum, p) => sum + (p.actual_duration_sec || 0), 0);
    document.getElementById('today-count').textContent = completed.length;
    document.getElementById('today-minutes').textContent = Math.round(totalSec / 60);
  } catch (e) {}
}

// --- Event listeners ---

document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  await loadTags();

  const breakRestored = syncBreakFromStorage();
  if (breakRestored) {
    updateUI();
    startTick();
  } else {
    await syncActivePomodoro();
  }
  if (state.mode === 'idle') updateUI();
  loadTodayStats();

  document.getElementById('btn-start').addEventListener('click', startPomodoro);

  document.getElementById('btn-stop').addEventListener('click', async () => {
    const elapsed = Math.floor((Date.now() - state.startedAt) / 1000);
    stopTick();
    await stopPomodoro(elapsed, false);
    state.mode = 'idle';
    updateUI();
    loadTodayStats();
  });

  document.getElementById('btn-pause').addEventListener('click', pauseTimer);
  document.getElementById('btn-resume').addEventListener('click', resumeTimer);

  document.getElementById('btn-stop-paused').addEventListener('click', async () => {
    const elapsed = Math.floor((state.pausedAt - state.startedAt) / 1000);
    state.pausedAt = null;
    await stopPomodoro(elapsed, false);
    state.mode = 'idle';
    updateUI();
    loadTodayStats();
  });

  document.getElementById('btn-start-break').addEventListener('click', () => {
    stopTick();
    showOverflowModal();
  });

  document.getElementById('btn-stop-overflow').addEventListener('click', async () => {
    stopTick();
    await stopPomodoro(state.plannedSec + state.overflowSec, false);
    state.mode = 'idle';
    updateUI();
    loadTodayStats();
  });

  document.getElementById('btn-no-overflow').addEventListener('click', async () => {
    bootstrap.Modal.getOrCreateInstance(document.getElementById('overflowModal')).hide();
    await startBreak(state.plannedSec, true);
  });

  document.getElementById('btn-yes-overflow').addEventListener('click', async () => {
    bootstrap.Modal.getOrCreateInstance(document.getElementById('overflowModal')).hide();
    await startBreak(state.plannedSec + state.overflowSec, true);
  });

  document.getElementById('btn-skip-break').addEventListener('click', () => {
    stopTick();
    clearBreakStorage();
    state.pomodoroCount++;
    state.mode = 'idle';
    state.endsAt = null;
    updateUI();
  });

  document.getElementById('btn-save-settings').addEventListener('click', saveSettings);
});
