// ═══════════════════════════════════════════
//  STATE
// ═══════════════════════════════════════════
const EMOJIS = ['🏃','💪','🧘','📚','✍️','🎯','🛌','🚿','🥗','💧','🍎','🚴','🏋️','🧠','📖','🎸','💻','🌿','☕','🧹','💰','📝','🔥','⚡','🌅','🌙','🎵','🦷','🙏','🚭','📵','🍷'];
const COLORS = ['#6c63ff','#43e97b','#f6d365','#ff6584','#38bdf8','#fb923c','#a78bfa','#34d399','#fb7185','#60a5fa'];
const CATS = { health:'💪 Health', mind:'🧠 Mind', productivity:'🎯 Productivity', wellbeing:'🌿 Wellbeing', finance:'💰 Finance', social:'👥 Social', other:'⭐ Other' };

let state = {
  habits: [],
  checks: {}, // "YYYY-MM-DD:habitId" = true/false
  sessions: [],
  settings: { name: 'User', goal: 10, pomodoro: 25, short: 5, long: 15, sessionsBeforeLong: 4, accent: '#6c63ff' },
  trackerMonth: { year: new Date().getFullYear(), month: new Date().getMonth() }
};

let editingHabitId = null;
let selectedEmoji = '🎯';
let selectedColor = '#6c63ff';
let timerInterval = null;
let timerRunning = false;
let timerSeconds = 25 * 60;
let timerTotal = 25 * 60;
let timerMode = 'pomodoro';
let stopwatchSeconds = 0;
let stopwatchRunning = false;
let pomodoroSession = 1;
let focusHabitId = null;
let clockInterval = null;

// ═══════════════════════════════════════════
//  STORAGE
// ═══════════════════════════════════════════
function saveState() {
  try { localStorage.setItem('habitflow_state', JSON.stringify(state)); } catch(e){}
}
function loadState() {
  try {
    const s = localStorage.getItem('habitflow_state');
    if (s) { const parsed = JSON.parse(s); state = { ...state, ...parsed }; }
  } catch(e){}
}

// ═══════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════
function dateKey(d) {
  return d.toISOString().split('T')[0];
}
function today() { return new Date(); }
function todayKey() { return dateKey(today()); }
function checkKey(date, habitId) { return date + ':' + habitId; }

function isChecked(date, habitId) { return state.checks[checkKey(date, habitId)] === true; }
function isMissed(date, habitId) { return state.checks[checkKey(date, habitId)] === false; }

function setCheck(date, habitId, val) {
  if (val === null) {
    delete state.checks[checkKey(date, habitId)];
  } else {
    state.checks[checkKey(date, habitId)] = val;
  }
  saveState();
}

function getDateProgress(dateStr) {
  if (!state.habits.length) return { done: 0, total: 0, pct: 0 };
  const done = state.habits.filter(h => isChecked(dateStr, h.id)).length;
  const total = state.habits.length;
  return { done, total, pct: total ? Math.round((done/total)*100) : 0 };
}

function getStreak(habitId) {
  let streak = 0;
  const d = new Date();
  d.setHours(0,0,0,0);
  for (let i = 0; i < 365; i++) {
    const k = dateKey(d);
    if (isChecked(k, habitId)) { streak++; d.setDate(d.getDate()-1); }
    else break;
  }
  return streak;
}

function getBestStreak(habitId) {
  let best = 0, current = 0;
  const d = new Date();
  d.setHours(0,0,0,0);
  for (let i = 0; i < 365; i++) {
    const k = dateKey(d);
    if (isChecked(k, habitId)) { current++; best = Math.max(best, current); }
    else { current = 0; }
    d.setDate(d.getDate()-1);
  }
  return best;
}

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }

function monthName(m) {
  return ['January','February','March','April','May','June','July','August','September','October','November','December'][m];
}

function daysInMonth(year, month) { return new Date(year, month+1, 0).getDate(); }

function getDayOfWeek(year, month, day) { return new Date(year, month, day).getDay(); }

function formatTime(secs) {
  const m = Math.floor(Math.abs(secs)/60).toString().padStart(2,'0');
  const s = (Math.abs(secs)%60).toString().padStart(2,'0');
  return m+':'+s;
}

function formatFullTime(date) {
  const h = date.getHours().toString().padStart(2,'0');
  const m = date.getMinutes().toString().padStart(2,'0');
  const s = date.getSeconds().toString().padStart(2,'0');
  return h+':'+m+':'+s;
}

