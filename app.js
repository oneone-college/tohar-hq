/* ============================================
   Tohar HQ v2 — App Logic (Gold on Black)
   ============================================ */

const STORAGE_KEY = 'tohar-hq-v2';

const CATEGORIES = {
  work:       { name: 'עבודה (ONE/ONE)' },
  dj:         { name: 'DJ' },
  production: { name: 'הפקה' },
  content:    { name: 'תוכן ושיווק' },
  fitness:    { name: 'כושר' },
  learning:   { name: 'לימודים' },
  meetings:   { name: 'פגישות' },
  travel:     { name: 'חו"ל' },
};

const DEFAULT_TEMPLATES = [
  {
    id: 'day-dj',
    name: '🎧 יום DJ',
    tasks: [
      { title: 'צילום סטורי לפני האירוע', startTime: '17:00', endTime: '17:30', category: 'content' },
      { title: 'בדיקת ציוד + נסיעה', startTime: '18:00', endTime: '20:00', category: 'dj' },
      { title: 'אירוע DJ', startTime: '20:00', endTime: '23:30', category: 'dj' },
      { title: 'סטוריז + ארגון אחרי', startTime: '23:30', endTime: '00:00', category: 'content' },
    ],
  },
  {
    id: 'day-production',
    name: '🎹 יום הפקה',
    tasks: [
      { title: 'סשן הפקה עם עוז', startTime: '17:00', endTime: '19:00', category: 'production' },
      { title: 'עריכה / סיום פרודקשן', startTime: '20:00', endTime: '22:00', category: 'production' },
    ],
  },
  {
    id: 'day-content',
    name: '📱 יום תוכן',
    tasks: [
      { title: 'צילום רילס/סטורי', startTime: '10:00', endTime: '11:30', category: 'content' },
      { title: 'עריכת תוכן', startTime: '14:00', endTime: '15:30', category: 'content' },
      { title: 'העלאה לאינסטה + תיוגים', startTime: '18:00', endTime: '18:30', category: 'content' },
    ],
  },
];

let state = {
  tasks: [],
  inbox: [],
  goals: [],
  streaks: {
    mitCurrent: 0,
    mitBest: 0,
    mitLastDate: null,
    mitFreezeUsedAt: null,
    dailyCurrent: 0,
    dailyBest: 0,
    dailyLastDate: null,
  },
  weeklySummary: { lastShown: null },
};

// Migrate from v1 if exists
(function migrate() {
  if (!localStorage.getItem(STORAGE_KEY)) {
    const v1 = localStorage.getItem('tohar-hq-v1');
    if (v1) {
      try {
        const old = JSON.parse(v1);
        const migrated = {
          tasks: old.tasks || [],
          inbox: old.inbox || [],
          goals: old.goals || [],
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      } catch (e) {}
    }
  }
})();

// ============ Helpers ============
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const formatDateHe = (date) => {
  const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  const months = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
  return `יום ${days[date.getDay()]} · ${date.getDate()} ב${months[date.getMonth()]}`;
};

const greeting = () => {
  const h = new Date().getHours();
  if (h < 6)  return 'לילה טוב, טהר';
  if (h < 12) return 'בוקר טוב, טהר';
  if (h < 18) return 'אחר הצהריים, טהר';
  if (h < 22) return 'ערב טוב, טהר';
  return 'לילה טוב, טהר';
};

const uuid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
const timeToMin = (t) => { if (!t) return 99999; const [h, m] = t.split(':').map(Number); return h * 60 + m; };

// ============ Persistence ============
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) state = { ...state, ...JSON.parse(raw) };
  } catch (e) { console.warn('load failed', e); }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) { console.warn('save failed', e); }
}

// ============ UX helpers ============
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2200);
}

function confettiBurst(x, y) {
  const colors = ['#c9a572', '#d4b388', '#8a7250', '#f5e3c4'];
  for (let i = 0; i < 18; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti';
    piece.style.left = x + 'px';
    piece.style.top = y + 'px';
    piece.style.background = colors[i % colors.length];
    const angle = (Math.PI * 2 * i) / 18;
    const dist = 70 + Math.random() * 70;
    piece.style.setProperty('--tx', `${Math.cos(angle) * dist}px`);
    piece.style.setProperty('--ty', `${Math.sin(angle) * dist - 30}px`);
    document.body.appendChild(piece);
    setTimeout(() => piece.remove(), 1200);
  }
}

