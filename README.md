# מערכת קניין ורשימות קנייה – ביכורים

מערכת Web מבוססת ענן: ניהול ספקים ומוצרים, פקודות רכש עם שיבוץ אוטומטי של הספק הזול ביותר.

## מבנה הפרויקט

```
eli labin/
├── .env                 # הגדרות (לא ב-Git) – העתק מ-.env.example
├── .env.example
├── .gitignore
├── backend/              # Node.js + Express
│   ├── package.json
│   └── src/
│       ├── config/db.js
│       ├── index.js
│       ├── middleware/error.js
│       └── routes/
│           ├── categories.js
│           ├── products.js
│           ├── suppliers.js
│           └── shopping-lists.js
├── frontend/             # React (Vite) – RTL, עברית
│   ├── package.json
│   ├── index.html
│   ├── vite.config.js
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── api.js
│       ├── index.css
│       └── pages/
│           ├── Suppliers.jsx, SupplierCard.jsx
│           ├── Products.jsx, ProductCard.jsx
│           └── ShoppingLists.jsx, ShoppingListCard.jsx
└── docs/database/
    ├── schema.sql        # סכמת PostgreSQL (כולל order_number מ-1000)
    └── ERD.md
```

## דרישות

- Node.js 18+
- PostgreSQL (תמיכה ב-UTF-8 / עברית)

## התקנה והרצה

### 1. מסד נתונים

- צור DB: `CREATE DATABASE bikurim_procurement ENCODING 'UTF8';`
- הרץ את הסכמה: `psql -U USER -d bikurim_procurement -f docs/database/schema.sql`
- **מיגרציה ל-DB קיים** (הוספת סטטוס לפקודות רכש): `node backend/run-migration-status.js` או `cd backend && npm run migrate:status`

### 2. הגדרות (.env) – איפה מגדירים DATABASE_URL

**מיקום הקובץ:** קובץ `.env` חייב להיות **בשורש הפרויקט** – בתיקייה `eli labin` (זו התיקייה שמכילה את `backend`, `frontend` ו-`.env.example`).

**יצירת הקובץ (Windows):**

```powershell
cd "c:\Users\Admin\Desktop\eli labin"
copy .env.example .env
```

**עריכת `.env`:** פתח את הקובץ `.env` ועדכן את השורה:

```env
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/bikurim_procurement
```

- החלף `USER` בשם המשתמש של PostgreSQL אצלך.
- החלף `PASSWORD` בסיסמה של PostgreSQL.
- אם ה-DB על פורט אחר או שרת אחר – עדכן בהתאם (`localhost:5432` = שרת מקומי, פורט 5432).

שאר השורות ב-`.env` (אופציונלי):

- `BACKEND_PORT=5000` – פורט שרת ה-API.
- `VITE_API_URL=http://localhost:5000` – כתובת ה-API עבור ה-Frontend (בפיתוח).

הפרויקט מבודד: כל ההגדרות רק ב-.env בתיקייה הזו, ולא משפיעות על פרויקטים אחרים.

### 3. הרצת Backend ו-Frontend בו-זמנית

צריך **שני טרמינלים** (או שני טאבים).

**טרמינל 1 – Backend:**

```powershell
cd "c:\Users\Admin\Desktop\eli labin\backend"
npm run dev
```

השאר את הטרמינל פתוח. השרת יעלה על `http://localhost:5000`.

**טרמינל 2 – Frontend:**

```powershell
cd "c:\Users\Admin\Desktop\eli labin\frontend"
npm run dev
```

השאר את הטרמינל פתוח. הממשק יעלה על `http://localhost:3000` (RTL, עברית).

**אם התקנת ה-Frontend נכשלת:** נסה:

```powershell
cd "c:\Users\Admin\Desktop\eli labin\frontend"
npm install --legacy-peer-deps
npm run dev
```

## תכונות עיקריות