// ═══════════════════════════════════════════
//  CLOCK
// ═══════════════════════════════════════════
function startClock() {
  clearInterval(clockInterval);
  function tick() {
    const now = new Date();
    const timeStr = formatFullTime(now);
    document.querySelectorAll('.live-clock, #live-clock, #live-clock-2').forEach(el => { if(el) el.textContent = timeStr; });
    const dateStr = now.toLocaleDateString('en-GB', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
    const el = document.getElementById('today-date-display');
    if(el) el.textContent = dateStr;
    const el2 = document.getElementById('sidebar-date-display');
    if(el2) el2.textContent = dateStr;
    const h = now.getHours();
    const greet = h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening';
    const el3 = document.getElementById('greeting-text');
    if(el3) el3.textContent = greet + '! ' + (state.settings.name || 'User') + ' 👋';
  }
  tick();
  clockInterval = setInterval(tick, 1000);
}

// ═══════════════════════════════════════════
//  NAVIGATION
// ═══════════════════════════════════════════
function navigate(page, el) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const p = document.getElementById('page-'+page);
  if(p) p.classList.add('active');
  if(el) el.classList.add('active');
  if (page === 'tracker') renderTracker();
  if (page === 'dashboard') renderDashboard();
  if (page === 'habits') renderHabitsList();
  if (page === 'analytics') renderAnalytics();
  if (page === 'timer') renderTimerHabitSelect();
  if (window.innerWidth <= 720) { document.getElementById('sidebar').classList.remove('open'); }
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

// ═══════════════════════════════════════════
//  MODAL
// ═══════════════════════════════════════════
function openAddHabit() {
  editingHabitId = null;
  selectedEmoji = '🎯';
  selectedColor = '#6c63ff';
  document.getElementById('habit-name-input').value = '';
  document.getElementById('habit-note-input').value = '';
  document.getElementById('habit-cat-input').value = 'health';
  document.getElementById('habit-modal-title').textContent = '✨ Add New Habit';
  document.getElementById('save-habit-btn').textContent = 'Add Habit';
  buildEmojiGrid();
  buildColorRow('habit-color-row', COLORS, c => { selectedColor = c; });
  openModal('habit-modal');
}

function openEditHabit(id) {
  const h = state.habits.find(x => x.id === id);
  if (!h) return;
  editingHabitId = id;
  selectedEmoji = h.emoji;
  selectedColor = h.color;
  document.getElementById('habit-name-input').value = h.name;
  document.getElementById('habit-note-input').value = h.note || '';
  document.getElementById('habit-cat-input').value = h.category || 'other';
  document.getElementById('habit-modal-title').textContent = '✏️ Edit Habit';
  document.getElementById('save-habit-btn').textContent = 'Save Changes';
  buildEmojiGrid();
  buildColorRow('habit-color-row', COLORS, c => { selectedColor = c; });
  openModal('habit-modal');
}

function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

function buildEmojiGrid() {
  const grid = document.getElementById('emoji-grid');
  grid.innerHTML = EMOJIS.map(e => `
    <button class="emoji-btn ${e === selectedEmoji ? 'selected' : ''}" onclick="selectEmoji('${e}', this)">${e}</button>
  `).join('');
}

function selectEmoji(e, el) {
  selectedEmoji = e;
  document.querySelectorAll('.emoji-btn').forEach(b => b.classList.remove('selected'));
  el.classList.add('selected');
}

function buildColorRow(containerId, colors, cb) {
  const row = document.getElementById(containerId);
  if (!row) return;
  row.innerHTML = colors.map(c => `
    <div class="color-pick ${c === selectedColor ? 'selected' : ''}" style="background:${c};"
      data-color="${c}" onclick="selectColor('${c}', this, '${containerId}', null)"></div>
  `).join('');
}

function selectColor(c, el, containerId, cb) {
  selectedColor = c;
  document.querySelectorAll(`#${containerId} .color-pick`).forEach(x => x.classList.remove('selected'));
  el.classList.add('selected');
}

function saveHabit() {
  const name = document.getElementById('habit-name-input').value.trim();
  if (!name) { toast('Please enter a habit name', 'error'); return; }
  if (editingHabitId) {
    const h = state.habits.find(x => x.id === editingHabitId);
    if (h) {
      h.name = name;
      h.emoji = selectedEmoji;
      h.color = selectedColor;
      h.category = document.getElementById('habit-cat-input').value;
      h.note = document.getElementById('habit-note-input').value.trim();
    }
    toast('Habit updated ✓', 'success');
  } else {
    state.habits.push({
      id: uid(), name, emoji: selectedEmoji, color: selectedColor,
      category: document.getElementById('habit-cat-input').value,
      note: document.getElementById('habit-note-input').value.trim(),
      createdAt: todayKey()
    });
    toast('Habit added! ✓', 'success');
  }
  saveState();
  closeModal('habit-modal');
  renderAll();
}

function deleteHabit(id) {
  if (!confirm('Delete this habit? All tracking data will be lost.')) return;
  state.habits = state.habits.filter(h => h.id !== id);
  Object.keys(state.checks).forEach(k => { if(k.endsWith(':'+id)) delete state.checks[k]; });
  saveState();
  renderAll();
  toast('Habit deleted', 'info');
}

// ═══════════════════════════════════════════
//  RENDER DASHBOARD
// ═══════════════════════════════════════════
function renderDashboard() {
  const tk = todayKey();
  const prog = getDateProgress(tk);

  document.getElementById('stat-progress').textContent = prog.pct + '%';
  document.getElementById('stat-progress-sub').textContent = prog.done + ' of ' + prog.total + ' done';
  document.getElementById('stat-progress-bar').style.width = prog.pct + '%';
  document.getElementById('stat-total').textContent = state.habits.length;

  // Best streak across all habits
  let bestStreak = 0;
  let bestHabitName = '-';
  state.habits.forEach(h => {
    const s = getStreak(h.id);
    if (s > bestStreak) { bestStreak = s; bestHabitName = h.name; }
  });
  document.getElementById('stat-streak').textContent = bestStreak + ' 🔥';
  document.getElementById('stat-streak-sub').textContent = bestStreak ? bestHabitName : 'Start a streak!';

  // Monthly score
  const now = new Date();
  const dim = daysInMonth(now.getFullYear(), now.getMonth());
  let monthTotal = 0, monthDone = 0;
  for (let d = 1; d <= now.getDate(); d++) {
    const dk = new Date(now.getFullYear(), now.getMonth(), d).toISOString().split('T')[0];
    const p = getDateProgress(dk);
    monthTotal += p.total;
    monthDone += p.done;
  }
  const monthPct = monthTotal ? Math.round((monthDone/monthTotal)*100) : 0;
  document.getElementById('stat-monthly').textContent = monthPct + '%';
  document.getElementById('stat-monthly-sub').textContent = `${monthDone}/${monthTotal} checks this month`;

  // Today's habits
  const todayList = document.getElementById('today-habits-list');
  const remaining = state.habits.filter(h => !isChecked(tk, h.id)).length;
  document.getElementById('today-tag').textContent = remaining + ' remaining';
  if (!state.habits.length) {
    todayList.innerHTML = `<div style="text-align:center;padding:32px;color:var(--text3);">
      <div style="font-size:32px;margin-bottom:8px;">🎯</div>
      <div>No habits yet — <a href="#" onclick="openAddHabit();return false;" style="color:var(--accent);">add one!</a></div>
    </div>`;
  } else {
    todayList.innerHTML = state.habits.map(h => {
      const done = isChecked(tk, h.id);
      const streak = getStreak(h.id);
      return `<div class="habit-item" style="opacity:${done?0.7:1};">
        <div style="font-size:22px;">${h.emoji}</div>
        <div class="habit-item-info">
          <div class="habit-item-name" style="text-decoration:${done?'line-through':'none'};color:${done?'var(--text3)':'var(--text)'};">${h.name}</div>
          <div class="habit-item-meta">${CATS[h.category]||''}${streak>0?' · 🔥'+streak+' day streak':''}</div>
        </div>
        <div style="display:flex;gap:6px;align-items:center;">
          <button class="check-btn ${done?'done':''}" onclick="toggleTodayHabit('${h.id}', this)" title="${done?'Mark undone':'Mark done'}">
            ${done?'✓':''}
          </button>
        </div>
      </div>`;
    }).join('');
  }

  // Weekly chart
  renderWeekChart();

  // Streaks
  renderStreaksList();
}

function toggleTodayHabit(habitId, btn) {
  const tk = todayKey();
  const done = isChecked(tk, habitId);
  setCheck(tk, habitId, !done);
  if (!done) toast('Habit logged! 🎉', 'success');
  renderDashboard();
}

function renderWeekChart() {
  const bars = document.getElementById('week-chart-bars');
  const labels = document.getElementById('week-chart-labels');
  const DAY_LABELS = ['Su','Mo','Tu','We','Th','Fr','Sa'];
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d);
  }
  bars.innerHTML = days.map(d => {
    const dk = dateKey(d);
    const p = getDateProgress(dk);
    const h = Math.max(4, p.pct * 1.1);
    return `<div class="chart-bar-wrap">
      <div style="font-size:9px;color:${p.pct>=80?'var(--accent3)':p.pct>=50?'var(--accent)':'var(--text3)'};font-weight:600;">${p.pct}%</div>
      <div class="chart-bar" style="height:${h}px;background:${p.pct>=80?'linear-gradient(180deg,var(--accent3),rgba(67,233,123,0.3))':p.pct>=50?'linear-gradient(180deg,var(--accent),rgba(108,99,255,0.3))':'linear-gradient(180deg,var(--text3),rgba(90,90,122,0.2))'}"></div>
    </div>`;
  }).join('');
  labels.innerHTML = days.map(d => `<div style="flex:1;text-align:center;font-size:9px;color:var(--text3);font-weight:600;">${DAY_LABELS[d.getDay()]}</div>`).join('');
}