function buzz(p = 10) {
  if (navigator.vibrate) navigator.vibrate(p);
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ============ Streaks ============
function dateAddDays(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function isSameOrAfter(a, b) { return a >= b; }

// Recalculate streaks fresh from history
function recomputeStreaks() {
  const s = state.streaks;
  const today = todayStr();
  const yesterday = dateAddDays(today, -1);

  // ----- MIT streak -----
  // Find all dates that had a completed MIT, sorted desc
  const mitDates = Array.from(new Set(
    state.tasks
      .filter(t => t.isMit && t.done && t.date)
      .map(t => t.date)
  )).sort().reverse();

  let mitStreak = 0;
  let cursor = today;
  let hasFreezeUsed = false;

  // Only count streak if today or yesterday has a completed MIT
  if (mitDates[0] === today || mitDates[0] === yesterday) {
    cursor = mitDates[0];
    mitStreak = 1;
    for (let i = 1; i < mitDates.length; i++) {
      const expected = dateAddDays(cursor, -1);
      if (mitDates[i] === expected) {
        mitStreak++;
        cursor = mitDates[i];
      } else if (mitDates[i] === dateAddDays(cursor, -2) && !hasFreezeUsed) {
        // Allow 1 freeze in the streak (skipping 1 day)
        mitStreak++;
        cursor = mitDates[i];
        hasFreezeUsed = true;
      } else {
        break;
      }
    }
    // Extend cursor forward to today if last completed was yesterday
    if (mitDates[0] === yesterday && !state.tasks.some(t => t.date === today && t.isMit && t.done)) {
      // streak is intact through yesterday — still counts
    }
  }

  s.mitCurrent = mitStreak;
  if (mitStreak > (s.mitBest || 0)) s.mitBest = mitStreak;

  // ----- Daily streak (any task completed) -----
  const dailyDates = Array.from(new Set(
    state.tasks
      .filter(t => t.done && t.date)
      .map(t => t.date)
  )).sort().reverse();

  let dailyStreak = 0;
  if (dailyDates[0] === today || dailyDates[0] === yesterday) {
    dailyStreak = 1;
    let c = dailyDates[0];
    for (let i = 1; i < dailyDates.length; i++) {
      const expected = dateAddDays(c, -1);
      if (dailyDates[i] === expected) {
        dailyStreak++;
        c = dailyDates[i];
      } else {
        break;
      }
    }
  }

  s.dailyCurrent = dailyStreak;
  if (dailyStreak > (s.dailyBest || 0)) s.dailyBest = dailyStreak;
}

function renderStreaks() {
  recomputeStreaks();
  const s = state.streaks;
  $('#streak-mit-current').textContent = s.mitCurrent || 0;
  $('#streak-mit-best').textContent = s.mitBest > 0 ? `שיא: ${s.mitBest}` : '';
  $('#streak-daily-current').textContent = s.dailyCurrent || 0;
  $('#streak-daily-best').textContent = s.dailyBest > 0 ? `שיא: ${s.dailyBest}` : '';
}

// ============ Hero ============
function renderHero() {
  $('#hero-greeting').textContent = greeting();
  $('#hero-date').textContent = formatDateHe(new Date());
}

// ============ MIT ============
function renderMIT() {
  const today = todayStr();
  const mit = state.tasks.find(t => t.date === today && t.isMit);
  const card = $('#mit-card');
  const empty = $('#mit-empty');
  const content = $('#mit-content');

  if (!mit) {
    empty.style.display = 'block';
    content.style.display = 'none';
    card.classList.remove('completed');
    return;
  }

  empty.style.display = 'none';
  content.style.display = 'block';
  $('#mit-title').textContent = mit.title;
  $('#mit-time').textContent = mit.startTime && mit.endTime
    ? `${mit.startTime} — ${mit.endTime}`
    : 'בלי שעה מוגדרת';

  if (mit.done) {
    card.classList.add('completed');
    $('#mit-btn').textContent = '✓ בוצע!';
  } else {
    card.classList.remove('completed');
    $('#mit-btn').textContent = 'סמן כבוצע';
  }
}

$('#mit-btn').addEventListener('click', (e) => {
  const today = todayStr();
  const mit = state.tasks.find(t => t.date === today && t.isMit);
  if (!mit || mit.done) return;

  mit.done = true;
  mit.doneAt = new Date().toISOString();
  saveState();
  renderAll();

  const rect = e.target.getBoundingClientRect();
  confettiBurst(rect.left + rect.width / 2, rect.top + rect.height / 2);
  buzz([20, 40, 20]);
  toast('🔥 MIT הושלם');
});

// ============ Tasks ============
function renderTasks() {
  const today = todayStr();
  const todays = state.tasks
    .filter(t => t.date === today)
    .sort((a, b) => {
      if (a.isMit && !b.isMit) return -1;
      if (!a.isMit && b.isMit) return 1;
      return timeToMin(a.startTime) - timeToMin(b.startTime);
    });

  const list = $('#tasks-list');
  const empty = $('#tasks-empty');
  const count = $('#tasks-count');

  count.textContent = todays.length > 0 ? `${todays.filter(t => t.done).length}/${todays.length}` : '0';

  if (todays.length === 0) {
    list.innerHTML = '';
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';
  list.innerHTML = '';

  todays.forEach(task => {
    const item = document.createElement('div');
    item.className = 'task-item' + (task.done ? ' done' : '') + (task.isMit ? ' mit' : '');

    const timeStr = task.startTime || '';

    item.innerHTML = `
      <div class="task-checkbox" data-action="toggle"></div>
      <div class="task-content">
        <div class="task-text">${escapeHtml(task.title)}</div>
      </div>
      ${timeStr ? `<span class="task-time">${timeStr}</span>` : ''}
      <button class="task-star ${task.isMit ? 'active' : ''}" data-action="star" aria-label="MIT">★</button>
      <button class="task-delete" data-action="delete" aria-label="מחק">×</button>
    `;

    item.addEventListener('click', (e) => {
      const action = e.target.dataset.action || e.target.closest('[data-action]')?.dataset.action;
      if (action === 'toggle') toggleTaskDone(task.id);
      else if (action === 'star') toggleMIT(task.id);
      else if (action === 'delete') {
        if (confirm(`למחוק "${task.title}"?`)) deleteTask(task.id);
      }
    });

    list.appendChild(item);
  });
}

function toggleTaskDone(id) {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;
  task.done = !task.done;
  task.doneAt = task.done ? new Date().toISOString() : null;
  buzz(15);
  saveState();
  renderAll();
}

function toggleMIT(id) {
  const today = todayStr();
  state.tasks.forEach(t => {
    if (t.date === today && t.id !== id) t.isMit = false;
  });
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;
  task.isMit = !task.isMit;
  buzz(20);
  saveState();
  renderAll();
  if (task.isMit) toast('זאת המשימה הכי חשובה היום');
}

function deleteTask(id) {
  state.tasks = state.tasks.filter(t => t.id !== id);
  saveState();
  renderAll();
}

// ============ Inbox ============
function renderInbox() {
  const list = $('#inbox-list');
  const empty = $('#inbox-empty');
  const badge = $('#inbox-badge');

  if (state.inbox.length > 0) {
    badge.style.display = 'block';
    badge.textContent = state.inbox.length;
  } else {
    badge.style.display = 'none';
  }

  if (state.inbox.length === 0) {
    list.innerHTML = '';
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';
  list.innerHTML = '';

  state.inbox
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt)
    .forEach(item => {
      const el = document.createElement('div');
      el.className = 'inbox-item';
      const dateStr = relativeDate(new Date(item.createdAt));
      el.innerHTML = `
        <div class="inbox-item-content">${escapeHtml(item.content)}</div>
        <span class="inbox-item-date">${dateStr}</span>
      `;
      el.addEventListener('click', () => openInboxAction(item));
      list.appendChild(el);
    });
}

function relativeDate(date) {
  const diffMin = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diffMin < 1) return 'עכשיו';
  if (diffMin < 60) return `${diffMin} ד׳`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH} ש׳`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD} י׳`;
  return `${date.getDate()}/${date.getMonth() + 1}`;
}

function addToInbox(content) {
  if (!content || !content.trim()) return;
  state.inbox.push({
    id: uuid(),
    content: content.trim(),
    createdAt: Date.now(),
  });
  buzz(10);
  saveState();
  renderInbox();
  toast('נוסף ל-Inbox');
}

$('#inbox-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = $('#inbox-input');
  addToInbox(input.value);
  input.value = '';
});

