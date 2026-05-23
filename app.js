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
  shutdowns: {}, // { 'YYYY-MM-DD': { mood: 1-5, note: '...' } }
  morningRituals: {}, // { 'YYYY-MM-DD': { mit, obstacle, completedAt } }
  freezeTokens: 0,
  lastFreezeEarnedAt: null,
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

  // Render 7-day dots
  renderStreakDots('mit');
  renderStreakDots('daily');
}

function renderStreakDots(type) {
  const container = document.getElementById(`streak-dots-${type}`);
  if (!container) return;
  container.innerHTML = '';

  // Get set of date strings where this type was active
  let activeDates;
  if (type === 'mit') {
    activeDates = new Set(
      state.tasks.filter(t => t.isMit && t.done && t.date).map(t => t.date)
    );
  } else {
    activeDates = new Set(
      state.tasks.filter(t => t.done && t.date).map(t => t.date)
    );
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // Last 7 days, oldest first (left to right in LTR; right to left in RTL container)
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const dot = document.createElement('span');
    dot.className = 'streak-dot' + (activeDates.has(dStr) ? ' on' : '') + (i === 0 ? ' today' : '');
    dot.title = dStr;
    container.appendChild(dot);
  }
}

// ============ Hero ============
function renderHero() {
  $('#hero-greeting').textContent = greeting();
  $('#hero-date').textContent = formatDateHe(new Date());
  renderIdentityStatement();
  renderYesterdayBridge();
}

// ============ Identity Statement ============
function renderIdentityStatement() {
  const el = $('#identity-statement');
  if (!el) return;

  const statement = buildIdentityStatement();
  if (statement) {
    el.innerHTML = `<span class="id-dot"></span>${statement}`;
    el.classList.add('show');
  } else {
    el.classList.remove('show');
  }
}

function buildIdentityStatement() {
  // Pick the strongest signal from user data
  const s = state.streaks || {};

  // Big streak wins
  if (s.mitCurrent >= 5) return `streak של ${s.mitCurrent} ימים 🔥`;
  if (s.dailyCurrent >= 10) return `${s.dailyCurrent} ימים רצופים פעיל`;

  // Weekly category dominance
  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(today.getDate() - 7);
  const weekStr = dateStrOf(weekAgo);

  const catMin = {};
  state.tasks.filter(t => t.done && t.date >= weekStr).forEach(t => {
    if (t.startTime && t.endTime) {
      const m = timeToMin(t.endTime) - timeToMin(t.startTime);
      if (m > 0) catMin[t.category] = (catMin[t.category] || 0) + m;
    }
  });

  const top = Object.entries(catMin).sort((a, b) => b[1] - a[1])[0];
  if (top && top[1] > 60) { // at least 1 hour in past week
    const hours = (top[1] / 60).toFixed(1).replace(/\.0$/, '');
    const labels = {
      production: `מפיק · ${hours} שעות אייבלטון השבוע`,
      dj: `DJ · ${hours} שעות סטים השבוע`,
      content: `יוצר תוכן · ${hours} שעות השבוע`,
      work: `עובד · ${hours} שעות במינהלה השבוע`,
      fitness: `אתלט · ${hours} שעות אימון השבוע`,
      learning: `לומד · ${hours} שעות השבוע`,
    };
    if (labels[top[0]]) return labels[top[0]];
  }

  // Monthly DJ count
  const monthAgo = new Date(today);
  monthAgo.setMonth(today.getMonth() - 1);
  const monthStr = dateStrOf(monthAgo);
  const djCount = state.tasks.filter(t => t.done && t.category === 'dj' && t.date >= monthStr).length;
  if (djCount >= 3) return `DJ · ${djCount} אירועים החודש`;

  // Goals progress
  const goalsDone = state.goals.filter(g => g.done).length;
  if (goalsDone >= 3) return `${goalsDone} מטרות הושגו עד היום`;

  // First-time user / minimal data
  const totalDone = state.tasks.filter(t => t.done).length;
  if (totalDone >= 50) return `${totalDone} משימות הושלמו`;
  if (totalDone >= 10) return `מתחיל לקבוע קצב`;

  return null;
}

// ============ Yesterday Bridge ============
function renderYesterdayBridge() {
  const el = $('#yesterday-bridge');
  if (!el) return;

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const yStr = dateStrOf(yesterday);

  const yShutdown = state.shutdowns && state.shutdowns[yStr];
  if (yShutdown && yShutdown.note) {
    $('#yesterday-text').textContent = `"${yShutdown.note}"`;
    el.style.display = 'block';
  } else {
    el.style.display = 'none';
  }
}

// ============ 3 Daily Rings ============
function renderRings() {
  const today = todayStr();
  const todays = state.tasks.filter(t => t.date === today);
  const done = todays.filter(t => t.done);
  const mit = todays.find(t => t.isMit);
  const mitDone = mit && mit.done;

  // Ring 1: Tasks
  const tasksPct = todays.length === 0 ? 0 : (done.length / todays.length);
  setRing('#ring-tasks', tasksPct);
  $('#ring-tasks-value').textContent = `${done.length}/${todays.length}`;

  // Ring 2: MIT (binary)
  setRing('#ring-mit', mit ? (mitDone ? 1 : 0) : 0);
  $('#ring-mit-value').textContent = !mit ? '—' : (mitDone ? '✓' : '0/1');

  // Ring 3: Hours of deep work (target 6h)
  const totalMin = done.reduce((sum, t) => {
    if (t.startTime && t.endTime) {
      const m = timeToMin(t.endTime) - timeToMin(t.startTime);
      return sum + (m > 0 ? m : 0);
    }
    return sum;
  }, 0);
  const hoursTarget = 6 * 60; // 6 hours
  const hoursPct = Math.min(1, totalMin / hoursTarget);
  setRing('#ring-hours', hoursPct);
  const hoursStr = (totalMin / 60).toFixed(1).replace(/\.0$/, '');
  $('#ring-hours-value').textContent = `${hoursStr}ש׳`;
}

function setRing(selector, pct) {
  const ring = document.querySelector(selector);
  if (!ring) return;
  const circumference = 2 * Math.PI * 34;
  const offset = circumference * (1 - Math.min(1, Math.max(0, pct)));
  ring.style.strokeDashoffset = offset;
  if (pct >= 1) ring.classList.add('completed');
  else ring.classList.remove('completed');
}

