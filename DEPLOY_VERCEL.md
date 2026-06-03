# פריסה ל-Vercel (Frontend + API Serverless)

הפרויקט מוגדר לפריסה אחת ב-Vercel:
- **Web** — קבצים סטטיים מ-`packages/web/dist`
- **API** — NestJS כפונקציית Serverless תחת `/api/*`

## דרישות

1. חשבון [Vercel](https://vercel.com)
2. **MongoDB Atlas** (חובה בענן — embedded Mongo לא עובד ב-Vercel)
3. Repository מחובר: [ProjectManager](https://github.com/ShayElisha/ProjectManager)

## משתני סביבה ב-Vercel

ב-Vercel → Project → Settings → Environment Variables:

| משתנה | דוגמה | חובה |
|--------|--------|------|
| `DATABASE_URL` | `mongodb+srv://user:pass@cluster.mongodb.net/nexus_project` | כן |
| `CORS_ORIGINS` | `https://your-app.vercel.app` | כן (כתובת האתר שלך) |
| `USE_EMBEDDED_MONGO` | `false` | מומלץ |
| `BOOTSTRAP_ADMIN_EMAIL` | `admin@nexus.local` | אופציונלי |
| `BOOTSTRAP_ADMIN_PASSWORD` | `admin1234` | אופציונלי |
| `FORCE_DB_ON_VERCEL` | `true` | רק אם חייבים לכפות חיבור DB (בדרך כלל לא נדרש) |

> **חשוב:** `DATABASE_URL` חייב להיות `mongodb+srv://...` (Atlas). כתובת `localhost` מה-build **לא** משמשת ב-runtime — בלי Atlas האפליקציה רצה ב-in-memory (מהיר, ללא שמירה בין cold starts).

> ב-Atlas: Network Access → Allow `0.0.0.0/0` (או IP של Vercel), ו-Database User עם הרשאות read/write.

## פריסה מהירה

```bash
# התקנת Vercel CLI (פעם אחת)
npm i -g vercel

# מהשורש של הפרויקט
vercel login
vercel link
vercel env add DATABASE_URL
vercel env add CORS_ORIGINS
vercel --prod
```

או: Import את ה-repo ב-Vercel Dashboard — Framework Preset: **Other**.

### הגדרות Dashboard — **אפשרות א (מומלץ)**

**Settings → General → Build & Development**

| שדה | ערך |
|-----|-----|
| **Root Directory** | `packages/web` (**לא** `packages/api`) |
| **Output Directory** | `dist` |
| **Framework Preset** | Other |
| **Build Command** | ריק (נלקח מ-`packages/web/vercel.json`) |
| **Install Command** | ריק |

> אחרי שמירה: **Deployments → Redeploy** (בלי cache אם אפשר).

> **חשוב:** ב-`.gitignore` אסור `public` או `dist` בלי `/` — זה מסתיר את `packages/web/public` מ-Vercel וגורם ל־`No Output Directory named public found`.

> **למה `ERR_PNPM_NO_SCRIPT build:vercel`?**  
> Vercel מריץ פקודות מתוך **Root Directory** (למשל `packages/web`). הסקריפט `build:vercel` מוגדר רק ב-`package.json` **של שורש המונורפו**.  
> פתרון: תמיד `pnpm -w run build:vercel` (`-w` = workspace root), או Override ב-Dashboard שמצביע על הסקריפט הזה — **לא** `pnpm run build:vercel` בלי `-w`.

קובץ הגדרות: `packages/web/vercel.json` (`outputDirectory: dist` — פלט ישיר מ-Vite, API ב-`packages/web/api/`).

> **Output Directory ב-Dashboard:** מחק `public` / `dist` ידניים — `vercel.json` קובע (`dist` או `packages/web/dist`). אם חייבים להשאיר `public`, הבילד מעתיק גם לשם אוטומטית.

**Production URL:** בדוק ב-Vercel → Domains את הדומיין האמיתי (למשל `core-pilote.vercel.app`). אם `/` מחזיר `404 NOT_FOUND`, הבילד לא העלה קבצים סטטיים.

אחרי הבילד, `scripts/vercel-prepare.mjs` יוצר **`packages/web/api/runtime/`** — חבילת API עצמאית עם כל `node_modules` (דרך `pnpm deploy`), ומעתיק ל-`api/runtime/` לפריסה משורש הריפו.

**בדיקת API אחרי deploy:**
- `GET /api/auth/health` — תשובה מיידית (ללא Nest)
- `POST /api/auth/login` — אמור להחזיר JSON תוך ~10–30 שניות ב-cold start הראשון

אם Root Directory = `packages/web`, ה-API חייב להיות ב-`packages/web/api/` (כבר מוגדר ב-repo).

אם Vercel עדיין נכשל, הגדר ידנית:
- Install Command: `pnpm install --frozen-lockfile`
- Build Command: `pnpm -w run build:vercel`
- Output Directory: לפי הטבלה למעלה

## מבנה הפריסה

```
vercel.json          → build + SPA fallback + rewrite ל-API
api/index.js         → כל בקשות /api/* (מייבא מ-`@nexus/api/dist/serverless.js`)
packages/web/dist    → React SPA
packages/api/dist    → NestJS (serverless-http)
```

## התחברות (Login)

בפריסה ריקה (אין משתמשים ב-MongoDB) נוצר אוטומטית חשבון מנהל:

| שדה | ברירת מחדל |
|-----|------------|
| אימייל | `admin@nexus.local` |
| סיסמה | `admin1234` |

ניתן לשנות ב-Vercel: `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD`.

אפשר גם **הרשמה** (`/register`) — המשתמש נשמר ב-`DATABASE_URL` (Atlas). בלי MongoDB תקין, הנתונים עלולים להימחק ב-cold start (מצב in-memory).

## Preview מחזיר 401 (`manifest.webmanifest`, `api/auth/login`)

אם כתובת מסוג `*-git-main-*.vercel.app` מחזירה **401 Authentication Required** (עם cookie `_vercel_sso_nonce`) — זו **Vercel Deployment Protection**, לא באג באפליקציה. Production (`core-pilote.vercel.app`) עלול לעבוד בזמן שה-Preview חסום.

**פתרון (Dashboard):** Project → **Settings → Deployment Protection** → כבה Vercel Authentication, או בחר **Standard** / **None** לפי הצורך.

**פתרון (CLI, אחרי `vercel login`):**

```bash
node scripts/vercel-disable-sso-protection.mjs core-pilote
```

## הערות

- **WebSocket (עדכונים בזמן אמת)** — לא נתמך ב-Vercel Serverless; האפליקציה עובדת ב-REST. רענון ידני / מעבר בין מסכים יטען נתונים מחדש.
- **Cold start** — הבקשה הראשונה ל-API עלולה לקחת כמה שניות.
- **מקומי** — ממשיך לעבוד עם `pnpm dev` (API על 3001, Web על 5173).

## בדיקה מקומית של build לפריסה

```bash
pnpm install
pnpm run build:vercel
```