- **פקודות רכש** (במקום "רשימות קנייה"): שם המערכת ליחידת העבודה המרכזית.
- **מספר סידורי:** כל פקודה מקבלת `order_number` ייחודי (מ-1000, PostgreSQL SEQUENCE).
- **סטטוס:** טיוטה → מאושרת → בוצעה. פקודה שבוצעה אינה ניתנת לעריכה.
- **ספק זול אוטומטית:** בהוספת פריט, המערכת משבצת את הספק הזול ביותר.
- **ריבוי ספקים:** אייקון ⚠ כשיש כמה ספקים; בחירה ידנית בחלון פירוט; התרעה כשנבחר ספק יקר יותר.
- **שכפול:** שכפול פקודה קיימת (כולל פריטים) לפקודה חדשה במצב טיוטה.
- **קיבוץ לפי ספק:** תצוגה מקובצת + סיכום סכום לכל ספק.

## API (תמצית)

- `GET/POST /api/suppliers`, `GET/PATCH/DELETE /api/suppliers/:id`, `POST /api/suppliers/:id/products`
- `GET/POST /api/products`, `GET/PATCH/DELETE /api/products/:id`
- `GET /api/categories`
- `GET/POST /api/shopping-lists`, `GET/PATCH/DELETE /api/shopping-lists/:id`
- `POST /api/shopping-lists/:id/items` – מוסיף פריט ומשבץ אוטומטית ספק זול + מחיר
- `GET /api/shopping-lists/:id/by-supplier` – פיצול לפי ספקים

---

## איפוס נתונים לפני פיילוט

לאפס את כל נתוני הניסיון ולהתחיל מחדש (הפקודה הבאה תהיה #1000):

```powershell
cd "c:\Users\Admin\Desktop\eli labin\backend"
node run-reset-pilot.js
```

**נמחק:** ספקים, מוצרים, קשרי ספק-מוצר, פקודות רכש, פריטי פקודות, היסטוריית מחירים.  
**נשמר:** קטגוריות, משתמשים, מבנה הטבלאות.

---

## פריסה לענן (Deployment)

### Backend (Render) + Frontend (Vercel)

**שלב 1 – Backend ב-Render**

1. היכנס ל-[render.com](https://render.com) והתחבר עם GitHub.
2. **New** → **Web Service**.
3. חבר את הריפו של הפרויקט (או העלה את הקבצים).
4. הגדרות:
   - **Name:** `bikurim-api`
   - **Runtime:** Node
   - **Build Command:** `cd backend && npm install`
   - **Start Command:** `cd backend && npm start`
   - **Environment:** הוסף `DATABASE_URL` עם מחרוזת החיבור ל-Supabase (מ-Supabase Dashboard → Project Settings → Database).
5. לחץ **Create Web Service**.
6. חכה לסיום ה-Build. העתק את כתובת ה-URL (למשל: `https://bikurim-api.onrender.com`).

**שלב 2 – Frontend ב-Vercel**

1. היכנס ל-[vercel.com](https://vercel.com) והתחבר עם GitHub.
2. **Add New** → **Project** → בחר את הריפו.
3. הגדרות:
   - **Framework Preset:** Other
   - **Root Directory:** (השאר ריק – הפרויקט בשורש)
   - **Build Command:** `cd frontend && npm install && npm run build`
   - **Output Directory:** `frontend/dist`
   - **Environment Variables:** הוסף:
     - `VITE_API_URL` = כתובת ה-Backend (למשל: `https://bikurim-api.onrender.com`) – **ללא** `/api` בסוף.
4. לחץ **Deploy**.
5. לאחר ההצלחה – העתק את כתובת ה-URL (למשל: `https://bikurim-procurement.vercel.app`).

**שלב 3 – שלח לעובדים**

שלח את הקישור של ה-Frontend ב-Vercel. העובדים ייכנסו מהטלפון או המחשב – המערכת תשתמש אוטומטית ב-Backend בענן.

### עדכונים עתידיים

- **עדכון קוד:** דחיפת קוד חדש ל-GitHub תפעיל Build חדש ב-Vercel וב-Render.
- **נתונים:** כל הנתונים נשמרים ב-Supabase. עדכוני קוד לא מוחקים ולא משנים את הנתונים.

### אבטחה ויציבות

- **order_number:** PostgreSQL משתמש ב-`SEQUENCE` ו-`nextval()` – ערך אטומי. שני עובדים שיוצרים פקודה במקביל יקבלו מספרים שונים (1000, 1001, ...) ללא כפילויות.
- **חיבור Supabase:** ה-Backend משתמש ב-connection pool. החיבור יציב; במקרה ניתוק, ה-pool מתחבר מחדש אוטומטית.