// ============ Yearly Heatmap ============
function renderHeatmap() {
  const grid = $('#heatmap-grid');
  if (!grid) return;
  grid.innerHTML = '';

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStrVal = todayStr();

  // Build map of date → score
  const dateScore = {};
  state.tasks.filter(t => t.done && t.date).forEach(t => {
    dateScore[t.date] = (dateScore[t.date] || 0) + 1;
  });

  // Render last 365 days, oldest first
  const start = new Date(today);
  start.setDate(today.getDate() - 364);

  // Align to Sunday for nice grid (RTL but we set direction LTR on grid)
  while (start.getDay() !== 0) {
    start.setDate(start.getDate() - 1);
  }

  let activeDays = 0;
  let bestDay = 0;
  const cursor = new Date(start);
  while (cursor <= today) {
    const dStr = dateStrOf(cursor);
    const score = dateScore[dStr] || 0;
    if (score > 0) activeDays++;
    if (score > bestDay) bestDay = score;

    const cell = document.createElement('div');
    cell.className = 'heatmap-day';
    cell.title = `${dStr}: ${score} משימות`;
    if (dStr === todayStrVal) cell.classList.add('today');
    let lvl = 0;
    if (score >= 1) lvl = 1;
    if (score >= 3) lvl = 2;
    if (score >= 5) lvl = 3;
    if (score >= 8) lvl = 4;
    if (lvl > 0) cell.classList.add(`lvl-${lvl}`);
    grid.appendChild(cell);
    cursor.setDate(cursor.getDate() + 1);
  }

  $('#heatmap-stats').textContent = `${activeDays} ימים פעילים השנה`;
}