function renderStreaksList() {
  const list = document.getElementById('streaks-list');
  if (!state.habits.length) {
    list.innerHTML = `<div style="text-align:center;font-size:12px;color:var(--text3);padding:16px;">No habits yet</div>`;
    return;
  }
  const sorted = [...state.habits].map(h => ({ ...h, streak: getStreak(h.id) }))
    .sort((a,b) => b.streak - a.streak).slice(0,6);
  list.innerHTML = sorted.map(h => `
    <div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid var(--border);">
      <span style="font-size:16px;">${h.emoji}</span>
      <div style="flex:1;">
        <div style="font-size:12px;font-weight:600;">${h.name}</div>
        <div style="height:4px;background:var(--surface3);border-radius:2px;margin-top:4px;overflow:hidden;">
          <div style="height:100%;width:${Math.min(100,h.streak*10)}%;background:${h.color};border-radius:2px;transition:width 0.5s;"></div>
        </div>
      </div>
      <div class="streak-badge">${h.streak > 0 ? '🔥 ' + h.streak : '—'}</div>
    </div>
  `).join('');
}

// ═══════════════════════════════════════════
//  RENDER TRACKER TABLE
// ═══════════════════════════════════════════
function renderTracker() {
  const { year, month } = state.trackerMonth;
  document.getElementById('tracker-month-label').textContent = monthName(month) + ' ' + year;
  document.getElementById('tracker-subtitle').textContent = 'Track your habits for ' + monthName(month);

  const dim = daysInMonth(year, month);
  const today = new Date();
  const todayStr = dateKey(today);
  const DAY_LETTERS = ['Su','Mo','Tu','We','Th','Fr','Sa'];

  // Build weeks
  const weeks = [];
  let week = [];
  for (let d = 1; d <= dim; d++) {
    const dow = getDayOfWeek(year, month, d);
    week.push({ day: d, dow });
    if (dow === 6 || d === dim) { weeks.push(week); week = []; }
  }

  let html = `<thead><tr>
    <th class="habit-col">My Habits</th>`;
  weeks.forEach((wk, wi) => {
    wk.forEach(({ day, dow }) => {
      const dStr = new Date(year, month, day).toISOString().split('T')[0];
      const isToday = dStr === todayStr;
      html += `<th style="${isToday?'color:var(--accent);':''}">
        <div style="font-size:9px;">${DAY_LETTERS[dow]}</div>
        <div>${day}</div>
      </th>`;
    });
    if (wi < weeks.length - 1) html += `<th style="width:8px;"></th>`;
  });
  html += `<th style="width:50px;text-align:center;">%</th></tr></thead><tbody>`;

  state.habits.forEach((h, hi) => {
    html += `<tr class="habit-row">
      <td class="habit-cell">
        <div class="habit-name-wrap">
          <div class="color-dot" style="background:${h.color};"></div>
          <div class="habit-emoji">${h.emoji}</div>
          <div>
            <div class="habit-name-text">${h.name}</div>
            <div class="habit-cat">${CATS[h.category]||''}</div>
          </div>
        </div>
      </td>`;
    let doneCnt = 0;
    weeks.forEach((wk, wi) => {
      wk.forEach(({ day }) => {
        const dStr = new Date(year, month, day).toISOString().split('T')[0];
        const isFuture = dStr > todayStr;
        const done = isChecked(dStr, h.id);
        const missed = isMissed(dStr, h.id);
        if (done) doneCnt++;
        html += `<td><button class="check-btn ${done?'done':missed?'missed':isFuture?'future':''}"
          onclick="${isFuture?'':(`cycleCheck('${dStr}','${h.id}',this)`)}"
          title="${dStr}">${done?'✓':missed?'✗':''}</button></td>`;
      });
      if (wi < weeks.length - 1) html += `<td></td>`;
    });
    const pct = dim ? Math.round((doneCnt/today.getDate())*100) : 0;
    html += `<td style="text-align:center;font-size:11px;font-family:'JetBrains Mono',monospace;color:${pct>=80?'var(--accent3)':pct>=50?'var(--accent)':'var(--text3)'};font-weight:600;">${pct}%</td>`;
    html += `</tr>`;
  });

  if (!state.habits.length) {
    html += `<tr><td colspan="40" style="text-align:center;padding:32px;color:var(--text3);">No habits yet. <a href="#" onclick="openAddHabit();return false;" style="color:var(--accent);">Add one!</a></td></tr>`;
  }

  html += `</tbody>`;
  document.getElementById('tracker-table').innerHTML = html;

  // Summary row
  let sumHTML = '';
  weeks.forEach((wk, wi) => {
    wk.forEach(({ day }) => {
      const dStr = new Date(year, month, day).toISOString().split('T')[0];
      const p = getDateProgress(dStr);
      sumHTML += `<div class="summary-item"><div class="summary-dot" style="background:${p.pct>=80?'var(--accent3)':p.pct>=50?'var(--accent)':'var(--surface3)'};"></div><span style="font-family:'JetBrains Mono',monospace;font-size:10px;">${p.pct}%</span></div>`;
    });
    if (wi < weeks.length - 1) sumHTML += `<div style="width:8px;"></div>`;
  });
  document.getElementById('tracker-summary-row').innerHTML = sumHTML;
}

