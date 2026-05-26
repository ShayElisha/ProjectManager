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

### הגדרות Dashboard (חובה — מונע שגיאות חוזרות)

**Settings → General → Build & Development**

| שדה | ערך נכון |
|-----|----------|
| **Build Command** | ריק (Override מכובה) — או `pnpm -w run build:vercel` |
| **Install Command** | ריק — או `pnpm install --frozen-lockfile` |
| **Output Directory** | ריק — או `dist` אם Root = `packages/web`, או `packages/web/dist` אם Root = שורש הריפו |

> **למה `ERR_PNPM_NO_SCRIPT build:vercel`?**  
> Vercel מריץ פקודות מתוך **Root Directory** (למשל `packages/web`). הסקריפט `build:vercel` מוגדר רק ב-`package.json` **של שורש המונורפו**.  
> פתרון: תמיד `pnpm -w run build:vercel` (`-w` = workspace root), או Override ב-Dashboard שמצביע על הסקריפט הזה — **לא** `pnpm run build:vercel` בלי `-w`.

**Root Directory** — בחר **אחד** (לא לערבב):

| Root Directory | Output Directory | קובץ הגדרות |
|----------------|------------------|-------------|
| ריק (שורש הריפו) | `packages/web/dist` | `vercel.json` בשורש |
| `packages/web` | `dist` | `packages/web/vercel.json` |

> אם Root = `packages/web` אבל Output בשורש מוגדר כ-`packages/web/dist` — Vercel יחפש `packages/web/packages/web/dist` ויכשל. השאר Output **ריק** ב-Dashboard.

> **Output Directory ב-Dashboard:** מחק `public` / `dist` ידניים — `vercel.json` קובע (`dist` או `packages/web/dist`). אם חייבים להשאיר `public`, הבילד מעתיק גם לשם אוטומטית.

**Production URL:** בדוק ב-Vercel → Domains את הדומיין האמיתי (למשל `core-pilote.vercel.app`). אם `/` מחזיר `404 NOT_FOUND`, הבילד לא העלה קבצים סטטיים.

אחרי הבילד, `scripts/vercel-prepare.mjs` מעתיק:
- `packages/web/dist` → `dist` (בשורש הריפו)
- `packages/api/dist` → `api/nest` ו-`packages/web/api/nest` (כדי שה-Serverless Function יכלול את Nest)

אם Root Directory = `packages/web`, ה-API חייב להיות ב-`packages/web/api/` (כבר מוגדר ב-repo).

אם Vercel עדיין נכשל, הגדר ידנית:
- Install Command: `pnpm install --frozen-lockfile`
- Build Command: `pnpm -w run build:vercel`
- Output Directory: לפי הטבלה למעלה

## מבנה הפריסה

```
vercel.json          → build + SPA fallback + rewrite ל-API
api/index.ts         → כל בקשות /api/* (מייבא מ-`api/nest/serverless.js` שנבנה בבילד)
packages/web/dist    → React SPA
packages/api/dist    → NestJS (serverless-http)
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