// ============ Natural Language Parser ============
function parseNaturalLanguage(input) {
  // Returns { title, date, startTime, endTime, category } or null
  if (!input || input.length < 3) return null;

  let title = input.trim();
  const original = title;
  let date = todayStr();
  let startTime = null;
  let endTime = null;
  let category = 'work';
  let foundSomething = false;

  // ----- Time patterns -----
  // "ב-10:00" / "ב-10" / "בשעה 10:00" / "10:30"
  const timeMatch = title.match(/(?:ב[-־]?|בשעה\s+)?(\d{1,2})(?::(\d{2}))?(?:\s|$)/);
  if (timeMatch) {
    const h = parseInt(timeMatch[1]);
    if (h >= 0 && h <= 23) {
      const m = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
      startTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      const eh = (h + 1) % 24;
      endTime = `${String(eh).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      title = title.replace(timeMatch[0], ' ').trim();
      foundSomething = true;
    }
  }

  // ----- Date keywords -----
  const dateKeywords = [
    { rgx: /\bהיום\b/, days: 0 },
    { rgx: /\bמחר\b/, days: 1 },
    { rgx: /\bמחרתיים\b/, days: 2 },
    { rgx: /\bבעוד\s+(\d+)\s+ימים?\b/, days: 'capture' },
    { rgx: /\bראשון\b/, dayOfWeek: 0 },
    { rgx: /\bשני\b/, dayOfWeek: 1 },
    { rgx: /\bשלישי\b/, dayOfWeek: 2 },
    { rgx: /\bרביעי\b/, dayOfWeek: 3 },
    { rgx: /\bחמישי\b/, dayOfWeek: 4 },
    { rgx: /\bשישי\b/, dayOfWeek: 5 },
    { rgx: /\bשבת\b/, dayOfWeek: 6 },
  ];

  for (const k of dateKeywords) {
    const m = title.match(k.rgx);
    if (m) {
      const d = new Date();
      if (k.days === 'capture') {
        d.setDate(d.getDate() + parseInt(m[1]));
      } else if (typeof k.days === 'number') {
        d.setDate(d.getDate() + k.days);
      } else if (typeof k.dayOfWeek === 'number') {
        // Next occurrence of that day
        const today = d.getDay();
        let diff = k.dayOfWeek - today;
        if (diff <= 0) diff += 7;
        d.setDate(d.getDate() + diff);
      }
      date = dateStrOf(d);
      title = title.replace(m[0], ' ').trim();
      foundSomething = true;
      break;
    }
  }

  // ----- Category keywords -----
  const catKeywords = [
    { rgx: /\b(DJ|דיג'יי|דיגיי|אירוע|חתונה|מסיבה|סט)\b/i, cat: 'dj' },
    { rgx: /\b(הפקה|אייבלטון|ableton|סטודיו|מיקס|מאשאפ|פרודקשן)\b/i, cat: 'production' },
    { rgx: /\b(אימון|כושר|ריצה|חדר כושר|gym)\b/i, cat: 'fitness' },
    { rgx: /\b(לימוד|claude|למידה|קורס|ai)\b/i, cat: 'learning' },
    { rgx: /\b(פגישה|שיחה|טלפון|זום|zoom)\b/i, cat: 'meetings' },
    { rgx: /\b(סטורי|רילס|פוסט|אינסטה|תוכן|שיווק)\b/i, cat: 'content' },
    { rgx: /\b(השכרה|השכרות|מינהלה|וואן\/וואן|רום)\b/i, cat: 'work' },
    { rgx: /\b(חו"ל|טיסה|חו״ל)\b/i, cat: 'travel' },
  ];

  for (const k of catKeywords) {
    if (k.rgx.test(title)) {
      category = k.cat;
      foundSomething = true;
      break;
    }
  }

  // Clean up trailing/leading spaces and connector words
  title = title.replace(/\s{2,}/g, ' ')
    .replace(/^(על|עם|של|את|ב|ל)\s+/, '')
    .replace(/\s+(על|עם|של|את|ב|ל)$/, '')
    .trim();

  if (!foundSomething || title.length === 0) return null;

  return { title, date, startTime, endTime, category, original };
}

function formatNLHint(parsed) {
  const dateLbl = parsed.date === todayStr() ? 'היום' :
                  parsed.date === dateAddDays(todayStr(), 1) ? 'מחר' :
                  parsed.date;
  const parts = [];
  if (parsed.title) parts.push(`"${parsed.title}"`);
  parts.push(dateLbl);
  if (parsed.startTime) parts.push(parsed.startTime);
  const catName = CATEGORIES[parsed.category]?.name || parsed.category;
  parts.push(`· ${catName}`);
  return `נזהה: ${parts.join(' · ')}`;
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

// Long-press to complete MIT (premium gesture)
const mitBtn = $('#mit-btn');
let mitPressTimer = null;
let mitPressStart = 0;
const MIT_HOLD_MS = 600;

function completeMIT(e) {
  const today = todayStr();
  const mit = state.tasks.find(t => t.date === today && t.isMit);
  if (!mit || mit.done) return;

  mit.done = true;
  mit.doneAt = new Date().toISOString();
  saveState();
  renderAll();

  const rect = mitBtn.getBoundingClientRect();
  confettiBurst(rect.left + rect.width / 2, rect.top + rect.height / 2);
  buzz([20, 40, 20, 40, 20]);
  toast('🔥 MIT הושלם');
}

function startMitPress(e) {
  const today = todayStr();
  const mit = state.tasks.find(t => t.date === today && t.isMit);
  if (!mit || mit.done) return;

  mitPressStart = Date.now();
  mitBtn.classList.add('pressing');
  mitPressTimer = setTimeout(() => {
    mitBtn.classList.remove('pressing');
    mitBtn.classList.add('completing');
    setTimeout(() => mitBtn.classList.remove('completing'), 300);
    completeMIT(e);
  }, MIT_HOLD_MS);
}

function endMitPress() {
  if (mitPressTimer) clearTimeout(mitPressTimer);
  mitPressTimer = null;
  mitBtn.classList.remove('pressing');
}

mitBtn.addEventListener('pointerdown', startMitPress);
mitBtn.addEventListener('pointerup', endMitPress);
mitBtn.addEventListener('pointerleave', endMitPress);
mitBtn.addEventListener('pointercancel', endMitPress);
// Fallback: click still works (in case long-press is skipped, e.g. keyboard nav)
mitBtn.addEventListener('click', (e) => {
  // Click without hold — show hint
  if (Date.now() - mitPressStart < MIT_HOLD_MS) {
    toast('לחץ והחזק לסיום (0.6 שניות)');
  }
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
    const emptyTexts = [
      ['יום ריק', 'תוסיף משימה עם הכפתור ⊕ או תזרוק ל-Inbox'],
      ['אין משימות', 'תיהנה מהיום, או תזרוק רעיון ל-Inbox'],
      ['הכל פנוי', 'תכניס משהו עם הכפתור למטה'],
    ];
    const hour = new Date().getHours();
    const text = hour < 12 ? emptyTexts[0] : hour < 18 ? emptyTexts[1] : emptyTexts[2];
    empty.innerHTML = `<p>${text[0]}</p><p class="tasks-empty-sub">${text[1]}</p>`;
    return;
  }

  empty.style.display = 'none';
  list.innerHTML = '';

  todays.forEach(task => {
    const wrapper = document.createElement('div');
    wrapper.className = 'task-swipe-wrap';

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

    // Swipe gestures
    attachSwipe(item, {
      onSwipeRight: () => {
        if (!task.done) {
          toggleTaskDone(task.id);
          buzz([15, 30, 15]);
        }
      },
      onSwipeLeft: () => {
        // Push to tomorrow
        pushToTomorrow(task.id);
      },
    });

    wrapper.appendChild(item);
    list.appendChild(wrapper);
  });
}

// ============ Swipe Gesture Helper ============
function attachSwipe(el, { onSwipeRight, onSwipeLeft, threshold = 80 }) {
  let startX = 0, startY = 0, currentX = 0, isPointerDown = false, locked = null;
  const SWIPE_INDICATOR_MAX = 120;

  const reset = (animate = true) => {
    if (animate) el.style.transition = 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)';
    else el.style.transition = 'none';
    el.style.transform = 'translateX(0)';
    el.classList.remove('swiping-right', 'swiping-left');
    setTimeout(() => { el.style.transition = 'none'; }, 280);
  };

  el.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return; // don't swipe on buttons
    startX = e.clientX;
    startY = e.clientY;
    isPointerDown = true;
    locked = null;
    el.style.transition = 'none';
  });

  el.addEventListener('pointermove', (e) => {
    if (!isPointerDown) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (locked === null) {
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        locked = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
        if (locked === 'h') el.setPointerCapture(e.pointerId);
      }
    }
    if (locked !== 'h') return;
    currentX = Math.max(-SWIPE_INDICATOR_MAX, Math.min(SWIPE_INDICATOR_MAX, dx));
    el.style.transform = `translateX(${currentX}px)`;
    if (currentX > 20) {
      el.classList.add('swiping-right');
      el.classList.remove('swiping-left');
    } else if (currentX < -20) {
      el.classList.add('swiping-left');
      el.classList.remove('swiping-right');
    } else {
      el.classList.remove('swiping-right', 'swiping-left');
    }
  });

  const endHandler = (e) => {
    if (!isPointerDown) return;
    isPointerDown = false;
    if (locked === 'h') {
      // RTL: swipe right (positive dx) = swipe toward right side = "done"
      if (currentX > threshold) {
        reset();
        setTimeout(() => onSwipeRight && onSwipeRight(), 50);
      } else if (currentX < -threshold) {
        reset();
        setTimeout(() => onSwipeLeft && onSwipeLeft(), 50);
      } else {
        reset();
      }
    }
    currentX = 0;
    locked = null;
  };

  el.addEventListener('pointerup', endHandler);
  el.addEventListener('pointercancel', endHandler);
  el.addEventListener('pointerleave', endHandler);
}

function pushToTomorrow(id) {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;
  const [y, m, d] = task.date.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + 1);
  task.date = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  task.isMit = false;
  buzz(15);
  saveState();
  renderAll();
  toast('נדחה למחר');
}

function toggleTaskDone(id) {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;
  const wasNotDone = !task.done;
  task.done = !task.done;
  task.doneAt = task.done ? new Date().toISOString() : null;
  buzz(wasNotDone ? [10, 20, 15] : 10);

  // Trigger animation BEFORE re-render for smooth feel
  const item = document.querySelector(`.task-item .task-text`);
  const allCheckboxes = document.querySelectorAll('.task-checkbox');
  allCheckboxes.forEach(cb => {
    cb.classList.add('animating');
    setTimeout(() => cb.classList.remove('animating'), 400);
  });

  saveState();
  setTimeout(() => renderAll(), 100);
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

// ============ Week View (7 days FORWARD from today) ============
function renderWeek() {
  const grid = $('#week-grid');
  grid.innerHTML = '';
  const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  const dayShort = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
  const monthShort = ['ינו', 'פבר', 'מרץ', 'אפר', 'מאי', 'יונ', 'יול', 'אוג', 'ספט', 'אוק', 'נוב', 'דצמ'];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStrVal = todayStr();

  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const isToday = dateStr === todayStrVal;
    const isTomorrow = i === 1;

    const col = document.createElement('div');
    col.className = 'week-day' + (isToday ? ' today' : '');

    let labelText = dayShort[d.getDay()];
    if (isToday) labelText = 'היום';
    else if (isTomorrow) labelText = 'מחר';

    const header = document.createElement('div');
    header.className = 'week-day-header';
    header.innerHTML = `
      <div class="week-day-name">${labelText}</div>
      <div class="week-day-num">${d.getDate()}<span class="week-day-month"> ${monthShort[d.getMonth()]}</span></div>
    `;
    col.appendChild(header);

    const dayTasks = state.tasks
      .filter(t => t.date === dateStr)
      .sort((a, b) => timeToMin(a.startTime) - timeToMin(b.startTime));

    if (dayTasks.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'week-day-empty';
      empty.textContent = '·';
      col.appendChild(empty);
    } else {
      dayTasks.forEach(task => {
        const t = document.createElement('div');
        t.className = 'week-day-task' + (task.done ? ' done' : '') + (task.isMit ? ' mit' : '');
        t.innerHTML = `
          ${task.startTime ? `<span class="week-task-time">${task.startTime}</span>` : ''}
          <span class="week-task-title">${escapeHtml(task.title)}</span>
        `;
        col.appendChild(t);
      });
    }

    // Quick add button for that day
    const addBtn = document.createElement('button');
    addBtn.className = 'week-day-add';
    addBtn.textContent = '+';
    addBtn.title = `הוסף ל${labelText}`;
    addBtn.addEventListener('click', () => quickAddOnDate(dateStr, labelText));
    col.appendChild(addBtn);

    grid.appendChild(col);
  }
}

function quickAddOnDate(dateStr, labelText) {
  const title = prompt(`משימה חדשה ל${labelText}:`);
  if (!title || !title.trim()) return;
  state.tasks.push({
    id: uuid(),
    title: title.trim(),
    date: dateStr,
    startTime: '09:00',
    endTime: '10:00',
    category: 'work',
    isMit: false,
    done: false,
    createdAt: Date.now(),
  });
  buzz(15);
  saveState();
  renderAll();
  renderWeek();
  toast(`נוסף ל${labelText}`);
}

// ============ Tabs Navigation ============
$$('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const view = tab.dataset.view;
    const doSwitch = () => {
      $$('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      $$('.view').forEach(v => v.classList.remove('active'));
      $(`#view-${view}`).classList.add('active');
      if (view === 'week') {
        renderWeek();
        renderHeatmap();
      }
    };

    // View Transitions API for native-like morphing
    if (document.startViewTransition) {
      document.startViewTransition(() => doSwitch());
    } else {
      doSwitch();
    }

    buzz(8);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
});