function cycleCheck(dateStr, habitId, btn) {
  const done = isChecked(dateStr, habitId);
  const missed = isMissed(dateStr, habitId);
  if (!done && !missed) { setCheck(dateStr, habitId, true); toast('✓ Logged!', 'success'); }
  else if (done) { setCheck(dateStr, habitId, false); }
  else { setCheck(dateStr, habitId, null); }
  renderTracker();
  renderDashboard();
}

function changeTrackerMonth(delta) {
  state.trackerMonth.month += delta;
  if (state.trackerMonth.month < 0) { state.trackerMonth.month = 11; state.trackerMonth.year--; }
  if (state.trackerMonth.month > 11) { state.trackerMonth.month = 0; state.trackerMonth.year++; }
  renderTracker();
}

// ═══════════════════════════════════════════
//  RENDER HABITS LIST
// ═══════════════════════════════════════════
function renderHabitsList() {
  const list = document.getElementById('habits-list-view');
  const empty = document.getElementById('habits-empty');
  if (!state.habits.length) { list.innerHTML = ''; empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  list.innerHTML = state.habits.map(h => {
    const streak = getStreak(h.id);
    const best = getBestStreak(h.id);
    const tk = todayKey();
    const done = isChecked(tk, h.id);
    return `<div class="habit-item">
      <div style="font-size:24px;width:40px;text-align:center;">${h.emoji}</div>
      <div class="habit-item-info">
        <div class="habit-item-name">${h.name}</div>
        <div class="habit-item-meta">${CATS[h.category]||''} &nbsp;·&nbsp; Best streak: ${best} days</div>
        ${h.note ? `<div class="habit-item-meta" style="margin-top:2px;font-style:italic;">${h.note}</div>` : ''}
      </div>
      <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;justify-content:flex-end;">
        ${streak > 0 ? `<div class="habit-streak">🔥 ${streak} day${streak!==1?'s':''}</div>` : ''}
        <button class="btn btn-ghost btn-sm" onclick="openEditHabit('${h.id}')">✏️</button>
        <button class="btn btn-danger btn-sm" onclick="deleteHabit('${h.id}')">🗑️</button>
      </div>
    </div>`;
  }).join('');
}

// ═══════════════════════════════════════════
//  TIMER
// ═══════════════════════════════════════════
function setTimerMode(mode, el) {
  timerMode = mode;
  clearInterval(timerInterval);
  timerRunning = false;
  stopwatchRunning = false;
  document.querySelectorAll('.timer-mode-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('custom-time-row').style.display = mode === 'custom' ? 'flex' : 'none';
  const s = state.settings;
  const MODES = { pomodoro: s.pomodoro*60, short: s.short*60, long: s.long*60, custom: (parseInt(document.getElementById('custom-min').value)||25)*60, stopwatch: 0 };
  timerSeconds = MODES[mode] || s.pomodoro*60;
  timerTotal = timerSeconds;
  stopwatchSeconds = 0;
  const LABELS = { pomodoro:'FOCUS SESSION', short:'SHORT BREAK', long:'LONG BREAK', custom:'CUSTOM TIMER', stopwatch:'STOPWATCH' };
  document.getElementById('timer-mode-label').textContent = LABELS[mode];
  document.querySelector('#timer-display').textContent = mode === 'stopwatch' ? '00:00' : formatTime(timerSeconds);
  document.querySelector('.btn-primary[onclick="startStopTimer()"]').textContent = '▶ Start';
  updateTimerRing(1);
}

function applyCustomTime() {
  const m = parseInt(document.getElementById('custom-min').value) || 25;
  const s = parseInt(document.getElementById('custom-sec').value) || 0;
  timerSeconds = m*60 + s; timerTotal = timerSeconds;
  clearInterval(timerInterval); timerRunning = false;
  document.querySelector('#timer-display').textContent = formatTime(timerSeconds);
  document.querySelector('.btn-primary[onclick="startStopTimer()"]').textContent = '▶ Start';
  updateTimerRing(1);
}

function startStopTimer() {
  if (timerMode === 'stopwatch') {
    stopwatchRunning = !stopwatchRunning;
    document.querySelector('.btn-primary[onclick="startStopTimer()"]').textContent = stopwatchRunning ? '⏸ Pause' : '▶ Resume';
    if (stopwatchRunning) {
      timerInterval = setInterval(() => {
        stopwatchSeconds++;
        document.querySelector('#timer-display').textContent = formatTime(stopwatchSeconds);
      }, 1000);
    } else { clearInterval(timerInterval); }
    return;
  }
  timerRunning = !timerRunning;
  document.querySelector('.btn-primary[onclick="startStopTimer()"]').textContent = timerRunning ? '⏸ Pause' : '▶ Resume';
  if (timerRunning) {
    timerInterval = setInterval(() => {
      timerSeconds--;
      document.querySelector('#timer-display').textContent = formatTime(timerSeconds);
      updateTimerRing(timerSeconds / timerTotal);
      if (timerSeconds <= 0) {
        clearInterval(timerInterval); timerRunning = false;
        handleTimerComplete();
      }
    }, 1000);
  } else { clearInterval(timerInterval); }
}

function handleTimerComplete() {
  toast('🎉 Session complete!', 'success');
  document.querySelector('.btn-primary[onclick="startStopTimer()"]').textContent = '▶ Start';
  if (timerMode === 'pomodoro') {
    const session = { time: new Date().toLocaleTimeString(), duration: state.settings.pomodoro, habit: focusHabitId ? state.habits.find(h=>h.id===focusHabitId)?.name : 'Focus' };
    state.sessions.unshift(session);
    saveState();
    pomodoroSession++;
    document.getElementById('pomodoro-count-display').textContent = '🍅'.repeat(Math.min(pomodoroSession,4)) + ' &nbsp; Session ' + pomodoroSession;
    renderTimerSessions();
  }
}

function resetTimer() {
  clearInterval(timerInterval); timerRunning = false; stopwatchRunning = false;
  const s = state.settings;
  const MODES = { pomodoro: s.pomodoro*60, short: s.short*60, long: s.long*60, custom: timerTotal, stopwatch: 0 };
  timerSeconds = MODES[timerMode] || s.pomodoro*60;
  timerTotal = timerSeconds; stopwatchSeconds = 0;
  document.querySelector('#timer-display').textContent = timerMode==='stopwatch' ? '00:00' : formatTime(timerSeconds);
  document.querySelector('.btn-primary[onclick="startStopTimer()"]').textContent = '▶ Start';
  updateTimerRing(1);
}

function skipTimer() {
  clearInterval(timerInterval); timerRunning = false;
  handleTimerComplete();
}

function updateTimerRing(fraction) {
  const circ = 565.5;
  const ring = document.getElementById('timer-ring');
  if (ring) ring.style.strokeDashoffset = circ * (1 - fraction);
}

function renderTimerHabitSelect() {
  const container = document.getElementById('timer-habit-select');
  if (!state.habits.length) { container.innerHTML = `<div style="font-size:12px;color:var(--text3);">No habits yet. Add some first.</div>`; return; }
  container.innerHTML = state.habits.map(h => `
    <div class="habit-item" style="padding:8px 12px;cursor:pointer;${focusHabitId===h.id?'background:rgba(108,99,255,0.1);border-color:var(--accent);':''}"
      onclick="selectFocusHabit('${h.id}', this)">
      <span style="font-size:18px;">${h.emoji}</span>
      <div style="flex:1;font-size:12px;font-weight:600;">${h.name}</div>
      ${focusHabitId===h.id ? '<span style="color:var(--accent);font-size:12px;">● Active</span>' : ''}
    </div>
  `).join('');
  renderTimerSessions();
}

function selectFocusHabit(id, el) {
  focusHabitId = focusHabitId === id ? null : id;
  const h = state.habits.find(x => x.id === id);
  document.getElementById('focus-task-label').textContent = focusHabitId ? 'Focusing on: ' + h.name : 'Select a habit to focus on';
  renderTimerHabitSelect();
}

function renderTimerSessions() {
  const log = document.getElementById('timer-sessions-log');
  const empty = document.getElementById('timer-sessions-empty');
  const todaySessions = state.sessions.filter(s => {
    const d = new Date(); return true; // show all for simplicity
  }).slice(0, 8);
  if (!todaySessions.length) { log.innerHTML=''; empty.style.display='block'; return; }
  empty.style.display='none';
  log.innerHTML = todaySessions.map(s => `
    <div style="display:flex;justify-content:space-between;padding:6px 10px;background:var(--surface2);border-radius:6px;font-size:11px;">
      <span>🍅 ${s.habit || 'Focus'}</span>
      <span style="color:var(--text3);">${s.duration}min · ${s.time}</span>
    </div>
  `).join('');
}

// ═══════════════════════════════════════════
//  ANALYTICS
// ═══════════════════════════════════════════
function renderAnalytics() {
  const content = document.getElementById('analytics-content');
  if (!state.habits.length) {
    content.innerHTML = `<div style="text-align:center;padding:64px;color:var(--text3);">
      <div style="font-size:48px;margin-bottom:12px;">📈</div>
      <div style="font-size:16px;">Add habits to see analytics</div>
    </div>`;
    return;
  }
  const now = new Date();
  let html = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px;">`;
  state.habits.forEach(h => {
    const streak = getStreak(h.id);
    const best = getBestStreak(h.id);
    // Last 30 days completion
    let cnt = 0, total = 0;
    for (let i = 0; i < 30; i++) {
      const d = new Date(); d.setDate(d.getDate()-i);
      const dk = dateKey(d);
      total++;
      if (isChecked(dk, h.id)) cnt++;
    }
    const pct = Math.round((cnt/total)*100);
    html += `<div class="chart-section">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
        <span style="font-size:20px;">${h.emoji}</span>
        <div>
          <div style="font-weight:700;font-size:14px;">${h.name}</div>
          <div style="font-size:11px;color:var(--text3);">${CATS[h.category]||''}</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px;">
        <div style="text-align:center;background:var(--surface2);border-radius:8px;padding:10px;">
          <div style="font-size:20px;font-weight:800;color:${h.color};">${pct}%</div>
          <div style="font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;">30-day Rate</div>
        </div>
        <div style="text-align:center;background:var(--surface2);border-radius:8px;padding:10px;">
          <div style="font-size:20px;font-weight:800;color:var(--accent4);">${streak}🔥</div>
          <div style="font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;">Current</div>
        </div>
        <div style="text-align:center;background:var(--surface2);border-radius:8px;padding:10px;">
          <div style="font-size:20px;font-weight:800;color:var(--accent3);">${best}</div>
          <div style="font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;">Best Streak</div>
        </div>
      </div>
      <div class="progress-bar-wrap">
        <div class="progress-bar-fill" style="width:${pct}%;background:${h.color};"></div>
      </div>
    </div>`;
  });
  html += `</div>`;
  content.innerHTML = html;
}

// ═══════════════════════════════════════════
//  SETTINGS
// ═══════════════════════════════════════════
function saveSettings() {
  state.settings.name = document.getElementById('settings-name').value.trim() || 'User';
  state.settings.goal = parseInt(document.getElementById('settings-goal').value) || 10;
  saveState();
  toast('Profile saved ✓', 'success');
  renderAll();
}

function saveTimerSettings() {
  state.settings.pomodoro = parseInt(document.getElementById('settings-pomodoro').value) || 25;
  state.settings.short = parseInt(document.getElementById('settings-short').value) || 5;
  state.settings.long = parseInt(document.getElementById('settings-long').value) || 15;
  state.settings.sessionsBeforeLong = parseInt(document.getElementById('settings-sessions').value) || 4;
  saveState(); toast('Timer settings saved ✓', 'success');
}

function setAccent(el) {
  document.querySelectorAll('.color-pick').forEach(x => x.classList.remove('selected'));
  el.classList.add('selected');
  const c = el.dataset.color;
  document.documentElement.style.setProperty('--accent', c);
  state.settings.accent = c;
  saveState();
}

function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = 'habitflow-backup.json'; a.click();
  toast('Data exported ✓', 'success');
}

function exportCSV() {
  let csv = 'Date,Habit,Done\n';
  Object.keys(state.checks).forEach(k => {
    const [date, id] = k.split(':');
    const h = state.habits.find(x => x.id === id);
    if (h) csv += `${date},"${h.name}",${state.checks[k]}\n`;
  });
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = 'habitflow-data.csv'; a.click();
  toast('CSV exported ✓', 'success');
}

function importDataPrompt() { document.getElementById('import-file').click(); }
function importData(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const parsed = JSON.parse(e.target.result);
      state = { ...state, ...parsed };
      saveState(); renderAll();
      toast('Data imported ✓', 'success');
    } catch { toast('Invalid JSON file', 'error'); }
  };
  reader.readAsText(file);
}

