# כל מה שצריך להריץ + העלאה לענן

## 1. מיגרציות במסד הנתונים

מריצים **פעם אחת** מול ה-DB (מקומי או ב-Render). אם כבר הרצת חלק – אפשר להריץ רק את מה שחסר.

### אופציה א: עם Node (מומלץ – משתמש ב־DATABASE_URL מ-.env)

```bash
# מתוך שורש הפרויקט (eli labin)
node backend/run-all-migrations.js
```

הסקריפט מריץ לפי הסדר:
- `migration_warehouses.sql` – טבלת מחסנים + שדה מחסן בפקודות רכש
- `migration_inventory_multiple_warehouses.sql` – מלאי רב־מחסני (מלאי, תנועות, הרחבת מחסנים ומשתמשים)

### אופציה ב: עם psql

```bash
# החלף את YOUR_DATABASE_URL בכתובת ה-DB (מהסביבה או מ-.env)
psql "YOUR_DATABASE_URL" -f docs/database/migration_warehouses.sql
psql "YOUR_DATABASE_URL" -f docs/database/migration_inventory_multiple_warehouses.sql
```

### אם ה-DB ריק – קודם סכמה

```bash
node backend/run-schema.js
# אחר כך:
node backend/run-all-migrations.js
```

---

## 2. הרצה מקומית (בדיקה)

```bash
# Backend
cd backend && npm install && npm start

# Frontend (טרמינל נוסף)
cd frontend && npm install && npm run dev
```

ב-.env ב-frontend (או ב-.env בשורש עם Vite):
- `VITE_API_URL=http://localhost:5000`

---

## 3. העלאה לענן

### Git – דחיפה ל-repo

```bash
git add .
git commit -m "מחסנים, מלאי רב-מחסני, מחיקת פקודה, בוצע + מחסן"
git push origin main
```

### Vercel (Frontend)

1. התחבר ל-[vercel.com](https://vercel.com) וחבר את ה-repo.
2. **Environment Variables** בפרויקט:
   - `VITE_API_URL` = כתובת ה-Backend (למשל: `https://bikurim-api.onrender.com`)
3. Deploy אוטומטי אחרי `git push` (או Deploy ידני מהדשבורד).

אם משתמשים ב-CLI:

```bash
cd frontend
npx vercel --prod
```

(וודא ש-`VITE_API_URL` מוגדר בסביבת Vercel.)

### Render (Backend)

1. ב-[render.com](https://render.com): **Dashboard** → ה-service של ה-Backend (למשל `bikurim-api`).
2. **Environment**:
   - `DATABASE_URL` = connection string של PostgreSQL (מ-Render או חיצוני).
   - `NODE_ENV` = `production` (אם לא כבר).
   - `GROQ_API_KEY` = מפתח Groq (לוח מכוונים – תחזיות מלאי, מודל llama-3.3-70b-versatile).
   - `GOOGLE_API_KEY_BACKUP` = מפתח Gemini גיבוי (אם Groq לא זמין).
   - `GOOGLE_API_KEY` = מפתח Gemini (סריקת תעודות, ניסוח מייל).
3. **Deploy**:
   - אם ה-repo מחובר – Deploy אוטומטי אחרי `git push`.
   - או **Manual Deploy** → **Deploy latest commit**.

---

## 4. מיגרציות על DB בענן (Render/אחר)

אם ה-DB רץ ב-Render (או בענן אחר):

**אופציה א:** להריץ מהמחשב עם `DATABASE_URL` של הענן:

```bash
# ב-.env (זמני) שים את DATABASE_URL של ה-production
node backend/run-all-migrations.js
```

**אופציה ב:** ב-Render – **Shell** (אם זמין):

```bash
cd backend && node run-all-migrations.js
```

(וודא ש-`DATABASE_URL` מוגדר ב-Environment של ה-service.)

---

## 5. רענון ניתוח AI לתחזית (יומי)

ניתוח ה-AI בתחזית המוצרים נשמר במסד הנתונים. כדי שיעודכן אוטומטית כל יום:

- **Endpoint:** `GET /api/dashboard/refresh-forecast-analysis` (על ה-Backend ב-Render).
- **פעולה:** מריץ ניתוח (Groq/Gemini) לכל מוצרים בתחזית (30, 60, 90 יום) ושומר את התוצאות.
- **Cron:** ב-Render – **Dashboard** → **Cron Jobs** → צור Cron Job חדש:
  - **Schedule:** `0 6 * * *` (כל יום ב־06:00) או לפי צורך.
  - **Command:** `curl -X GET "https://bikurim-api.onrender.com/api/dashboard/refresh-forecast-analysis"` (החלף בכתובת ה-API האמיתית).

אחרי הרצה יומית, בלוח המכוונים יוצג הניתוח השמור עם ציון "עודכן ב־[תאריך]".

---

## 6. סיכום פקודות (הכל ברצף)

```bash
# 1. מיגרציות (מהשורש של הפרויקט, עם .env שמכיל DATABASE_URL)
node backend/run-all-migrations.js

# 2. העלאה לענן
git add .
git commit -m "מחסנים + מלאי רב-מחסני + פקודות רכש (מחיקה, בוצע, מחסן)"
git push origin main
```

אחרי ה-push: Vercel ו-Render יעלו אוטומטית (אם ה-repo מחובר). וודא ש-`VITE_API_URL` ב-Vercel מצביע ל-URL של ה-Backend ב-Render.

**מיגרציה חדשה:** אם הוספת `migration_forecast_analysis.sql`, הרץ `node backend/run-all-migrations.js` (פעם אחת).