// ============ FAB & Modal ============
$('#fab').addEventListener('click', () => {
  $('#modal-title').value = '';
  $('#nl-hint').style.display = 'none';
  $('#modal-backdrop').classList.add('open');
  setTimeout(() => $('#modal-title').focus(), 100);
  buzz(10);
});

// NL parser live hint
let nlParsed = null;
$('#modal-title').addEventListener('input', (e) => {
  const val = e.target.value;
  if (val.length < 4) {
    $('#nl-hint').style.display = 'none';
    nlParsed = null;
    return;
  }
  const parsed = parseNaturalLanguage(val);
  if (parsed) {
    nlParsed = parsed;
    $('#nl-hint-text').textContent = formatNLHint(parsed);
    $('#nl-hint').style.display = 'flex';
  } else {
    $('#nl-hint').style.display = 'none';
    nlParsed = null;
  }
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

  // If NL was parsed AND user is on Inbox tab, auto-promote to task
  if (nlParsed && (nlParsed.startTime || nlParsed.date !== todayStr())) {
    state.tasks.push({
      id: uuid(),
      title: nlParsed.title || title,
      date: nlParsed.date,
      startTime: nlParsed.startTime || '09:00',
      endTime: nlParsed.endTime || '10:00',
      category: nlParsed.category || 'work',
      isMit: false,
      done: false,
      createdAt: Date.now(),
    });
    buzz([10, 30, 10]);
    saveState();
    renderAll();
    toast(`✨ ${nlParsed.title} נוסף`);
    nlParsed = null;
    closeModal();
    return;
  }

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

// ============ Service Worker + Auto-Update ============
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').then((reg) => {
      // Check for updates every minute while page is open
      setInterval(() => reg.update(), 60_000);

      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New version available
            showUpdateBanner(newWorker);
          }
        });
      });
    }).catch(() => {});

    // Reload page when new SW takes over
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  });
}

function showUpdateBanner(worker) {
  // Create banner if not exists
  let banner = document.getElementById('update-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'update-banner';
    banner.className = 'update-banner';
    banner.innerHTML = `
      <span class="update-text">✨ גרסה חדשה זמינה</span>
      <button class="update-btn" id="update-btn">רענן</button>
    `;
    document.body.appendChild(banner);
    document.getElementById('update-btn').addEventListener('click', () => {
      worker.postMessage({ type: 'SKIP_WAITING' });
    });
  }
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
    if ($('#shutdown-backdrop').classList.contains('open')) closeShutdown();
    if ($('#cmdbar-overlay').style.display !== 'none') closeCmdBar();
    if ($('#done-day-overlay').style.display !== 'none') $('#done-day-overlay').style.display = 'none';
  }
});

// ============ Init ============
function renderAll() {
  renderHero();
  renderRings();
  renderStreaks();
  renderMIT();
  renderTasks();
  renderInbox();
  renderGoals();
}

// ============ Shutdown Ritual ============
const SHUTDOWN_HOUR = 21; // 21:00 onwards

function maybeShowShutdownBanner() {
  const now = new Date();
  const today = todayStr();
  if (now.getHours() < SHUTDOWN_HOUR) {
    $('#shutdown-banner').style.display = 'none';
    return;
  }
  if (state.shutdowns && state.shutdowns[today]) {
    $('#shutdown-banner').style.display = 'none';
    return;
  }
  if (sessionStorage.getItem('shutdown-dismissed-today') === today) return;
  $('#shutdown-banner').style.display = 'flex';
}

$('#shutdown-banner').addEventListener('click', (e) => {
  if (e.target.closest('#shutdown-dismiss')) return;
  openShutdownModal();
});

$('#shutdown-dismiss').addEventListener('click', (e) => {
  e.stopPropagation();
  $('#shutdown-banner').style.display = 'none';
  sessionStorage.setItem('shutdown-dismissed-today', todayStr());
});

let selectedMood = null;

