# רשימת Environment Variables לפריסה

## Render (Backend)

| משתנה       | חובה | ערך לדוגמה | הערות |
|-------------|------|------------|--------|
| `DATABASE_URL` | ✓ | `postgresql://postgres.PROJECT:PASSWORD@aws-0-xx.pooler.supabase.com:6543/postgres` | **חשוב:** השתמש בפורט **6543** (Connection Pooler) מ-Supabase כדי למנוע שגיאות חיבור ב-Render. ב-Dashboard: Project Settings → Database → Connection string → URI (Transaction pooler). |
| `GOOGLE_API_KEY` | אופציונלי | `AIza...` | מפתח Google Gemini API לסריקת תעודות משלוח. השג ב-[Google AI Studio](https://aistudio.google.com/apikey). |
| `NODE_ENV`  | אופציונלי | `production` | מוגדר אוטומטית ב-`render.yaml`. |

**איפה להזין ב-Render:** Dashboard → Service → Environment → Add Environment Variable.

---

## Vercel (Frontend)

| משתנה         | חובה | ערך לדוגמה | הערות |
|---------------|------|------------|--------|
| `VITE_API_URL` | ✓ | `https://bikurim-api.onrender.com` | כתובת ה-Backend **בלי** `/api` בסוף. יש להחליף בשם השירות שלך ב-Render. |

**איפה להזין ב-Vercel:** Dashboard → Project → Settings → Environment Variables → Add.

**חשוב:** עדכן את `VITE_API_URL` **לפני** ה-Build הראשון, כי הערך נטמע בקובץ ה-JavaScript בזמן הבנייה.

---

## אבטחה ונתונים

- **Supabase:** ה-`DATABASE_URL` נשמר בהצפנה ב-Render. אין לחשוף אותו ב-Git או בפרונטאנד.
- **נתונים:** כל הנתונים (ספקים, מוצרים, פקודות) נשמרים ב-Supabase. עדכון קוד ב-Render/Vercel **לא** מוחק ולא משנה את הנתונים.
- **order_number:** המספר הסידורי (1000, 1001, ...) נשמר ב-PostgreSQL בענן (Supabase). הוא ימשיך לרוץ תקין גם אחרי פריסות חדשות.