// ============ Inbox Action ============
let inboxActionTarget = null;

function openInboxAction(item) {
  inboxActionTarget = item;
  $('#inbox-action-item').textContent = item.content;
  $('#inbox-action-date').value = todayStr();
  $('#inbox-action-backdrop').classList.add('open');
}

$('#inbox-action-close').addEventListener('click', () => closeInboxAction());

$('#inbox-action-backdrop').addEventListener('click', (e) => {
  if (e.target === $('#inbox-action-backdrop')) closeInboxAction();
});

function closeInboxAction() {
  $('#inbox-action-backdrop').classList.remove('open');
  inboxActionTarget = null;
}

$('#inbox-action-form').addEventListener('submit', (e) => {
  e.preventDefault();
  if (!inboxActionTarget) return;

  state.tasks.push({
    id: uuid(),
    title: inboxActionTarget.content,
    date: $('#inbox-action-date').value,
    startTime: $('#inbox-action-start').value,
    endTime: $('#inbox-action-end').value,
    category: $('#inbox-action-category').value,
    isMit: false,
    done: false,
    createdAt: Date.now(),
  });

  state.inbox = state.inbox.filter(i => i.id !== inboxActionTarget.id);
  saveState();
  closeInboxAction();
  renderAll();
  toast('תוזמן בהצלחה');
});