function openShutdownModal() {
  selectedMood = null;
  $$('.mood-btn').forEach(b => b.classList.remove('selected'));
  $('#shutdown-note').value = '';

  // Compute today's stats
  const today = todayStr();
  const todays = state.tasks.filter(t => t.date === today);
  const done = todays.filter(t => t.done).length;
  const mit = todays.find(t => t.isMit);
  const mitDone = mit && mit.done;

  const catMinutes = {};
  todays.filter(t => t.done && t.startTime && t.endTime).forEach(t => {
    const min = timeToMin(t.endTime) - timeToMin(t.startTime);
    if (min > 0) catMinutes[t.category || 'other'] = (catMinutes[t.category || 'other'] || 0) + min;
  });
  const topCat = Object.entries(catMinutes).sort((a, b) => b[1] - a[1])[0];

  let statsHtml = `
    <div class="shutdown-stat-row">
      <span class="shutdown-stat-label">משימות הושלמו</span>
      <span class="shutdown-stat-value">${done}/${todays.length}</span>
    </div>
    <div class="shutdown-stat-row">
      <span class="shutdown-stat-label">MIT</span>
      <span class="shutdown-stat-value">${mit ? (mitDone ? '✓ הושלם' : 'לא הושלם') : '—'}</span>
    </div>
  `;
  if (topCat) {
    const hours = (topCat[1] / 60).toFixed(1).replace(/\.0$/, '');
    statsHtml += `
      <div class="shutdown-stat-row">
        <span class="shutdown-stat-label">הכי הרבה זמן</span>
        <span class="shutdown-stat-value">${(CATEGORIES[topCat[0]] && CATEGORIES[topCat[0]].name) || topCat[0]} · ${hours}ש׳</span>
      </div>
    `;
  }
  $('#shutdown-stats').innerHTML = statsHtml;

  $('#shutdown-backdrop').classList.add('open');
  $('#shutdown-banner').style.display = 'none';
}

$$('.mood-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    $$('.mood-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    selectedMood = parseInt(btn.dataset.mood);
    buzz(10);
  });
});

$('#shutdown-close').addEventListener('click', closeShutdown);
$('#shutdown-backdrop').addEventListener('click', (e) => {
  if (e.target === $('#shutdown-backdrop')) closeShutdown();
});

function closeShutdown() {
  $('#shutdown-backdrop').classList.remove('open');
}

$('#shutdown-save').addEventListener('click', () => {
  const today = todayStr();
  state.shutdowns = state.shutdowns || {};
  state.shutdowns[today] = {
    mood: selectedMood,
    note: $('#shutdown-note').value.trim() || null,
    savedAt: new Date().toISOString(),
  };
  saveState();
  closeShutdown();
  buzz([20, 30, 20]);
  toast('🌙 לילה טוב, טהר');
});

// ============ Morning Ritual ============
const MORNING_HOUR_START = 5;
const MORNING_HOUR_END = 12;

let ritualState = {
  currentStep: 1,
  mit: '',
  tasks: [], // { id, title, duration }
  obstacle: '',
};

function maybeShowMorningRitual() {
  const now = new Date();
  const h = now.getHours();
  if (h < MORNING_HOUR_START || h >= MORNING_HOUR_END) return;
  const today = todayStr();
  if (state.morningRituals && state.morningRituals[today]) return;
  if (sessionStorage.getItem('ritual-dismissed-today') === today) return;

  // Don't auto-show if user already has MIT for today
  const todays = state.tasks.filter(t => t.date === today);
  if (todays.some(t => t.isMit)) return;

  openMorningRitual();
}

function openMorningRitual() {
  ritualState = { currentStep: 1, mit: '', tasks: [], obstacle: '' };
  $('#morning-ritual').style.display = 'flex';
  $('#ritual-greeting').textContent = greeting();
  showRitualStep(1);
  setTimeout(() => $('#ritual-mit-input').focus(), 300);
}

function showRitualStep(step) {
  ritualState.currentStep = step;
  [1, 2, 3, 4].forEach(n => {
    $(`#ritual-step-${n}`).style.display = n === step ? 'flex' : 'none';
  });
  $('#ritual-progress-bar').style.width = `${(step / 3) * 100}%`;

  if (step === 2) {
    renderRitualTasks();
    setTimeout(() => $('#ritual-task-input').focus(), 200);
  } else if (step === 3) {
    setTimeout(() => $('#ritual-obstacle-input').focus(), 200);
  } else if (step === 4) {
    renderRitualReveal();
  }
}

function renderRitualTasks() {
  const list = $('#ritual-tasks');
  list.innerHTML = '';
  ritualState.tasks.forEach(t => {
    const el = document.createElement('div');
    el.className = 'ritual-task';
    el.innerHTML = `
      <div class="ritual-task-title">${escapeHtml(t.title)}</div>
      <div class="ritual-task-duration">${formatDuration(t.duration)}</div>
      <button class="ritual-task-remove" data-id="${t.id}">×</button>
    `;
    el.querySelector('.ritual-task-remove').addEventListener('click', () => {
      ritualState.tasks = ritualState.tasks.filter(x => x.id !== t.id);
      renderRitualTasks();
    });
    list.appendChild(el);
  });
  renderRitualBudget();
}

function formatDuration(min) {
  if (min < 60) return `${min} דק'`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (m === 0) return h === 1 ? 'שעה' : `${h} שעות`;
  return `${h}:${String(m).padStart(2, '0')}`;
}

function renderRitualBudget() {
  const totalMin = ritualState.tasks.reduce((s, t) => s + t.duration, 0);
  // Add MIT estimate (assume 60 min default)
  const totalWithMit = totalMin + 60;
  const startHour = new Date().getHours();
  const finishHour = startHour + (totalWithMit / 60);
  const finishH = Math.floor(finishHour);
  const finishM = Math.round((finishHour - finishH) * 60);

  const finishStr = `${String(finishH).padStart(2, '0')}:${String(finishM).padStart(2, '0')}`;
  const hoursStr = (totalWithMit / 60).toFixed(1).replace(/\.0$/, '');

  const el = $('#ritual-budget');
  if (totalMin === 0) {
    el.style.display = 'none';
    return;
  }
  el.style.display = 'block';
  const over = finishH >= 22;
  el.classList.toggle('over', over);
  el.innerHTML = `תכננת <strong>${hoursStr} שעות</strong> · היום שלך נגמר ב-<strong>${finishStr}</strong>${over ? ' · יותר מדי?' : ' · ריאלי'}`;
}

$('#ritual-add-task-btn').addEventListener('click', addRitualTask);
$('#ritual-task-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    addRitualTask();
  }
});

function addRitualTask() {
  const input = $('#ritual-task-input');
  const dur = $('#ritual-task-duration');
  const title = input.value.trim();
  if (!title) return;
  ritualState.tasks.push({
    id: uuid(),
    title,
    duration: parseInt(dur.value),
  });
  input.value = '';
  input.focus();
  renderRitualTasks();
  buzz(8);
}

