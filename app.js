/* ============================================
   Tohar HQ — Main App Logic
   Stores state in localStorage. Supabase comes later.
   ============================================ */

// ============ State ============
const STORAGE_KEY = 'tohar-hq-v1';

const CATEGORIES = {
  work:       { name: 'עבודה (ONE/ONE)', icon: '🏢', color: 'var(--cat-work)' },
  dj:         { name: 'DJ',              icon: '🎧', color: 'var(--cat-dj)' },
  production: { name: 'הפקה',           icon: '🎹', color: 'var(--cat-production)' },
  content:    { name: 'תוכן ושיווק',     icon: '📱', color: 'var(--cat-content)' },
  fitness:    { name: 'כושר',           icon: '💪', color: 'var(--cat-fitness)' },
  learning:   { name: 'לימודים',        icon: '📚', color: 'var(--cat-learning)' },
  meetings:   { name: 'פגישות',          icon: '💬', color: 'var(--cat-meetings)' },
  travel:     { name: 'חו"ל',           icon: '✈️', color: 'var(--cat-travel)' },
};

let state = {
  tasks: [],          // {id, title, date, startTime, endTime, category, urgent, isMit, done, doneAt, createdAt}
  inbox: [],          // {id, content, createdAt}
  goals: [],          // {id, title, scope, done, doneAt, createdAt}
  journal: {},        // {dateStr: text}
  streak: 0,
  lastCompletedDate: null,
};

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
  return `יום ${days[date.getDay()]}, ${date.getDate()} ב${months[date.getMonth()]}`;
};

const greeting = () => {
  const h = new Date().getHours();
  if (h < 6)  return 'לילה טוב, טהר 🌙';
  if (h < 12) return 'בוקר טוב, טהר ☀️';
  if (h < 18) return 'אחר הצהריים, טהר ✨';
  if (h < 22) return 'ערב טוב, טהר 🌅';
  return 'לילה טוב, טהר 🌙';
};

const uuid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const timeToMinutes = (t) => {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

// ============ Persistence ============
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const loaded = JSON.parse(raw);
      state = { ...state, ...loaded };
    }
  } catch (e) {
    console.warn('Failed to load state:', e);
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Failed to save state:', e);
  }
}

// ============ Toast ============
function toast(message, type = '') {
  const el = $('#toast');
  el.textContent = message;
  el.className = `toast show ${type}`;
  setTimeout(() => el.classList.remove('show'), 2400);
}

// ============ Confetti ============
function confettiBurst(x, y) {
  const colors = ['#b34dff', '#ff4d8d', '#ffc850', '#4ade80', '#4dd2ff', '#ff8c4d'];
  for (let i = 0; i < 24; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti';
    piece.style.left = x + 'px';
    piece.style.top = y + 'px';
    piece.style.background = colors[i % colors.length];
    const angle = (Math.PI * 2 * i) / 24;
    const dist = 80 + Math.random() * 80;
    piece.style.setProperty('--tx', `${Math.cos(angle) * dist}px`);
    piece.style.setProperty('--ty', `${Math.sin(angle) * dist - 40}px`);
    document.body.appendChild(piece);
    setTimeout(() => piece.remove(), 1200);
  }
}

// ============ Haptic ============
function buzz(pattern = 10) {
  if (navigator.vibrate) navigator.vibrate(pattern);
}

// ============ Hero & Stats ============
function renderHero() {
  $('#hero-greeting').textContent = greeting();
  $('#hero-date').textContent = formatDateHe(new Date());
}

