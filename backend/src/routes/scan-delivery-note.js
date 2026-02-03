import { Router } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';

const router = Router();

const RATE_LIMIT_MESSAGE = 'המערכת בעומס קל, אנא המתן 30 שניות ונסה שוב';
const RETRY_DELAY_MS = 2000; // 2 שניות לפני מעבר למפתח הגיבוי

/** זיהוי שגיאת עומס (429 / Resource Exhausted) */
function isRateLimitError(err) {
  const msg = (err?.message || err?.toString || '').toString();
  const status = err?.status ?? err?.statusCode ?? err?.response?.status;
  return (
    status === 429 ||
    msg.includes('429') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('rate limit') ||
    msg.includes('quota') ||
    msg.includes('Too Many Requests')
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function tryGenerateContent(genAI, base64Data) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  return model.generateContent([
    { inlineData: { mimeType: 'image/jpeg', data: base64Data } },
    { text: PROMPT },
  ]);
}

const PROMPT = `אתה מומחה לחילוץ נתונים מתעודות משלוח.
נתון לך תמונה של תעודת משלוח (חשבונית/הזמנה).
חלץ את הנתונים הבאים בפורמט JSON בלבד, ללא טקסט נוסף:
{
  "supplier_name": "שם הספק כפי שמופיע בתעודה",
  "date": "YYYY-MM-DD (תאריך התעודה)",
  "products": [
    { "product_name": "שם המוצר", "quantity": מספר, "unit": "יחידה (ק\"ג, יח', קרטון וכו')" }
  ]
}

אם לא ניתן לזהות ערך – השתמש ב-null.
חשוב: החזר רק JSON תקף, ללא markdown, ללא הסברים.`;

router.post('/', async (req, res, next) => {
  try {
    const primaryKey = process.env.GOOGLE_API_KEY;
    const backupKey = process.env.GOOGLE_API_KEY_BACKUP;
    if (!primaryKey && !backupKey) {
      return res.status(503).json({ error: 'שירות הסריקה לא מוגדר. יש להגדיר GOOGLE_API_KEY או GOOGLE_API_KEY_BACKUP.' });
    }

    const { image } = req.body;
    if (!image || typeof image !== 'string') {
      return res.status(400).json({ error: 'נדרשת תמונה בפורמט base64.' });
    }

    let base64Data = image;
    if (base64Data.includes(',')) {
      base64Data = base64Data.split(',')[1];
    }

    let result;
    let lastErr;

    // 1. פנייה קודם כל עם המפתח הראשי (GOOGLE_API_KEY)
    if (primaryKey) {
      try {
        const genAI = new GoogleGenerativeAI(primaryKey);
        result = await tryGenerateContent(genAI, base64Data);
      } catch (err) {
        lastErr = err;
        if (!isRateLimitError(err)) throw err;
      }
    }

    // 2. אם 429 / Resource Exhausted – המתנה 2 שניות ואז ניסיון חוזר עם מפתח הגיבוי (GOOGLE_API_KEY_BACKUP)
    if (!result && backupKey && lastErr && isRateLimitError(lastErr)) {
      await sleep(RETRY_DELAY_MS);
      try {
        const genAI = new GoogleGenerativeAI(backupKey);
        result = await tryGenerateContent(genAI, base64Data);
        lastErr = null;
      } catch (err) {
        lastErr = err;
        if (!isRateLimitError(err)) throw err;
      }
    }

    if (!result && lastErr) {
      if (isRateLimitError(lastErr)) {
        return res.status(503).json({ error: RATE_LIMIT_MESSAGE });
      }
      throw lastErr;
    }
    const response = result.response;
    const text = response?.text?.()?.trim() || '';
    if (!text) {
      return res.status(502).json({ error: 'לא התקבלה תשובה מהמערכת.' });
    }

    let jsonText = text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) jsonText = jsonMatch[0];

    const parsed = JSON.parse(jsonText);
    const supplier_name = parsed.supplier_name || '';
    const date = parsed.date || new Date().toISOString().slice(0, 10);
    const products = Array.isArray(parsed.products)
      ? parsed.products
          .filter((p) => p && (p.product_name || p.product_name === 0))
          .map((p) => ({
            product_name: String(p.product_name || '').trim(),
            quantity: Number(p.quantity) || 1,
            unit: String(p.unit || "יח'").trim() || "יח'",
          }))
      : [];

    res.json({ supplier_name, date, products });
  } catch (err) {
    if (err instanceof SyntaxError) {
      return res.status(502).json({ error: 'המערכת לא הצליחה לפרש את התשובה.' });
    }
    if (isRateLimitError(err)) {
      return res.status(503).json({ error: RATE_LIMIT_MESSAGE });
    }
    next(err);
  }
});

export default router;