$('#inbox-mark-done').addEventListener('click', () => {
  if (!inboxActionTarget) return;
  state.inbox = state.inbox.filter(i => i.id !== inboxActionTarget.id);
  saveState();
  closeInboxAction();
  renderInbox();
  toast('בוצע');
});

$('#inbox-delete').addEventListener('click', () => {
  if (!inboxActionTarget) return;
  if (!confirm('למחוק?')) return;
  state.inbox = state.inbox.filter(i => i.id !== inboxActionTarget.id);
  saveState();
  closeInboxAction();
  renderInbox();
});

// ============ Goals ============
function renderGoals() {
  ['dream', 'year', '3month', 'week'].forEach(scope => {
    const list = $(`#goals-${scope}`);
    list.innerHTML = '';

    const goals = state.goals.filter(g => g.scope === scope);
    if (goals.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'padding: 20px 4px; color: var(--text-faint); font-size: 13px; font-style: italic;';
      empty.textContent = scope === 'dream' ? 'תוסיף חלום אחד שלך' : 'אין מטרות עדיין';
      list.appendChild(empty);
      return;
    }

    goals.forEach(goal => {
      const el = document.createElement('div');
      el.className = 'goal-item' + (goal.done ? ' done' : '');
      el.innerHTML = `
        <div class="goal-check" data-action="check"></div>
        <div class="goal-text">${escapeHtml(goal.title)}</div>
        <button class="goal-delete" data-action="delete">×</button>
      `;
      el.addEventListener('click', (e) => {
        const action = e.target.dataset.action || e.target.closest('[data-action]')?.dataset.action;
        if (action === 'check') toggleGoal(goal.id, e);
        else if (action === 'delete') {
          if (confirm(`למחוק "${goal.title}"?`)) {
            state.goals = state.goals.filter(g => g.id !== goal.id);
            saveState();
            renderGoals();
          }
        }
      });
      list.appendChild(el);
    });
  });
}

function toggleGoal(id, evt) {
  const goal = state.goals.find(g => g.id === id);
  if (!goal) return;
  goal.done = !goal.done;
  goal.doneAt = goal.done ? new Date().toISOString() : null;
  buzz(20);
  saveState();
  renderGoals();
  if (goal.done) {
    toast('🎉 השגת מטרה!');
    if (evt) {
      const rect = evt.target.getBoundingClientRect();
      confettiBurst(rect.left + rect.width / 2, rect.top + rect.height / 2);
    }
  }
}