function renderStats() {
  const today = todayStr();
  const todays = state.tasks.filter(t => t.date === today);
  const done = todays.filter(t => t.done).length;
  $('#stat-tasks-done').textContent = done;
  $('#stat-tasks-total').textContent = `מתוך ${todays.length}`;

  // Next event
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const upcoming = todays
    .filter(t => !t.done && t.startTime && timeToMinutes(t.startTime) >= nowMin)
    .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
  if (upcoming.length > 0) {
    $('#stat-next-time').textContent = upcoming[0].startTime;
    $('#stat-next-name').textContent = upcoming[0].title.slice(0, 18);
  } else {
    $('#stat-next-time').textContent = '—';
    $('#stat-next-name').textContent = 'אין אירוע קרוב';
  }

  // Hours planned today
  const totalMin = todays.reduce((sum, t) => {
    if (t.startTime && t.endTime) {
      return sum + (timeToMinutes(t.endTime) - timeToMinutes(t.startTime));
    }
    return sum;
  }, 0);
  const hours = (totalMin / 60).toFixed(1).replace(/\.0$/, '');
  $('#stat-hours').textContent = hours;

  // Streak
  $('#stat-streak').textContent = state.streak || 0;
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
  $('#mit-task').textContent = mit.title;
  $('#mit-meta').textContent = mit.startTime && mit.endTime
    ? `⏰ ${mit.startTime} – ${mit.endTime}`
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
  if (!mit) return;
  if (mit.done) return;

  mit.done = true;
  mit.doneAt = new Date().toISOString();
  updateStreak();
  saveState();
  renderAll();

  const rect = e.target.getBoundingClientRect();
  confettiBurst(rect.left + rect.width / 2, rect.top + rect.height / 2);
  buzz([20, 40, 20]);
  toast('🔥 MIT הושלם! יום אחד יותר טוב 🎯', 'success');
});

// ============ Streak ============
function updateStreak() {
  const today = todayStr();
  const todays = state.tasks.filter(t => t.date === today);
  const allDone = todays.length > 0 && todays.every(t => t.done);

  if (allDone && state.lastCompletedDate !== today) {
    // Check if yesterday was also completed
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const ystr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

    if (state.lastCompletedDate === ystr) {
      state.streak = (state.streak || 0) + 1;
    } else {
      state.streak = 1;
    }
    state.lastCompletedDate = today;
  }
}

// ============ Timeline ============
function renderTimeline() {
  const today = todayStr();
  const todays = state.tasks
    .filter(t => t.date === today)
    .sort((a, b) => timeToMinutes(a.startTime || '00:00') - timeToMinutes(b.startTime || '00:00'));

  const container = $('#timeline');
  container.innerHTML = '';

  // Render hours 07:00 - 23:00
  for (let h = 7; h <= 23; h++) {
    const row = document.createElement('div');
    row.className = 'timeline-hour';

    const label = document.createElement('div');
    label.className = 'timeline-hour-label';
    label.textContent = `${String(h).padStart(2, '0')}:00`;

    const content = document.createElement('div');
    content.className = 'timeline-hour-content';

    // Find tasks that start in this hour
    const hourTasks = todays.filter(t => {
      if (!t.startTime) return false;
      const startH = parseInt(t.startTime.split(':')[0], 10);
      return startH === h;
    });

    hourTasks.forEach(task => {
      const block = document.createElement('div');
      block.className = 'timeline-block' + (task.done ? ' done' : '');
      block.dataset.cat = task.category || 'work';
      const cat = CATEGORIES[task.category] || CATEGORIES.work;
      block.innerHTML = `
        <span class="timeline-block-icon">${cat.icon}</span>
        <span class="timeline-block-title">${escapeHtml(task.title)}</span>
        <span class="timeline-block-time">${task.startTime || ''}${task.endTime ? '–' + task.endTime : ''}</span>
      `;
      block.addEventListener('click', () => toggleTaskDone(task.id));
      content.appendChild(block);
    });

    row.appendChild(label);
    row.appendChild(content);
    container.appendChild(row);
  }

  // Add "now" line
  const now = new Date();
  const nowH = now.getHours();
  const nowM = now.getMinutes();
  if (nowH >= 7 && nowH <= 23) {
    const hourEls = container.querySelectorAll('.timeline-hour');
    const targetEl = hourEls[nowH - 7];
    if (targetEl) {
      const line = document.createElement('div');
      line.className = 'timeline-now-line';
      const offset = (nowM / 60) * targetEl.offsetHeight;
      line.style.top = (targetEl.offsetTop + offset) + 'px';
      container.appendChild(line);
    }
  }
}

