import type { RankedVendor, VendorComparison } from "@nexus/shared";

export function exportVendorQuotesPdf(
  comparison: VendorComparison,
  ranked: RankedVendor[],
  labels: Record<string, string>,
): void {
  const rows = ranked
    .map(
      (r) => `
    <tr>
      <td>${r.rank}</td>
      <td>${escapeHtml(r.vendor.name)}</td>
      <td>${labels[`status.${r.vendor.status}`] ?? r.vendor.status}</td>
      <td>${fmtMoney(r.vendor.quotedPrice)}</td>
      <td>${r.vendor.deliveryDays ?? "—"}</td>
      <td><strong>${r.finalScore.toFixed(2)}</strong></td>
    </tr>`,
    )
    .join("");

  const criteriaRows = comparison.criteria
    .map((c) => `<li>${escapeHtml(c.name)} — ${c.weight}%</li>`)
    .join("");

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="utf-8"/>
  <title>${escapeHtml(comparison.rfq.rfqNumber)}</title>
  <style>
    body { font-family: system-ui, sans-serif; padding: 24px; color: #111; }
    h1 { font-size: 1.25rem; margin-bottom: 4px; }
    .meta { color: #555; font-size: 0.875rem; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th, td { border: 1px solid #ccc; padding: 8px; text-align: right; }
    th { background: #f0f0f0; }
    ul { margin: 8px 0; padding-right: 20px; }
    @media print { body { padding: 12px; } }
  </style>
</head>
<body>
  <h1>${escapeHtml(comparison.rfq.title)}</h1>
  <p class="meta">${escapeHtml(comparison.rfq.rfqNumber)} · ${escapeHtml(comparison.rfq.dueDate)}</p>
  <p>${escapeHtml(comparison.rfq.description || "")}</p>
  <h2>${escapeHtml(labels.criteria ?? "קריטריונים")}</h2>
  <ul>${criteriaRows}</ul>
  <h2>${escapeHtml(labels.ranking ?? "דירוג ספקים")}</h2>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>${escapeHtml(labels.vendor ?? "ספק")}</th>
        <th>${escapeHtml(labels.status ?? "סטטוס")}</th>
        <th>${escapeHtml(labels.price ?? "מחיר")}</th>
        <th>${escapeHtml(labels.delivery ?? "ימי אספקה")}</th>
        <th>${escapeHtml(labels.score ?? "ציון")}</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <p style="margin-top:16px;font-size:0.75rem;color:#666">
    Final Score = Σ (Criterion Weight × Vendor Score)
  </p>
  <script>window.onload = () => { window.print(); }</script>
</body>
</html>`;

  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtMoney(n: number): string {
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: 0,
  }).format(n);
}