$$('.goals-add').forEach(btn => {
  btn.addEventListener('click', () => {
    const scope = btn.dataset.scope;
    const labels = {
      dream: 'מה החלום שלך?',
      year: 'מטרה לשנה?',
      '3month': 'מטרה ל-3 חודשים?',
      week: 'מטרה לשבוע?',
    };
    const title = prompt(labels[scope]);
    if (!title || !title.trim()) return;
    state.goals.push({
      id: uuid(),
      title: title.trim(),
      scope,
      done: false,
      createdAt: Date.now(),
    });
    saveState();
    renderGoals();
    toast('נוסף');
  });
});

// ============ Week View ============
function renderWeek() {
  const grid = $('#week-grid');
  grid.innerHTML = '';
  const days = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
  const today = new Date();
  const todayStrVal = todayStr();
  const start = new Date(today);
  start.setDate(today.getDate() - today.getDay());

  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    const col = document.createElement('div');
    col.className = 'week-day' + (dateStr === todayStrVal ? ' today' : '');

    const header = document.createElement('div');
    header.className = 'week-day-header';
    header.innerHTML = `
      <div class="week-day-name">${days[i]}</div>
      <div class="week-day-num">${d.getDate()}</div>
    `;
    col.appendChild(header);

    const dayTasks = state.tasks
      .filter(t => t.date === dateStr)
      .sort((a, b) => timeToMin(a.startTime) - timeToMin(b.startTime));

    dayTasks.forEach(task => {
      const t = document.createElement('div');
      t.className = 'week-day-task';
      t.textContent = `${task.startTime || ''} ${task.title}`.trim();
      col.appendChild(t);
    });

    grid.appendChild(col);
  }
}

// ============ Tabs Navigation ============
$$('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const view = tab.dataset.view;
    $$('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    $$('.view').forEach(v => v.classList.remove('active'));
    $(`#view-${view}`).classList.add('active');
    buzz(8);
    if (view === 'week') renderWeek();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
});

// ============ FAB & Modal ============
$('#fab').addEventListener('click', () => {
  $('#modal-title').value = '';
  $('#modal-backdrop').classList.add('open');
  setTimeout(() => $('#modal-title').focus(), 100);
  buzz(10);
});

$('#modal-close').addEventListener('click', closeModal);

$('#modal-backdrop').addEventListener('click', (e) => {
  if (e.target === $('#modal-backdrop')) closeModal();
});

function closeModal() {
  $('#modal-backdrop').classList.remove('open');
}

let modalMode = 'inbox';
let selectedTemplate = null;

$$('.modal-tab').forEach(t => {
  t.addEventListener('click', () => {
    modalMode = t.dataset.modalTab;
    $$('.modal-tab').forEach(tt => tt.classList.remove('active'));
    t.classList.add('active');
    $('#modal-task-fields').style.display = modalMode === 'task' ? 'flex' : 'none';
    $('#modal-template-fields').style.display = modalMode === 'template' ? 'flex' : 'none';
    const titleInput = $('#modal-title');
    titleInput.style.display = modalMode === 'template' ? 'none' : 'block';
    titleInput.required = modalMode !== 'template';
    $('#modal-submit-btn').textContent = modalMode === 'template' ? 'החל טמפלייט' : 'שמור';
    if (modalMode === 'template') {
      renderTemplateOptions();
      $('#modal-template-date').value = todayStr();
    }
  });
});

function renderTemplateOptions() {
  const container = $('#template-options');
  container.innerHTML = '';
  selectedTemplate = null;

  DEFAULT_TEMPLATES.forEach(tpl => {
    const el = document.createElement('div');
    el.className = 'template-option';
    el.dataset.id = tpl.id;
    el.innerHTML = `
      <div class="template-option-title">${escapeHtml(tpl.name)}</div>
      <div class="template-option-tasks">${tpl.tasks.length} משימות · ${tpl.tasks.map(t => t.title).join(' · ')}</div>
    `;
    el.addEventListener('click', () => {
      $$('.template-option').forEach(o => o.classList.remove('selected'));
      el.classList.add('selected');
      selectedTemplate = tpl;
    });
    container.appendChild(el);
  });

  // Auto-select first
  const first = container.querySelector('.template-option');
  if (first) {
    first.classList.add('selected');
    selectedTemplate = DEFAULT_TEMPLATES[0];
  }
}

