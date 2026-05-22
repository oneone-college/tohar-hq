# Tohar HQ ⚡

מרכז השליטה האישי של טהר — משימות, מטרות, ולוח זמנים.

## מה זה?
אפליקציית PWA שאפשר להתקין בטלפון כמו אפליקציה אמיתית. נועדה לעזור לנהל את כל החזיתות: ONE/ONE, DJ, הפקה, תוכן, כושר, ולימודים.

## פיצ'רים (Phase 1)
- **MIT** — המשימה הכי חשובה היום, בולטת בראש
- **Timeline יומי** — לוח זמנים מ-07:00 עד 23:00 עם בלוקים צבעוניים
- **Inbox** — לזרוק לפה כל מה שעולה לראש, לסדר אחר כך
- **מטרות 4 רמות** — חלומות / שנה / 3 חודשים / שבוע
- **שבוע** — תצוגת 7 ימים
- **יומן יומי** — שדה חופשי
- **PWA** — installable, offline-ready

## פיתוח מקומי
```bash
npm run dev
```
או פשוט לפתוח את `index.html` בדפדפן.

## דיפלוי
Vercel — push ל-main = deploy אוטומטי.

## דאטה
Phase 1: `localStorage` בדפדפן (כל מכשיר נפרד).
Phase 2: יעבור ל-Supabase לסנכרון בין מכשירים.

## מבנה
```
tohar-hq/
├── index.html           דף ראשי
├── styles.css           עיצוב
├── app.js               לוגיקה
├── manifest.json        PWA manifest
├── service-worker.js    offline cache
├── icons/               אייקונים ל-PWA
├── package.json
├── vercel.json
└── README.md
```