$('#ritual-next-1').addEventListener('click', () => {
  const mit = $('#ritual-mit-input').value.trim();
  if (!mit) {
    $('#ritual-mit-input').focus();
    return;
  }
  ritualState.mit = mit;
  showRitualStep(2);
});

$('#ritual-mit-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') $('#ritual-next-1').click();
});

$('#ritual-next-2').addEventListener('click', () => showRitualStep(3));

$('#ritual-obstacle-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') $('#ritual-finish').click();
});

$('#ritual-finish').addEventListener('click', finishRitual);

function finishRitual() {
  ritualState.obstacle = $('#ritual-obstacle-input').value.trim();

  const today = todayStr();
  const now = new Date();
  let cursorH = now.getHours();
  let cursorM = Math.ceil(now.getMinutes() / 15) * 15;
  if (cursorM >= 60) { cursorH += 1; cursorM = 0; }
  if (cursorH < 9) cursorH = 9;

  // Create MIT task first
  const mitStart = `${String(cursorH).padStart(2, '0')}:${String(cursorM).padStart(2, '0')}`;
  let endH = cursorH + 1;
  let endM = cursorM;
  if (endH >= 24) endH = 23;
  const mitEnd = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;

  state.tasks.push({
    id: uuid(),
    title: ritualState.mit,
    date: today,
    startTime: mitStart,
    endTime: mitEnd,
    category: detectCategory(ritualState.mit) || 'work',
    isMit: true,
    done: false,
    createdAt: Date.now(),
  });

  // Advance cursor 1 hour
  cursorH = endH;
  cursorM = endM;

  // Add the other tasks
  ritualState.tasks.forEach(t => {
    cursorM += t.duration;
    while (cursorM >= 60) { cursorH += 1; cursorM -= 60; }
    const startTime = `${String(Math.max(0, cursorH - t.duration/60 | 0)).padStart(2,'0')}:${String(cursorM).padStart(2,'0')}`;
    // Simpler: compute start = cursor - duration
    const totalEndMin = cursorH * 60 + cursorM;
    const totalStartMin = totalEndMin - t.duration;
    const sH = Math.floor(totalStartMin / 60);
    const sM = totalStartMin % 60;

    state.tasks.push({
      id: uuid(),
      title: t.title,
      date: today,
      startTime: `${String(sH).padStart(2, '0')}:${String(sM).padStart(2, '0')}`,
      endTime: `${String(cursorH).padStart(2, '0')}:${String(cursorM).padStart(2, '0')}`,
      category: detectCategory(t.title) || 'work',
      isMit: false,
      done: false,
      createdAt: Date.now(),
    });
  });

  state.morningRituals = state.morningRituals || {};
  state.morningRituals[today] = {
    mit: ritualState.mit,
    obstacle: ritualState.obstacle,
    completedAt: new Date().toISOString(),
  };

  saveState();
  showRitualStep(4);
}

function detectCategory(title) {
  const map = [
    [/DJ|דיג'יי|אירוע|חתונה|מסיבה|סט/i, 'dj'],
    [/הפקה|אייבלטון|ableton|סטודיו|מיקס/i, 'production'],
    [/אימון|כושר|ריצה/i, 'fitness'],
    [/לימוד|claude|קורס|ai/i, 'learning'],
    [/פגישה|שיחה|טלפון|זום/i, 'meetings'],
    [/סטורי|רילס|פוסט|אינסטה|תוכן|שיווק/i, 'content'],
    [/השכרה|מינהלה|רום/i, 'work'],
  ];
  for (const [rgx, cat] of map) if (rgx.test(title)) return cat;
  return null;
}

function renderRitualReveal() {
  const today = todayStr();
  const todays = state.tasks.filter(t => t.date === today)
    .sort((a, b) => timeToMin(a.startTime) - timeToMin(b.startTime));

  const container = $('#ritual-timeline');
  container.innerHTML = '';
  todays.forEach((task, idx) => {
    const el = document.createElement('div');
    el.className = 'ritual-timeline-block' + (task.isMit ? ' mit' : '');
    el.style.animationDelay = `${idx * 80}ms`;
    el.innerHTML = `
      <div class="ritual-timeline-block-content">
        <div class="ritual-timeline-block-title">${escapeHtml(task.title)}${task.isMit ? ' ⭐' : ''}</div>
        <div class="ritual-timeline-block-meta">${CATEGORIES[task.category]?.name || ''}</div>
      </div>
      <div class="ritual-timeline-block-time">${task.startTime}</div>
    `;
    container.appendChild(el);
  });
  buzz([15, 30, 15]);
}

$('#ritual-go').addEventListener('click', () => {
  $('#morning-ritual').style.display = 'none';
  renderAll();
  toast('🌅 בוקר טוב, תהיה יום מהמם');
});

$('#ritual-skip').addEventListener('click', () => {
  $('#morning-ritual').style.display = 'none';
  sessionStorage.setItem('ritual-dismissed-today', todayStr());
});

// ============ Done For The Day ============
function maybeShowDoneForDay() {
  // Triggered manually from shutdown ritual completion (or "all tasks done")
  // Don't auto-show here, called from shutdown save
}

function showDoneForDay() {
  const today = todayStr();
  const todays = state.tasks.filter(t => t.date === today);
  const done = todays.filter(t => t.done).length;
  const mit = todays.find(t => t.isMit);
  const mitDone = mit && mit.done;

  // Compute streak after shutdown
  recomputeStreaks();

  const statsEl = $('#done-day-stats');
  let html = '';
  html += `<div>${done}/${todays.length} משימות הושלמו</div>`;
  if (mit) html += `<div>MIT ${mitDone ? '✓ הושלם' : 'לא הושלם'}</div>`;
  if (state.streaks.mitCurrent > 0) html += `<div>🔥 ${state.streaks.mitCurrent} ימים רצוף</div>`;
  statsEl.innerHTML = html;

  $('#done-day-overlay').style.display = 'flex';
  buzz([20, 50, 20, 50]);
}

$('#done-day-close').addEventListener('click', () => {
  $('#done-day-overlay').style.display = 'none';
});

// ============ Command Bar ============
const COMMANDS = [
  { id: 'go-today', label: 'עבור ל-היום', icon: '📅', hint: 'GT', run: () => switchTab('today') },
  { id: 'go-inbox', label: 'עבור ל-Inbox', icon: '📥', hint: 'GI', run: () => switchTab('inbox') },
  { id: 'go-goals', label: 'עבור ל-מטרות', icon: '🎯', hint: 'GG', run: () => switchTab('goals') },
  { id: 'go-week', label: 'עבור ל-שבוע', icon: '🗓', hint: 'GW', run: () => switchTab('week') },
  { id: 'new-task', label: 'משימה חדשה', icon: '⊕', hint: 'N', run: () => $('#fab').click() },
  { id: 'morning-ritual', label: 'התחל טקס בוקר', icon: '🌅', hint: '', run: () => openMorningRitual() },
  { id: 'shutdown', label: 'סגור את היום', icon: '🌙', hint: '', run: () => openShutdownModal() },
  { id: 'weekly-summary', label: 'הצג סיכום שבועי', icon: '📊', hint: '', run: () => { window.tohar.forceWeekly(); } },
  { id: 'done-day', label: 'הצג מסך סוף יום', icon: '✨', hint: '', run: () => showDoneForDay() },
];

let cmdbarSelectedIdx = 0;

function openCmdBar() {
  $('#cmdbar-overlay').style.display = 'flex';
  $('#cmdbar-input').value = '';
  cmdbarSelectedIdx = 0;
  renderCmdResults('');
  setTimeout(() => $('#cmdbar-input').focus(), 50);
}

function closeCmdBar() {
  $('#cmdbar-overlay').style.display = 'none';
}

function switchTab(view) {
  const tab = document.querySelector(`.tab[data-view="${view}"]`);
  if (tab) tab.click();
}

function renderCmdResults(query) {
  const q = query.toLowerCase();
  const filtered = COMMANDS.filter(c => c.label.toLowerCase().includes(q) || c.id.includes(q));
  const container = $('#cmdbar-results');
  container.innerHTML = '';

  if (filtered.length === 0) {
    container.innerHTML = `<div style="padding:24px;text-align:center;color:var(--text-faint);font-size:13px;">לא נמצאו פעולות</div>`;
    return;
  }

  cmdbarSelectedIdx = Math.min(cmdbarSelectedIdx, filtered.length - 1);

  filtered.forEach((c, idx) => {
    const el = document.createElement('div');
    el.className = 'cmdbar-result' + (idx === cmdbarSelectedIdx ? ' selected' : '');
    el.innerHTML = `
      <span class="cmdbar-result-icon">${c.icon}</span>
      <span class="cmdbar-result-text">${escapeHtml(c.label)}</span>
      ${c.hint ? `<span class="cmdbar-result-hint">${c.hint}</span>` : ''}
    `;
    el.addEventListener('click', () => {
      closeCmdBar();
      setTimeout(() => c.run(), 50);
    });
    container.appendChild(el);
  });
}

$('#cmdbar-input').addEventListener('input', (e) => {
  cmdbarSelectedIdx = 0;
  renderCmdResults(e.target.value);
});

$('#cmdbar-input').addEventListener('keydown', (e) => {
  const q = e.target.value.toLowerCase();
  const filtered = COMMANDS.filter(c => c.label.toLowerCase().includes(q) || c.id.includes(q));

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    cmdbarSelectedIdx = Math.min(filtered.length - 1, cmdbarSelectedIdx + 1);
    renderCmdResults(e.target.value);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    cmdbarSelectedIdx = Math.max(0, cmdbarSelectedIdx - 1);
    renderCmdResults(e.target.value);
  } else if (e.key === 'Enter') {
    e.preventDefault();
    const cmd = filtered[cmdbarSelectedIdx];
    if (cmd) {
      closeCmdBar();
      setTimeout(() => cmd.run(), 50);
    }
  }
});