function applyTemplate(tpl, date) {
  if (!tpl) return;
  tpl.tasks.forEach(t => {
    state.tasks.push({
      id: uuid(),
      title: t.title,
      date,
      startTime: t.startTime,
      endTime: t.endTime,
      category: t.category,
      isMit: false,
      done: false,
      createdAt: Date.now(),
    });
  });
  buzz(20);
  saveState();
  renderAll();
  toast(`${tpl.name} נוסף · ${tpl.tasks.length} משימות`);
}

$('#modal-form').addEventListener('submit', (e) => {
  e.preventDefault();

  if (modalMode === 'template') {
    if (!selectedTemplate) {
      toast('בחר טמפלייט');
      return;
    }
    const date = $('#modal-template-date').value || todayStr();
    applyTemplate(selectedTemplate, date);
    closeModal();
    return;
  }

  const title = $('#modal-title').value.trim();
  if (!title) return;

  if (modalMode === 'inbox') {
    addToInbox(title);
  } else {
    state.tasks.push({
      id: uuid(),
      title,
      date: todayStr(),
      startTime: $('#modal-start-time').value,
      endTime: $('#modal-end-time').value,
      category: $('#modal-category').value,
      isMit: false,
      done: false,
      createdAt: Date.now(),
    });
    buzz(15);
    saveState();
    renderAll();
    toast('משימה נוספה');
  }
  closeModal();
});

// ============ Weekly Summary ============
function getWeekRange(forDate = new Date()) {
  // Week starts Sunday in IL convention
  const d = new Date(forDate);
  const day = d.getDay();
  const sunday = new Date(d);
  sunday.setDate(d.getDate() - day);
  sunday.setHours(0, 0, 0, 0);
  const saturday = new Date(sunday);
  saturday.setDate(sunday.getDate() + 6);
  saturday.setHours(23, 59, 59, 999);
  return { start: sunday, end: saturday };
}