// ============ Tasks ============
function renderTasks() {
  const today = todayStr();
  const todays = state.tasks
    .filter(t => t.date === today)
    .sort((a, b) => {
      // MIT first
      if (a.isMit && !b.isMit) return -1;
      if (!a.isMit && b.isMit) return 1;
      // Then by time
      return timeToMinutes(a.startTime || '99:99') - timeToMinutes(b.startTime || '99:99');
    });

  const list = $('#task-list');
  const empty = $('#tasks-empty');

  if (todays.length === 0) {
    list.innerHTML = '';
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';
  list.innerHTML = '';

  todays.forEach(task => {
    const item = document.createElement('div');
    item.className = 'task-item';
    if (task.done) item.classList.add('done');
    if (task.urgent) item.classList.add('urgent');
    if (task.isMit) item.classList.add('mit');

    const cat = CATEGORIES[task.category] || CATEGORIES.work;
    const timeStr = task.startTime && task.endTime
      ? `${task.startTime}–${task.endTime}`
      : (task.startTime || '');

    item.innerHTML = `
      <div class="task-checkbox-hq" data-action="toggle"></div>
      <div class="task-content-hq">
        <div class="task-item-text">${escapeHtml(task.title)}</div>
        <div class="task-meta-hq">
          ${timeStr ? `<span class="task-time">${timeStr}</span>` : ''}
          <span class="task-cat-pill">${cat.icon} ${cat.name}</span>
        </div>
      </div>
      <button class="task-star ${task.isMit ? 'active' : ''}" data-action="star" title="סמן כ-MIT">${task.isMit ? '⭐' : '☆'}</button>
      <button class="task-delete" data-action="delete" title="מחק">×</button>
    `;

    item.addEventListener('click', (e) => {
      const action = e.target.dataset.action || e.target.closest('[data-action]')?.dataset.action;
      if (action === 'toggle') toggleTaskDone(task.id);
      else if (action === 'star') toggleMIT(task.id);
      else if (action === 'delete') {
        if (confirm(`למחוק את "${task.title}"?`)) {
          deleteTask(task.id);
        }
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
  if (task.done) updateStreak();
  saveState();
  renderAll();
  if (task.done) toast('✓ בוצע', 'success');
}

function toggleMIT(id) {
  const today = todayStr();
  // Clear other MITs for today
  state.tasks.forEach(t => {
    if (t.date === today && t.id !== id) t.isMit = false;
  });
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;
  task.isMit = !task.isMit;
  buzz(20);
  saveState();
  renderAll();
  if (task.isMit) toast('🎯 זאת המשימה הכי חשובה היום');
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
  const count = $('#inbox-count');

  count.textContent = state.inbox.length;

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
      const date = new Date(item.createdAt);
      const dateStr = formatRelativeDate(date);
      el.innerHTML = `
        <div class="inbox-item-content">${escapeHtml(item.content)}</div>
        <span class="inbox-item-date">${dateStr}</span>
        <span class="inbox-item-arrow">←</span>
      `;
      el.addEventListener('click', () => openInboxAction(item));
      list.appendChild(el);
    });
}

function formatRelativeDate(date) {
  const now = Date.now();
  const diffMin = Math.floor((now - date.getTime()) / 60000);
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
  toast('📥 נוסף ל-Inbox', 'success');
}

// Quick form
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

$('#inbox-action-close').addEventListener('click', () => {
  $('#inbox-action-backdrop').classList.remove('open');
  inboxActionTarget = null;
});

$('#inbox-action-backdrop').addEventListener('click', (e) => {
  if (e.target === $('#inbox-action-backdrop')) {
    $('#inbox-action-backdrop').classList.remove('open');
    inboxActionTarget = null;
  }
});

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
    urgent: false,
    isMit: false,
    done: false,
    createdAt: Date.now(),
  });

  // Remove from inbox
  state.inbox = state.inbox.filter(i => i.id !== inboxActionTarget.id);
  saveState();
  $('#inbox-action-backdrop').classList.remove('open');
  inboxActionTarget = null;
  renderAll();
  toast('📅 תוזמן בהצלחה', 'success');
});

$('#inbox-mark-done').addEventListener('click', () => {
  if (!inboxActionTarget) return;
  state.inbox = state.inbox.filter(i => i.id !== inboxActionTarget.id);
  saveState();
  $('#inbox-action-backdrop').classList.remove('open');
  inboxActionTarget = null;
  renderInbox();
  toast('✓ בוצע', 'success');
});