$('#cmdbar-overlay').addEventListener('click', (e) => {
  if (e.target === $('#cmdbar-overlay')) closeCmdBar();
});

// Open with Cmd-K / Ctrl-K
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    openCmdBar();
  }
});

// Long-press on FAB to open command bar
let fabPressTimer = null;
$('#fab').addEventListener('pointerdown', (e) => {
  fabPressTimer = setTimeout(() => {
    fabPressTimer = null;
    openCmdBar();
    buzz(20);
  }, 500);
});
['pointerup', 'pointerleave', 'pointercancel'].forEach(evt => {
  $('#fab').addEventListener(evt, () => {
    if (fabPressTimer) clearTimeout(fabPressTimer);
  });
});

// Hook into shutdown save to show Done screen
const origShutdownSave = $('#shutdown-save').onclick;
$('#shutdown-save').addEventListener('click', () => {
  setTimeout(() => {
    if (!$('#shutdown-backdrop').classList.contains('open')) {
      showDoneForDay();
    }
  }, 400);
});

// ============ Demo Data ============
function loadDemoData() {
  const today = todayStr();
  const dateBack = (days) => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return dateStrOf(d);
  };
  const dateForward = (days) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return dateStrOf(d);
  };

  state.tasks = [
    // Today
    { id: uuid(), title: 'לסגור עם רום על האתר', date: today, startTime: '10:00', endTime: '11:30', category: 'work', isMit: true, done: true, createdAt: Date.now() },
    { id: uuid(), title: 'סשן הפקה — עבודה על המאשאפ', date: today, startTime: '14:00', endTime: '16:00', category: 'production', isMit: false, done: true, createdAt: Date.now() },
    { id: uuid(), title: 'אימון רגליים', date: today, startTime: '17:00', endTime: '18:30', category: 'fitness', isMit: false, done: false, createdAt: Date.now() },
    { id: uuid(), title: 'צילום סטורי לאינסטה', date: today, startTime: '19:00', endTime: '19:30', category: 'content', isMit: false, done: false, createdAt: Date.now() },

    // Yesterday — completed
    { id: uuid(), title: 'הזמנה לציוד DJ לחתונת אהוד', date: dateBack(1), startTime: '10:00', endTime: '11:00', category: 'dj', isMit: true, done: true, createdAt: Date.now() },
    { id: uuid(), title: 'אימון חזה', date: dateBack(1), startTime: '17:00', endTime: '18:00', category: 'fitness', isMit: false, done: true, createdAt: Date.now() },
    { id: uuid(), title: 'אייבלטון — עריכת stem', date: dateBack(1), startTime: '20:00', endTime: '22:00', category: 'production', isMit: false, done: true, createdAt: Date.now() },

    // 2 days ago
    { id: uuid(), title: 'פגישה עם רום', date: dateBack(2), startTime: '11:00', endTime: '12:00', category: 'meetings', isMit: true, done: true, createdAt: Date.now() },
    { id: uuid(), title: 'אימון גב', date: dateBack(2), startTime: '17:00', endTime: '18:00', category: 'fitness', isMit: false, done: true, createdAt: Date.now() },
    { id: uuid(), title: 'אייבלטון — לימוד פלאגין', date: dateBack(2), startTime: '20:00', endTime: '22:30', category: 'production', isMit: false, done: true, createdAt: Date.now() },

    // 3 days ago
    { id: uuid(), title: 'תיאום השכרות לסופ"ש', date: dateBack(3), startTime: '10:00', endTime: '12:00', category: 'work', isMit: true, done: true, createdAt: Date.now() },
    { id: uuid(), title: 'אירוע DJ חתונת ליאור ויעל', date: dateBack(3), startTime: '20:00', endTime: '23:30', category: 'dj', isMit: false, done: true, createdAt: Date.now() },

    // 4 days ago
    { id: uuid(), title: 'לקרוא על Claude Code', date: dateBack(4), startTime: '10:00', endTime: '11:00', category: 'learning', isMit: true, done: true, createdAt: Date.now() },
    { id: uuid(), title: 'אימון רגליים', date: dateBack(4), startTime: '17:00', endTime: '18:30', category: 'fitness', isMit: false, done: true, createdAt: Date.now() },
    { id: uuid(), title: 'הפקה — מאשאפ של אבני חושן', date: dateBack(4), startTime: '20:00', endTime: '23:00', category: 'production', isMit: false, done: true, createdAt: Date.now() },

    // Tomorrow
    { id: uuid(), title: 'פגישה עם עוז על המאשאפ', date: dateForward(1), startTime: '11:00', endTime: '12:30', category: 'production', isMit: false, done: false, createdAt: Date.now() },
    { id: uuid(), title: 'צילום רילס לאינסטה', date: dateForward(1), startTime: '15:00', endTime: '16:00', category: 'content', isMit: false, done: false, createdAt: Date.now() },

    // 2 days forward
    { id: uuid(), title: 'אירוע DJ — בר מצווה', date: dateForward(2), startTime: '20:00', endTime: '23:30', category: 'dj', isMit: false, done: false, createdAt: Date.now() },
  ];

  state.inbox = [
    { id: uuid(), content: 'להזמין כבל XLR חדש לאירוע השבוע', createdAt: Date.now() - 600000 },
    { id: uuid(), content: 'רעיון לסטורי - behind the scenes בחתונה', createdAt: Date.now() - 3600000 },
    { id: uuid(), content: 'לדבר עם רום על שיפור הכרטיסי ביקור', createdAt: Date.now() - 7200000 },
    { id: uuid(), content: 'לסיים את ההפקה של עומר אדם', createdAt: Date.now() - 14400000 },
  ];

  state.goals = [
    { id: uuid(), title: 'רכב TRX 🚗', scope: 'dream', done: false, createdAt: Date.now() },
    { id: uuid(), title: 'כלב גולדן רטריבר 🐕', scope: 'dream', done: false, createdAt: Date.now() },
    { id: uuid(), title: 'אלבום מקורי משלי 🎵', scope: 'dream', done: false, createdAt: Date.now() },

    { id: uuid(), title: 'עצמאות מלאה בבניית כלים עם קלוד', scope: 'year', done: false, createdAt: Date.now() },
    { id: uuid(), title: '15+ אירועי DJ אישיים השנה', scope: 'year', done: false, createdAt: Date.now() },
    { id: uuid(), title: 'הפקה ראשונה משלי בסט', scope: 'year', done: true, createdAt: Date.now() },

    { id: uuid(), title: 'האתר עולה לאוויר', scope: '3month', done: false, createdAt: Date.now() },
    { id: uuid(), title: '10+ פניות לאירועים', scope: '3month', done: false, createdAt: Date.now() },
    { id: uuid(), title: 'סיום מסע ההפקה', scope: '3month', done: false, createdAt: Date.now() },

    { id: uuid(), title: 'סשן עם עוז', scope: 'week', done: true, createdAt: Date.now() },
    { id: uuid(), title: '3 פוסטים באינסטה', scope: 'week', done: false, createdAt: Date.now() },
    { id: uuid(), title: 'אימון 4 פעמים', scope: 'week', done: false, createdAt: Date.now() },
  ];

  state.shutdowns = state.shutdowns || {};
  state.shutdowns[dateBack(1)] = {
    mood: 4,
    note: 'יום פרודוקטיבי, עוז ואני מתקדמים יפה במאשאפ',
    savedAt: new Date().toISOString(),
  };

  saveState();
  recomputeStreaks();
  saveState();
  renderAll();
  toast('✨ דאטה לדוגמה נטענה');
}

