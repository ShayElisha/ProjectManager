# corePilot — Roadmap לסגירת פערי פיצ'רים

מסמך זה מבוסס על [feature-gap.csv](./feature-gap.csv) — **62 פריטים** (59 חסרים + 3 חלקיים).

## מקרא

| שדה | ערכים |
|-----|--------|
| **עדיפות** | P0 = חוסם מוצר · P1 = גבוה · P2 = בינוני · P3 = נמוך · P4 = מחוץ לליבה |
| **מאמץ** | S = ימים בודדים · M = שבוע · L = 2–3 שבועות · XL = חודש+ |

---

## Phase 0 — יסודות (שבועות 1–2)

**מטרה:** אבטחה, ניווט, בסיס לשיתוף פעולה.

| שבוע | פריטים (#) | תוצר |
|------|------------|------|
| **1** | 8 — אימות שרת | JWT/Session, Guards על API, קישור ל-auth בצד לקוח |
| **2** | 52 — RBAC מאוכף · 24 — URL per view · 42 — קיצורי מקלדת | תפקידים: admin / pm / viewer; routes: `/app/projects/:id/gantt` וכו' |

**תלות:** כל שאר הפיצ'רים הארגוניים נשענים על Phase 0.

---

## Phase 1 — שיתוף פעולה יומיומי (שבועות 3–6)

**מטרה:** להשלים פער מול Asana/Monday ברמת Basic.

| שבוע | פריטים (#) | תוצר |
|------|------------|------|
| **3** | 5 — תגובות · 6 — סימון התראות · 25 — @mentions | מודל Comment, התראות mention |
| **4** | 4 — קבצים מצורפים · 56 — Audit log · 27 — Activity feed | העלאה + היסטוריית שינויים |
| **5** | 3 — תגיות · 44 — אילוצי CPM מלאים | tags על Task; CPM מכבד constraints |
| **6** | 7 — חיפוש גלובלי · 22 — תצוגות שמורות | Mongo text index או client filter; שמירת מסנן |

---

## Phase 2 — גמישות משימות (שבועות 7–10)

**מטרה:** שדות מותאמים, דוחות, אינטגרציות קלות.

| שבוע | פריטים (#) | תוצר |
|------|------------|------|
| **7** | 12 — שדות מותאמים · 13 — Rich text · 23 — עמודות מותאמות | מימוש `CustomColumn` |
| **8** | 9 — טיימר · 32 — PDF דוחות | שכבה על timesheets; export דוחות |
| **9** | 26 — Email/Push · 48 — Real-time מלא | SendGrid; הפעלת Socket.io בפרודקשן |
| **10** | 34 — Webhooks · 40 — Email-to-task · 11 — שכפול פרויקט | אירועים: task.created, project.updated |

---

## Phase 3 — Agile ופרויקטים (שבועות 11–15)

**מטרה:** תחרות מול Jira/Linear (אופציונלי לפי קהל יעד).

| שבוע | פריטים (#) | תוצר |
|------|------------|------|
| **11** | 10 — תיקיות · 30 — Guests · 45 — mpp (התחלה) | היררכיית פרויקטים; הזמנת viewer |
| **12** | 15 — משימות חוזרות · 20 — Forms | סדרות משימות; טופס ציבורי |
| **13** | 16 — Epic/Story/Bug · 46 — Skills | `issueType` + backlog view |
| **14** | 17 — ספרינטים · 18 — Story points | Sprint CRUD + burndown |
| **15** | 50 — LLM Copilot · 37 — Roadmap | החלפת/heuristic + API ל-OpenAI |

---

## Phase 4 — אוטומציה ואינטגרציות (שבועות 16–19)

| שבוע | פריטים (#) | תוצר |
|------|------------|------|
| **16** | 19 — Cycles · 57 — Program mgmt | תצוגת roadmap לפי epic |
| **17** | 21 — If-Then · 62 — אוטומציה ארגונית · 33 — Zapier | מנוע כללים + outbound webhooks |
| **18** | 35 — Slack (ראשון) · 31 — בונה דוחות | בוט Slack; drag-drop widgets |
| **19** | 41 — PWA · 49 — BI export | offline read-only; CSV/API ל-BI |

---

## Phase 5 — Enterprise SaaS (שבועות 20+)

**מטרה:** מכירה לארגונים גדולים.

| שבוע | פריטים (#) | תוצר |
|------|------------|------|
| **20+** | 51 — Multi-tenant · 1 — Workspaces | בידוד `organizationId` |
| **20+** | 54 — SSO · 55 — 2FA | SAML + TOTP |
| **20+** | 53 — הרשאות per-task | ACL על משימות |
| **Backlog** | 28, 29, 38, 39, 58–61 | צ'אט, Wiki, CRM, Billing — מחוץ לליבת PM |

---

## סיכום לפי עדיפות (לא לפי זמן)

### P0 — חובה לפני השקה מסחרית
- #8 אימות שרת
- #5 תגובות
- #52 RBAC

### P1 — תחרות יומיומית
- #3 תגיות · #4 קבצים · #6–7 התראות וחיפוש
- #12 שדות מותאמים · #22 תצוגות שמורים · #24 URLs
- #25 mentions · #34 webhooks · #44 CPM constraints
- #51 multi-tenant · #54 SSO · #56 audit

### P2 — בינוני
- Agile (#16–18) · אוטומציה (#21, 62) · אינטגרציות (#26, 35, 48, 50)
- #9 טיימר · #32 PDF · #45 mpp

### P3–P4 — אחר כך / מחוץ לליבה
- Forms, recurring, folders, PWA, Goals, Whiteboard, CRM, Invoicing

---

## מה כבר חזק (לא ב-roadmap)

אין צורך לפתח מחדש — לשפר וללטש בלבד:

- Gantt + CPM + נתיב קריטי
- EVM + תקציב + תזרים
- Resource leveling + portfolio
- PMO: סיכונים, שינויים, דחיות
- Vendor RFQ + השוואת ספקים
- Baselines + S-curve + what-if

---

## שימוש ב-CSV

פתח ב-Excel / Google Sheets (UTF-8). עמודות לסינון:

- `priority` — P0…P4
- `phase_week` — תכנון ספרינט
- `level` — Basic / Standard / Advanced / Enterprise
- `status` — missing / partial

```bash
# מהשורש של הריפו
open docs/feature-gap.csv
```

---

*עודכן: מאי 2026 · מבוסס על מיפוי קוד corePilot (NexusProject)*
