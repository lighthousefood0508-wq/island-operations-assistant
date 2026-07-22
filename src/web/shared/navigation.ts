type SystemArea = "pos" | "kitchen" | "admin";
type BackOfficeArea = "catalog" | "events" | "statistics" | "health";

const systemItems: readonly { key: SystemArea; href: string; label: string }[] = [
  { key: "pos", href: "/pos", label: "POS" },
  { key: "kitchen", href: "/kitchen", label: "Kitchen" },
  { key: "admin", href: "/admin", label: "Back Office" }
];

const backOfficeItems: readonly { key: BackOfficeArea; href: string; label: string }[] = [
  { key: "catalog", href: "/admin", label: "商品目錄" },
  { key: "events", href: "/admin/events", label: "場次與備貨" },
  { key: "statistics", href: "/admin/statistics", label: "今日統計" },
  { key: "health", href: "/admin/health", label: "系統狀態" }
];

export function renderNavigationStyles(): string {
  return `.system-nav,.office-nav{position:sticky;top:0;z-index:20;display:flex;gap:8px;align-items:center;overflow-x:auto;background:#f8fbf9;border-bottom:1px solid #cbd8d4;padding:10px 14px}.office-nav{position:static;border:1px solid #cbd8d4;border-radius:6px;margin:14px 0;background:#fff}.system-nav a,.office-nav a{white-space:nowrap;text-decoration:none;color:#244b50;border:1px solid #c4d3cf;background:#eef4f1;border-radius:6px;padding:10px 13px;font-weight:700}.system-nav a[aria-current="page"],.office-nav a[aria-current="page"]{background:#165b59;border-color:#165b59;color:#fff}@media(max-width:680px){.system-nav,.office-nav{padding:8px}.system-nav a,.office-nav a{padding:10px 12px}}`;
}

export function renderSystemNav(active: SystemArea): string {
  return `<nav class="system-nav" aria-label="系統導覽">${systemItems.map((item) => `<a href="${item.href}"${item.key === active ? ` aria-current="page"` : ""}>${item.label}</a>`).join("")}</nav>`;
}

export function renderBackOfficeNav(active: BackOfficeArea): string {
  return `<nav class="office-nav" aria-label="Back Office 導覽">${backOfficeItems.map((item) => `<a href="${item.href}"${item.key === active ? ` aria-current="page"` : ""}>${item.label}</a>`).join("")}</nav>`;
}
