type SystemArea = "pos" | "kitchen" | "admin";
type BackOfficeArea = "events" | "catalog" | "ingredients" | "cost" | "statistics" | "analysis" | "health" | "devices";

const systemItems: readonly { key: SystemArea; href: string; label: string }[] = [
  { key: "pos", href: "/pos", label: "POS 點餐" },
  { key: "kitchen", href: "/kitchen", label: "廚房系統" },
  { key: "admin", href: "/admin", label: "後台管理" }
];

const backOfficeItems: readonly { key: BackOfficeArea; href: string; label: string }[] = [
  { key: "events", href: "/admin", label: "場次與備貨" },
  { key: "catalog", href: "/admin/catalog", label: "商品目錄" },
  { key: "ingredients", href: "/admin/ingredients", label: "食材主檔" },
  { key: "cost", href: "/admin/cost", label: "成本中心" },
  { key: "statistics", href: "/admin/statistics", label: "今日統計" },
  { key: "analysis", href: "/admin/analysis", label: "場次分析" },
  { key: "health", href: "/admin/health", label: "系統狀態" },
  { key: "devices", href: "/admin/devices", label: "裝置連線" }
];

export function renderNavigationStyles(): string {
  return `.system-nav,.office-nav{position:sticky;top:0;z-index:20;display:flex;gap:8px;align-items:center;overflow-x:auto;background:#f8fbf9;border-bottom:1px solid #cbd8d4;padding:10px 14px}.office-nav{position:static;border:1px solid #cbd8d4;border-radius:6px;margin:14px 0;background:#fff}.system-nav a,.office-nav a{white-space:nowrap;text-decoration:none;color:#244b50;border:1px solid #c4d3cf;background:#eef4f1;border-radius:6px;padding:10px 13px;font-weight:700}.system-nav a[aria-current="page"],.office-nav a[aria-current="page"]{background:#165b59;border-color:#165b59;color:#fff}@media(max-width:680px){.system-nav,.office-nav{padding:8px}.system-nav a,.office-nav a{padding:10px 12px}}`;
}

export function renderSystemNav(active: SystemArea): string {
  return `<nav class="system-nav" aria-label="系統導覽">${systemItems.map((item) => `<a href="${item.href}"${item.key === active ? ` aria-current="page"` : ""}>${item.label}</a>`).join("")}</nav>`;
}

export function renderBackOfficeNav(active: BackOfficeArea): string {
  return `<nav class="office-nav" aria-label="後台導覽">${backOfficeItems.map((item) => `<a href="${item.href}"${item.key === active ? ` aria-current="page"` : ""}>${item.label}</a>`).join("")}</nav>`;
}
