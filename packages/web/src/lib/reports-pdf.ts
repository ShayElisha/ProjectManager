import type { CashFlowReport, ProjectStatusReport, ResourceLoadReport } from "@nexus/shared";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function exportReportsPdf(opts: {
  projectName: string;
  status: ProjectStatusReport | null;
  resources: ResourceLoadReport | null;
  cashflow: CashFlowReport | null;
  title: string;
}): void {
  const { projectName, status, resources, cashflow, title } = opts;
  const statusBlock = status
    ? `<p>Progress: ${status.percentComplete}% · Health: ${status.health} · Late: ${status.lateTaskCount}</p>`
    : "";
  const resourceRows =
    resources?.resources
      .map(
        (r) =>
          `<tr><td>${escapeHtml(r.name)}</td><td>${r.peakUtilizationPct}%</td><td>${r.totalAssignedHours}h</td></tr>`,
      )
      .join("") ?? "";
  const cashRows =
    cashflow?.points
      .map((p) => `<tr><td>${p.month}</td><td>${p.planned}</td><td>${p.actual}</td></tr>`)
      .join("") ?? "";

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="utf-8"/>
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: system-ui, sans-serif; padding: 24px; color: #111; }
    h1 { font-size: 1.25rem; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th, td { border: 1px solid #ccc; padding: 8px; text-align: right; }
    th { background: #f0f0f0; }
    @media print { body { padding: 12px; } }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p>${escapeHtml(projectName)} · ${new Date().toLocaleString()}</p>
  <h2>Status</h2>
  ${statusBlock}
  <h2>Resources</h2>
  <table><thead><tr><th>Name</th><th>Peak %</th><th>Hours</th></tr></thead><tbody>${resourceRows}</tbody></table>
  <h2>Cash flow</h2>
  <table><thead><tr><th>Month</th><th>Planned</th><th>Actual</th></tr></thead><tbody>${cashRows}</tbody></table>
</body>
</html>`;

  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 400);
}