// ============ First-Run Help ============
function maybeShowFirstRunHelp() {
  const dismissed = localStorage.getItem('firstrun-dismissed');
  const totalTasks = state.tasks.length;

  const el = $('#firstrun-help');
  if (!el) return;

  // Hide if user has 10+ tasks (they know the app) or dismissed it
  if (dismissed || totalTasks >= 10) {
    el.classList.add('hidden');
  } else {
    el.classList.remove('hidden');
  }
}

$('#firstrun-dismiss').addEventListener('click', () => {
  $('#firstrun-help').classList.add('hidden');
  localStorage.setItem('firstrun-dismissed', '1');
});

document.querySelectorAll('.firstrun-card').forEach(card => {
  card.addEventListener('click', () => {
    const action = card.dataset.action;
    buzz(10);
    if (action === 'demo') {
      loadDemoData();
      $('#firstrun-help').classList.add('hidden');
    }
    else if (action === 'morning') openMorningRitual();
    else if (action === 'cmd') openCmdBar();
    else if (action === 'nl') {
      $('#fab').click();
      setTimeout(() => {
        const input = $('#modal-title');
        if (input) {
          input.value = 'מחר ב-10 ';
          input.focus();
          // Trigger NL parse
          input.dispatchEvent(new Event('input'));
        }
      }, 200);
    }
  });
});

loadState();
renderAll();
maybeShowFirstRunHelp();
maybeShowMorningRitual();
maybeShowWeeklySummary();
maybeShowShutdownBanner();

setInterval(() => {
  renderHero();
  maybeShowShutdownBanner();
}, 60_000);

// Debug helpers
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
  forceShutdown: () => openShutdownModal(),
  forceMorning: () => openMorningRitual(),
  forceDone: () => showDoneForDay(),
  forceCmd: () => openCmdBar(),
  demo: () => loadDemoData(),
  reset: () => {
    if (confirm('למחוק את כל הנתונים?')) {
      localStorage.removeItem(STORAGE_KEY);
      location.reload();
    }
  },
};