function dateStrOf(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function computeWeeklyStats(weekStart, weekEnd) {
  const startStr = dateStrOf(weekStart);
  const endStr = dateStrOf(weekEnd);
  const weekTasks = state.tasks.filter(t => t.date >= startStr && t.date <= endStr);
  const done = weekTasks.filter(t => t.done);
  const mitDone = weekTasks.filter(t => t.isMit && t.done).length;

  // Hours per category
  const catMinutes = {};
  done.forEach(t => {
    if (t.startTime && t.endTime) {
      const min = timeToMin(t.endTime) - timeToMin(t.startTime);
      if (min > 0) catMinutes[t.category || 'other'] = (catMinutes[t.category || 'other'] || 0) + min;
    }
  });

  const goalsWeek = state.goals.filter(g => g.scope === 'week');
  const goalsDone = goalsWeek.filter(g => g.done).length;

  return {
    totalTasks: weekTasks.length,
    doneTasks: done.length,
    mitDone,
    catMinutes,
    goalsWeek: goalsWeek.length,
    goalsDone,
  };
}

function maybeShowWeeklySummary() {
  // Show on Sunday if not shown today yet
  const today = new Date();
  if (today.getDay() !== 0) return;
  const todayKey = todayStr();
  if (state.weeklySummary.lastShown === todayKey) return;

  // Compute for last week (Sun-Sat that just ended)
  const lastSunday = new Date(today);
  lastSunday.setDate(today.getDate() - 7);
  const { start, end } = getWeekRange(lastSunday);

  const stats = computeWeeklyStats(start, end);
  if (stats.totalTasks === 0 && stats.goalsWeek === 0) return; // skip if empty week

  renderWeeklySummary(stats);
  $('#weekly-summary-backdrop').classList.add('open');
}

function renderWeeklySummary(stats) {
  const container = $('#weekly-content');
  const pct = stats.totalTasks > 0 ? Math.round((stats.doneTasks / stats.totalTasks) * 100) : 0;

  let html = `
    <div class="weekly-hero">
      <div class="weekly-hero-num">${stats.doneTasks}/${stats.totalTasks}</div>
      <div class="weekly-hero-label">משימות הושלמו (${pct}%)</div>
    </div>
    <div class="weekly-row">
      <span class="weekly-row-label">🎯 MIT שהשלמת</span>
      <span class="weekly-row-value">${stats.mitDone}</span>
    </div>
    <div class="weekly-row">
      <span class="weekly-row-label">📅 מטרות שבוע</span>
      <span class="weekly-row-value">${stats.goalsDone}/${stats.goalsWeek}</span>
    </div>
  `;

  // Categories breakdown
  const catEntries = Object.entries(stats.catMinutes).sort((a, b) => b[1] - a[1]);
  if (catEntries.length > 0) {
    const maxMin = catEntries[0][1];
    html += `<div class="weekly-categories">`;
    html += `<div class="weekly-row-label" style="font-size:11px; letter-spacing:1px; text-transform:uppercase; color:var(--text-dim); margin-top:8px; margin-bottom:4px;">שעות לפי תחום</div>`;
    catEntries.forEach(([cat, min]) => {
      const hours = (min / 60).toFixed(1).replace(/\.0$/, '');
      const pct = (min / maxMin) * 100;
      const catName = (CATEGORIES[cat] && CATEGORIES[cat].name) || cat;
      html += `
        <div class="weekly-cat-row">
          <span class="weekly-cat-name">${catName}</span>
          <span class="weekly-cat-bar"><span class="weekly-cat-fill" style="width:${pct}%"></span></span>
          <span class="weekly-cat-val">${hours}ש׳</span>
        </div>
      `;
    });
    html += `</div>`;
  }

  // Streak callout
  if (state.streaks.mitBest > 0) {
    html += `
      <div class="weekly-row">
        <span class="weekly-row-label">🔥 MIT streak שיא</span>
        <span class="weekly-row-value">${state.streaks.mitBest}</span>
      </div>
    `;
  }

  container.innerHTML = html;
}

$('#weekly-close').addEventListener('click', () => closeWeekly());
$('#weekly-dismiss').addEventListener('click', () => closeWeekly());
$('#weekly-summary-backdrop').addEventListener('click', (e) => {
  if (e.target === $('#weekly-summary-backdrop')) closeWeekly();
});

function closeWeekly() {
  $('#weekly-summary-backdrop').classList.remove('open');
  state.weeklySummary.lastShown = todayStr();
  saveState();
}

// ============ PWA Install ============
let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  if (!localStorage.getItem('install-dismissed')) {
    setTimeout(() => { $('#install-prompt').style.display = 'flex'; }, 6000);
  }
});

$('#install-btn').addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
  $('#install-prompt').style.display = 'none';
  if (outcome === 'accepted') toast('🎉 האפליקציה הותקנה');
});

$('#install-dismiss').addEventListener('click', () => {
  $('#install-prompt').style.display = 'none';
  localStorage.setItem('install-dismissed', '1');
});

// ============ Service Worker ============
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  });
}

// ============ Keyboard Shortcuts ============
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
    e.preventDefault();
    $('#fab').click();
  }
  if (e.key === 'Escape') {
    if ($('#modal-backdrop').classList.contains('open')) closeModal();
    if ($('#inbox-action-backdrop').classList.contains('open')) closeInboxAction();
    if ($('#weekly-summary-backdrop').classList.contains('open')) closeWeekly();
  }
});

// ============ Init ============
function renderAll() {
  renderHero();
  renderStreaks();
  renderMIT();
  renderTasks();
  renderInbox();
  renderGoals();
}

loadState();
renderAll();
maybeShowWeeklySummary();

setInterval(() => {
  renderHero();
}, 60_000);

// Debug helper: window.tohar.forceWeekly() to test the summary
window.tohar = {
  state: () => state,
  forceWeekly: () => {
    state.weeklySummary.lastShown = null;
    const today = new Date();
    const lastSunday = new Date(today);
    lastSunday.setDate(today.getDate() - 7);
    const { start, end } = getWeekRange(lastSunday);
    const stats = computeWeeklyStats(start, end);
    renderWeeklySummary(stats);
    $('#weekly-summary-backdrop').classList.add('open');
  },
  reset: () => {
    if (confirm('למחוק את כל הנתונים?')) {
      localStorage.removeItem(STORAGE_KEY);
      location.reload();
    }
  },
};
