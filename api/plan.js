// Vercel Edge Function — Gemini AI Plan
// POST /api/plan
// Body: { tasks: [...], inbox: [...], context: '...' }
// Returns: { plan: [...], insights: '...' }

export const config = { runtime: 'edge' };

const GEMINI_MODEL = 'gemini-2.0-flash';

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'AI not configured yet', fallback: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();
    const { tasks = [], inbox = [], hour = new Date().getHours() } = body;

    // Build a focused prompt in Hebrew
    const tasksList = tasks.length
      ? tasks.map((t, i) => `${i + 1}. ${t.title}${t.startTime ? ' (' + t.startTime + ')' : ''}${t.category ? ' [' + t.category + ']' : ''}`).join('\n')
      : '(אין משימות מתוזמנות)';

    const inboxList = inbox.length
      ? inbox.map((i, n) => `${n + 1}. ${i.content}`).join('\n')
      : '(Inbox ריק)';

    const prompt = `אתה עוזר אישי של טהר (18, DJ + מינהלה + הפקה). השעה עכשיו: ${hour}:00.

המשימות המתוזמנות להיום:
${tasksList}

ה-Inbox (דברים לסדר):
${inboxList}

תפקידך: לספק תכנון חכם בעברית. החזר JSON בלבד, במבנה הזה:
{
  "insight": "משפט אחד קצר עם תובנה על היום (max 80 תווים)",
  "suggestions": [
    {"title": "משימה מהInbox שכדאי לתזמן", "time": "10:00", "reason": "למה בזמן הזה"}
  ],
  "wisdom": "טיפ קצר ופוקוסיבי (max 60 תווים)"
}

חשוב: תן 1-3 הצעות מהInbox בלבד. אם הInbox ריק, suggestions = []. תכתוב בעברית פשוטה וישירה.`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 500,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return new Response(JSON.stringify({ error: 'Gemini error', detail: errText, fallback: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      parsed = { insight: 'תכנן יום מאוזן.', suggestions: [], wisdom: 'אחד צעד אחד.' };
    }

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message, fallback: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
