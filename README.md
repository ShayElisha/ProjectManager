# NexusProject (corePilot)

מערכת ניהול פרויקטים מתקדמת — מקבילה ל-MS Project Premium / Plan 5, עם תמיכה מלאה ב-RTL/LTR (עברית ואנגלית).

## מבנה Monorepo

| חבילה | תיאור |
|--------|--------|
| `packages/shared` | טיפוסים, מנוע CPM, EVM, זיהוי הקצאת יתר |
| `packages/api` | NestJS + WebSocket (Socket.io) |
| `packages/web` | React + Vite + Tailwind + i18n |

## התקנה והרצה

```bash
# דרוש Node 20+ ו-pnpm
corepack enable
pnpm install
pnpm build

# טרמינל 1 — API (פורט 3001)
pnpm --filter @nexus/api dev

# טרמינל 2 — Web (פורט 5173)
pnpm --filter @nexus/web dev
```

פתח: http://localhost:5173

## יכולות מיושמות

- **תצוגות:** גאנט (RTL + גרירה/מתיחה + קווי תלויות), גיליון, קנבן, לוח שנה, ציר זמן
- **תזמון:** CPM, נתיב קריטי, יצירת משימות, קווי בסיס (עד 11)
- **פורטפוליו:** תצוגת PMO, זיהוי התנגשויות משאבים בין פרויקטים
- **משאבים:** היסטוגרמה, הקצאת יתר, המלצות החלקה + החלה
- **EVM:** PV, EV, AC, CPI, SPI
- **שיתוף:** Timesheets, התראות, WebSocket
- **UX:** Dark/Light, Command Palette (Ctrl+K), עברית/אנגלית RTL/LTR
- **AI Copilot:** ניתוח סיכונים, יצירת תוכנית עבודה מפרומפט
- **Virtual Scrolling:** גאנט עם אלפי משימות (כפתור "טען 1000 משימות")
- **PostgreSQL:** Prisma ORM עם fallback ל-in-memory
- **ייצוא/ייבוא:** Excel (.xlsx) export + import
- **דוחות:** סטטוס, משאבים, תזרים מזומנים
- **הגדרות:** שפה, ערכת נושא
- **גיליון:** עריכה inline + מגירת פרטי משימה
- **החלקת משאבים:** אוטומטית (לא משימות בנתיב קריטי)

### PostgreSQL (אופציונלי)

```bash
docker compose up -d
cp .env.example packages/api/.env
# ערוך DATABASE_URL ב-.env

pnpm --filter @nexus/api db:push
pnpm --filter @nexus/api dev
```

ללא `DATABASE_URL` — המערכת רצה על in-memory (ברירת מחדל).

## Roadmap (לפי PRD)

- Redis cache + pub/sub
- Bryntum/dhtmlx Gantt מלא עם Virtual Scrolling
- Resource Leveling אוטומטי
- Portfolio / PPM
- SSO (SAML/Azure AD)
- יבוא/יצוא .mpp
- AI Copilot

## API עיקרי

```
GET  /api/portfolio
GET  /api/projects
GET  /api/projects/:id/tasks
POST /api/projects/:id/tasks
PATCH /api/projects/:id/tasks/:taskId
POST /api/projects/:id/tasks/recalculate
GET  /api/projects/:id/tasks/baselines
POST /api/projects/:id/tasks/baselines
GET  /api/projects/:id/evm
GET  /api/projects/:id/resources
GET  /api/projects/:id/resources/histogram
GET  /api/projects/:id/resources/leveling
GET  /api/ai/projects/:id/analyze
POST /api/ai/generate-plan
POST /api/ai/projects/:id/apply-plan
POST /api/projects/:id/tasks/generate-demo
GET  /api/projects/:id/export
POST /api/projects/:id/import
GET  /api/projects/:id/reports/status
GET  /api/projects/:id/reports/resources
GET  /api/projects/:id/reports/cashflow
POST /api/projects/:id/resources/auto-level
```

WebSocket: `join:project`, אירועים `schedule:updated`, `task:updated`