function confirmReset() {
  if (confirm('Are you sure you want to reset ALL data? This cannot be undone.')) {
    localStorage.removeItem('habitflow_state');
    location.reload();
  }
}

// ═══════════════════════════════════════════
//  TOAST
// ═══════════════════════════════════════════
function toast(msg, type='info') {
  const wrap = document.getElementById('toast-wrap');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  const ICONS = { success:'✅', error:'❌', info:'ℹ️' };
  el.innerHTML = `<span>${ICONS[type]||'ℹ️'}</span> ${msg}`;
  wrap.appendChild(el);
  setTimeout(() => { el.style.opacity='0'; el.style.transition='opacity 0.3s'; setTimeout(() => el.remove(), 300); }, 2500);
}

// ═══════════════════════════════════════════
//  GLOBAL RENDER
// ═══════════════════════════════════════════
function renderAll() {
  const active = document.querySelector('.page.active');
  if (active) {
    const id = active.id.replace('page-','');
    if (id==='dashboard') renderDashboard();
    if (id==='tracker') renderTracker();
    if (id==='habits') renderHabitsList();
    if (id==='analytics') renderAnalytics();
  }
}

// ═══════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════
function init() {
  loadState();
  if (state.settings.accent) document.documentElement.style.setProperty('--accent', state.settings.accent);
  // Load settings into form
  document.getElementById('settings-name').value = state.settings.name || 'User';
  document.getElementById('settings-goal').value = state.settings.goal || 10;
  document.getElementById('settings-pomodoro').value = state.settings.pomodoro || 25;
  document.getElementById('settings-short').value = state.settings.short || 5;
  document.getElementById('settings-long').value = state.settings.long || 15;
  document.getElementById('settings-sessions').value = state.settings.sessionsBeforeLong || 4;
  startClock();
  renderDashboard();
  // Auto-add sample habits if first time
  if (!state.habits.length && !localStorage.getItem('habitflow_welcomed')) {
    localStorage.setItem('habitflow_welcomed','1');
    const samples = [
      { name:'Wake up at 05:00', emoji:'🌅', category:'health', color:'#f6d365' },
      { name:'Gym', emoji:'💪', category:'health', color:'#43e97b' },
      { name:'Reading / Learning', emoji:'📚', category:'mind', color:'#6c63ff' },
      { name:'Day Planning', emoji:'📝', category:'productivity', color:'#38bdf8' },
      { name:'Cold Shower', emoji:'🚿', category:'wellbeing', color:'#a78bfa' },
      { name:'No Social Media', emoji:'📵', category:'wellbeing', color:'#ff6584' },
      { name:'Budget Tracking', emoji:'💰', category:'finance', color:'#fb923c' },
    ];
    samples.forEach(s => state.habits.push({ ...s, id: uid(), note:'', createdAt: todayKey() }));
    saveState();
    renderDashboard();
    toast('Welcome! Sample habits added 🎉', 'success');
  }
}

document.addEventListener('DOMContentLoaded', init);
document.getElementById('habit-modal').addEventListener('click', function(e) {
  if (e.target === this) closeModal('habit-modal');
});
