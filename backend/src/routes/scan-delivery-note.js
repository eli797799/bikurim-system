import { Router } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';

const router = Router();

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
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ error: 'שירות הסריקה לא מוגדר. יש להגדיר GOOGLE_API_KEY.' });
    }

    const { image } = req.body;
    if (!image || typeof image !== 'string') {
      return res.status(400).json({ error: 'נדרשת תמונה בפורמט base64.' });
    }

    let base64Data = image;
    if (base64Data.includes(',')) {
      base64Data = base64Data.split(',')[1];
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: base64Data,
        },
      },
      { text: PROMPT },
    ]);

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
    next(err);
  }
});

export default router;
