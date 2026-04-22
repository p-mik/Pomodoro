'use strict';

function fmtTime(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h ${m}min`;
  return `${m} min`;
}

function fmtDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' });
}

async function loadKpi() {
  try {
    const r = await fetch('/api/stats/kpi/');
    const d = await r.json();
    document.getElementById('kpi-today-count').textContent = d.today.count + ' 🍅';
    document.getElementById('kpi-today-time').textContent = fmtTime(d.today.sec);
    document.getElementById('kpi-week-count').textContent = d.week.count + ' 🍅';
    document.getElementById('kpi-week-time').textContent = fmtTime(d.week.sec);
    document.getElementById('kpi-month-count').textContent = d.month.count + ' 🍅';
    document.getElementById('kpi-month-time').textContent = fmtTime(d.month.sec);
  } catch (e) {}
}

async function loadDailyChart() {
  try {
    const r = await fetch('/api/stats/daily/?days=30');
    const d = await r.json();

    const days = {};
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const key = date.toISOString().slice(0, 10);
      days[key] = 0;
    }
    d.data.forEach(row => { days[row.day] = Math.round(row.total_sec / 60); });

    new Chart(document.getElementById('chart-daily'), {
      type: 'bar',
      data: {
        labels: Object.keys(days).map(fmtDate),
        datasets: [{
          label: 'Minut práce',
          data: Object.values(days),
          backgroundColor: 'rgba(220, 53, 69, 0.7)',
          borderRadius: 4,
        }]
      },
      options: {
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, title: { display: true, text: 'min' } },
          x: { ticks: { maxRotation: 45 } }
        }
      }
    });
  } catch (e) {}
}

async function loadTagChart() {
  try {
    const r = await fetch('/api/stats/tags/');
    const d = await r.json();

    if (d.data.length === 0) {
      document.getElementById('chart-tags').parentElement.innerHTML =
        '<p class="text-muted text-center py-4">Žádná data</p>';
      return;
    }

    new Chart(document.getElementById('chart-tags'), {
      type: 'doughnut',
      data: {
        labels: d.data.map(t => t.tag),
        datasets: [{
          data: d.data.map(t => Math.round(t.total_sec / 60)),
          backgroundColor: d.data.map(t => t.barva),
        }]
      },
      options: {
        plugins: {
          legend: { position: 'bottom' },
          tooltip: {
            callbacks: { label: ctx => ` ${ctx.label}: ${ctx.parsed} min` }
          }
        }
      }
    });
  } catch (e) {}
}

async function loadSessions() {
  try {
    const r = await fetch('/api/pomodoro/');
    const d = await r.json();
    const tbody = document.getElementById('sessions-table');

    if (d.results.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Žádné záznamy</td></tr>';
      return;
    }

    tbody.innerHTML = d.results.map(p => {
      const date = new Date(p.started_at);
      const dateStr = date.toLocaleDateString('cs-CZ');
      const timeStr = date.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
      const durMin = Math.round((p.actual_duration_sec || 0) / 60);
      const tag = p.tag_nazev || '<span class="text-muted">—</span>';
      const done = p.completed_normally
        ? '<span class="badge bg-success">Ano</span>'
        : '<span class="badge bg-secondary">Ne</span>';
      return `<tr>
        <td>${dateStr}</td>
        <td>${timeStr}</td>
        <td>${durMin} min</td>
        <td>${tag}</td>
        <td>${done}</td>
      </tr>`;
    }).join('');
  } catch (e) {}
}

document.addEventListener('DOMContentLoaded', () => {
  loadKpi();
  loadDailyChart();
  loadTagChart();
  loadSessions();
});
