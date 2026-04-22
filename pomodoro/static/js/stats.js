'use strict';

const CSRF = document.querySelector('meta[name="csrf-token"]').content;

// Výpočet Velikonoc (Anonymní Gregoriánský algoritmus)
function getEaster(year) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day); // lokální čas
}

// Formátuje Date na "YYYY-MM-DD" v lokálním čase (bez UTC posunu)
function localDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Česká státní svátky (pevné datumy + Velký pátek + Velikonoční pondělí)
function getCzechHolidays(year) {
  const fixed = [
    `${year}-01-01`, `${year}-05-01`, `${year}-05-08`,
    `${year}-07-05`, `${year}-07-06`, `${year}-09-28`,
    `${year}-10-28`, `${year}-11-17`,
    `${year}-12-24`, `${year}-12-25`, `${year}-12-26`,
  ];
  const easter = getEaster(year);
  const goodFriday = new Date(easter); goodFriday.setDate(easter.getDate() - 2);
  const easterMon = new Date(easter); easterMon.setDate(easter.getDate() + 1);
  return new Set([
    ...fixed,
    localDateStr(goodFriday),
    localDateStr(easterMon),
  ]);
}

// Parsuje "YYYY-MM-DD" jako lokální datum (ne UTC) — fix timezone bugu
function parseLocalDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function getDayBgColor(dateStr) {
  const date = parseLocalDate(dateStr);
  const dow = date.getDay();
  const holidays = getCzechHolidays(date.getFullYear());
  if (holidays.has(dateStr)) return 'rgba(108, 117, 125, 0.08)';
  if (dow === 0 || dow === 6) return 'rgba(255, 193, 7, 0.12)';
  return null;
}

// Chart.js plugin — barví pozadí sloupců (víkend/svátek)
const columnBgPlugin = {
  id: 'columnBg',
  beforeDatasetsDraw(chart) {
    const { ctx, chartArea } = chart;
    const meta = chart.getDatasetMeta(0);
    meta.data.forEach((bar, i) => {
      const color = getDayBgColor(chart._dateKeys[i]);
      if (!color) return;
      const w = bar.width;
      ctx.save();
      ctx.fillStyle = color;
      ctx.fillRect(bar.x - w / 2, chartArea.top, w, chartArea.bottom - chartArea.top);
      ctx.restore();
    });
  },
};

function fmtTime(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h ${m}min`;
  return `${m} min`;
}

function fmtDate(dateStr) {
  return parseLocalDate(dateStr).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' });
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

let dailyChart = null;

async function loadDailyChart(days = 7) {
  if (dailyChart) { dailyChart.destroy(); dailyChart = null; }

  try {
    const r = await fetch(`/api/stats/daily-by-tag/?days=${days}`);
    const d = await r.json();

    const dateKeys = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      dateKeys.push(localDateStr(date));
    }

    // Collect all tags in order of first appearance
    const tagOrder = [];
    const tagMeta = {};
    d.data.forEach(row => {
      const key = row.tag_id ?? 'none';
      if (!tagMeta[key]) {
        tagMeta[key] = { label: row.tag, barva: row.barva };
        tagOrder.push(key);
      }
    });

    // Build per-tag data map
    const tagDays = {};
    tagOrder.forEach(k => {
      tagDays[k] = {};
      dateKeys.forEach(day => { tagDays[k][day] = 0; });
    });
    d.data.forEach(row => {
      const key = row.tag_id ?? 'none';
      tagDays[key][row.day] = Math.round(row.total_sec / 60);
    });

    const datasets = tagOrder.map(k => ({
      label: tagMeta[k].label,
      data: dateKeys.map(day => tagDays[k][day]),
      backgroundColor: tagMeta[k].barva,
      borderRadius: 2,
      stack: 'work',
    }));

    if (datasets.length === 0) {
      datasets.push({
        label: 'Minut práce',
        data: dateKeys.map(() => 0),
        backgroundColor: 'rgba(220, 53, 69, 0.7)',
        borderRadius: 4,
        stack: 'work',
      });
    }

    const maxTicks = days <= 7 ? 7 : days <= 30 ? 10 : 13;

    dailyChart = new Chart(document.getElementById('chart-daily'), {
      type: 'bar',
      plugins: [columnBgPlugin],
      data: {
        labels: dateKeys.map(fmtDate),
        datasets,
      },
      options: {
        plugins: {
          legend: { display: tagOrder.length > 1, position: 'bottom' },
          tooltip: {
            callbacks: {
              title: ctx => {
                const key = dateKeys[ctx[0].dataIndex];
                const date = parseLocalDate(key);
                const holidays = getCzechHolidays(date.getFullYear());
                const dow = date.getDay();
                const label = date.toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long' });
                if (holidays.has(key)) return label + ' 🎉';
                if (dow === 0 || dow === 6) return label + ' 🌿';
                return label;
              },
              label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y} min`,
            }
          }
        },
        scales: {
          x: { stacked: true, ticks: { maxRotation: 45, maxTicksLimit: maxTicks } },
          y: { stacked: true, beginAtZero: true, title: { display: true, text: 'min' } },
        }
      }
    });
    dailyChart._dateKeys = dateKeys;
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

async function deleteSession(id, row) {
  if (!confirm('Smazat tuto session?')) return;
  try {
    const r = await fetch(`/api/pomodoro/${id}/delete/`, {
      method: 'POST',
      headers: { 'X-CSRFToken': CSRF },
    });
    if (r.ok) {
      row.remove();
      loadKpi();
    }
  } catch (e) {}
}

async function loadSessions() {
  try {
    const r = await fetch('/api/pomodoro/');
    const d = await r.json();
    const tbody = document.getElementById('sessions-table');

    if (d.results.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Žádné záznamy</td></tr>';
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
      return `<tr data-id="${p.id}">
        <td>${dateStr}</td>
        <td>${timeStr}</td>
        <td>${durMin} min</td>
        <td>${tag}</td>
        <td>${done}</td>
        <td><button class="btn btn-outline-danger btn-sm py-0 btn-delete" title="Smazat"><i class="bi bi-trash"></i></button></td>
      </tr>`;
    }).join('');

    tbody.querySelectorAll('.btn-delete').forEach(btn => {
      const row = btn.closest('tr');
      btn.addEventListener('click', () => deleteSession(row.dataset.id, row));
    });
  } catch (e) {}
}

document.addEventListener('DOMContentLoaded', () => {
  loadKpi();
  loadDailyChart(7);
  loadTagChart();
  loadSessions();

  document.querySelectorAll('#period-switcher button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#period-switcher button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      loadDailyChart(parseInt(btn.dataset.days));
    });
  });
});