$('#inbox-delete').addEventListener('click', () => {
  if (!inboxActionTarget) return;
  if (!confirm('למחוק את הפריט?')) return;
  state.inbox = state.inbox.filter(i => i.id !== inboxActionTarget.id);
  saveState();
  $('#inbox-action-backdrop').classList.remove('open');
  inboxActionTarget = null;
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
      empty.style.cssText = 'padding: 20px; text-align: center; color: var(--text-faint); font-size: 13px;';
      empty.textContent = scope === 'dream'
        ? 'תוסיף חלום אחד גדול שלך 🌟'
        : 'עוד לא הוספת מטרות';
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
          if (confirm(`למחוק את "${goal.title}"?`)) {
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
    toast('🎉 השגת מטרה!', 'success');
    if (evt) {
      const rect = evt.target.getBoundingClientRect();
      confettiBurst(rect.left + rect.width / 2, rect.top + rect.height / 2);
    }
  }
}

$$('.goals-add').forEach(btn => {
  btn.addEventListener('click', () => {
    const scope = btn.dataset.scope;
    const title = prompt(scope === 'dream'
      ? '🌟 מה החלום שלך?'
      : `מה המטרה ל${scope === 'week' ? 'שבוע' : scope === '3month' ? '3 חודשים' : 'שנה'}?`);
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
    toast('✨ נוסף', 'success');
  });
});

// ============ Week View ============
function renderWeek() {
  const grid = $('#week-grid');
  grid.innerHTML = '';
  const days = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
  const today = new Date();
  const todayStrVal = todayStr();

  // Start from Sunday
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
      .sort((a, b) => timeToMinutes(a.startTime || '99:99') - timeToMinutes(b.startTime || '99:99'));

    dayTasks.forEach(task => {
      const t = document.createElement('div');
      t.className = 'week-day-task';
      t.dataset.cat = task.category || 'work';
      const cat = CATEGORIES[task.category] || CATEGORIES.work;
      t.textContent = `${task.startTime || ''} ${cat.icon} ${task.title}`;
      col.appendChild(t);
    });

    grid.appendChild(col);
  }
}

// ============ Journal ============
function renderJournal() {
  const today = todayStr();
  $('#journal-text').value = state.journal[today] || '';
}

$('#journal-text').addEventListener('blur', () => {
  const today = todayStr();
  state.journal[today] = $('#journal-text').value;
  saveState();
});

// ============ Tabs ============
$$('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const view = tab.dataset.view;
    $$('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    $$('.tab-panel').forEach(p => p.classList.remove('active'));
    $(`#panel-${view}`).classList.add('active');
    buzz(8);

    if (view === 'week') renderWeek();
  });
});

// ============ FAB & Modal ============
$('#fab').addEventListener('click', () => {
  $('#modal-title').value = '';
  $('#modal-urgent').checked = false;
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

$$('.modal-tab').forEach(t => {
  t.addEventListener('click', () => {
    modalMode = t.dataset.modalTab;
    $$('.modal-tab').forEach(tt => tt.classList.remove('active'));
    t.classList.add('active');
    $('#modal-task-fields').style.display = modalMode === 'task' ? 'flex' : 'none';
  });
});

$('#modal-form').addEventListener('submit', (e) => {
  e.preventDefault();
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
      urgent: $('#modal-urgent').checked,
      isMit: false,
      done: false,
      createdAt: Date.now(),
    });
    buzz(15);
    saveState();
    renderAll();
    toast('📅 משימה נוספה', 'success');
  }
  closeModal();
});

// ============ PWA Install ============
let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const dismissed = localStorage.getItem('install-dismissed');
  if (!dismissed) {
    setTimeout(() => $('#install-prompt').style.display = 'flex', 4000);
  }
});

$('#install-btn').addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
  $('#install-prompt').style.display = 'none';
  if (outcome === 'accepted') {
    toast('🎉 האפליקציה הותקנה!', 'success');
  }
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

// ============ HTML Escape ============
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ============ Render All ============
function renderAll() {
  renderHero();
  renderStats();
  renderMIT();
  renderTimeline();
  renderTasks();
  renderInbox();
  renderGoals();
  renderJournal();
}

// ============ Init ============
loadState();
renderAll();

// Re-render every minute (for now-line, time updates)
setInterval(() => {
  renderHero();
  renderStats();
  renderTimeline();
}, 60_000);

// ============ Keyboard Shortcuts ============
document.addEventListener('keydown', (e) => {
  // Ctrl/Cmd + N → open quick add
  if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
    e.preventDefault();
    $('#fab').click();
  }
  // Escape → close modal
  if (e.key === 'Escape') {
    if ($('#modal-backdrop').classList.contains('open')) closeModal();
    if ($('#inbox-action-backdrop').classList.contains('open')) {
      $('#inbox-action-backdrop').classList.remove('open');
      inboxActionTarget = null;
    }
  }
});
