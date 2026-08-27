type SystemArea = "pos" | "kitchen" | "admin";
type BackOfficeArea = "events" | "catalog-categories" | "catalog-products" | "ingredients" | "measurements" | "recipes" | "suppliers" | "purchases" | "valuation" | "snapshots" | "analytics" | "cost" | "statistics" | "analysis" | "health" | "devices";
type BackOfficeAxis = "catalog" | "operations" | "cost" | "system";

type NavItem = { href: string; label: string; active: readonly BackOfficeArea[]; isDefault?: boolean };
type NavGroup = { label: string; items: readonly NavItem[] };

const systemItems: readonly { key: SystemArea; href: string; label: string }[] = [
  { key: "pos", href: "/pos", label: "POS 點餐" },
  { key: "kitchen", href: "/kitchen", label: "廚房系統" },
  { key: "admin", href: "/admin", label: "後台管理" }
];

const primaryItems: readonly { key: Exclude<BackOfficeAxis, "system">; href: string; label: string }[] = [
  { key: "catalog", href: "/admin/catalog/products", label: "商品目錄" },
  { key: "operations", href: "/admin", label: "場次" },
  { key: "cost", href: "/admin/cost", label: "成本" }
];

const secondaryItems: Readonly<Record<BackOfficeAxis, readonly NavItem[]>> = {
  catalog: [
    { href: "/admin/catalog/categories", label: "分類管理", active: ["catalog-categories"] },
    { href: "/admin/catalog/products", label: "商品管理", active: ["catalog-products"], isDefault: true }
  ],
  operations: [
    { href: "/admin#event-management", label: "場次管理", active: ["events"], isDefault: true },
    { href: "/admin#event-inventory", label: "商品與備貨", active: ["events"] },
    { href: "/admin#event-actions", label: "今日營運", active: ["events"] },
    { href: "/admin/statistics", label: "今日統計", active: ["statistics"], isDefault: true },
    { href: "/admin/analysis", label: "場次分析", active: ["analysis"], isDefault: true }
  ],
  cost: [],
  system: [
    { href: "/admin/health", label: "系統狀態", active: ["health"] },
    { href: "/admin/devices", label: "裝置連線", active: ["devices"] }
  ]
};

const costGroups: readonly NavGroup[] = [
  { label: "成本總覽", items: [{ href: "/admin/cost", label: "成本總覽", active: ["cost"], isDefault: true }] },
  { label: "基礎資料", items: [
    { href: "/admin/ingredients", label: "食材主檔", active: ["ingredients"] },
    { href: "/admin/cost/measurements", label: "計量設定", active: ["measurements"] },
    { href: "/admin/cost/recipes", label: "配方管理", active: ["recipes"] }
  ] },
  { label: "採購管理", items: [
    { href: "/admin/cost/suppliers", label: "供應商", active: ["suppliers"] },
    { href: "/admin/cost/purchases", label: "採購與驗收", active: ["purchases"] }
  ] },
  { label: "成本核算", items: [
    { href: "/admin/cost/valuation", label: "成本評估", active: ["valuation"] },
    { href: "/admin/cost/snapshots", label: "成本快照", active: ["snapshots"] },
    { href: "/admin/cost/analytics", label: "成本分析", active: ["analytics"] }
  ] }
];

function axisFor(area: BackOfficeArea): BackOfficeAxis {
  if (area === "catalog-categories" || area === "catalog-products") return "catalog";
  if (area === "events" || area === "statistics" || area === "analysis") return "operations";
  if (["ingredients", "measurements", "recipes", "suppliers", "purchases", "valuation", "snapshots", "analytics", "cost"].includes(area)) return "cost";
  return "system";
}

function link(item: { href: string; label: string }, current: boolean): string {
  return `<a href="${item.href}"${current ? ` aria-current="page"` : ""}>${item.label}</a>`;
}

function groupedCostNavigation(active: BackOfficeArea): string {
  return `<nav class="office-workspace-groups" aria-label="成本工作區">${costGroups.map((group) => `<section class="office-workspace-group"><h2>${group.label}</h2><div>${group.items.map((item) => link(item, item.active.includes(active))).join("")}</div></section>`).join("")}</nav>`;
}

export function renderNavigationStyles(): string {
  return `.system-nav{position:sticky;top:0;z-index:20;display:flex;gap:8px;align-items:center;overflow-x:auto;background:#f8fbf9;border-bottom:1px solid #cbd8d4;padding:10px 14px}.system-nav a,.office-primary a,.office-secondary a,.office-workspace-group a{min-height:44px;display:inline-flex;align-items:center;justify-content:center;white-space:nowrap;text-decoration:none;color:#244b50;border:1px solid #c4d3cf;background:#eef4f1;border-radius:6px;padding:10px 13px;font-weight:700}.system-nav a[aria-current="page"],.office-primary a[aria-current="page"],.office-secondary a[aria-current="page"],.office-workspace-group a[aria-current="page"]{background:#165b59;border-color:#165b59;color:#fff}.office-nav{margin:14px 0;display:grid;gap:10px}.office-primary{display:flex;gap:8px;align-items:center;border:1px solid #cbd8d4;border-radius:8px;padding:8px;background:#fff}.office-system{position:relative;margin-left:auto}.office-system summary{min-height:44px;display:inline-flex;align-items:center;cursor:pointer;list-style:none;white-space:nowrap;border:1px solid #c4d3cf;border-radius:6px;padding:10px 13px;color:#244b50;background:#f6f8f7;font-weight:700}.office-system summary::-webkit-details-marker{display:none}.office-system summary::after{content:"⌄";margin-left:7px;font-size:16px}.office-system[open] summary{background:#e5f1ed;border-color:#8eb9b0}.office-system-menu{position:absolute;right:0;top:calc(100% + 6px);z-index:30;display:grid;gap:6px;min-width:154px;padding:8px;border:1px solid #cbd8d4;border-radius:8px;background:#fff;box-shadow:0 8px 24px rgba(24,50,56,.16)}.office-secondary{display:flex;gap:8px;align-items:center;overflow-x:auto;padding:2px 0 4px}.office-secondary a{background:#fff;font-size:14px}.office-workspace-groups{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.office-workspace-group{border:1px solid #d4e1dc;border-radius:8px;padding:9px;background:#f7faf8}.office-workspace-group h2{margin:0 0 7px;color:#496461;font-size:12px}.office-workspace-group>div{display:flex;gap:6px;flex-wrap:wrap}.office-workspace-group a{min-height:38px;background:#fff;font-size:13px;padding:8px 10px}.system-nav a:focus-visible,.office-primary a:focus-visible,.office-secondary a:focus-visible,.office-workspace-group a:focus-visible,.office-system summary:focus-visible{outline:3px solid #d98332;outline-offset:2px}@media(max-width:800px){.office-workspace-groups{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:680px){.system-nav{padding:8px}.office-primary{align-items:stretch;flex-wrap:wrap}.office-primary>a{flex:1 1 29%;padding-inline:10px}.office-system{margin-left:0;flex:1 1 100%}.office-system summary{width:100%;justify-content:center}.office-system summary::after{margin-left:8px}.office-system-menu{left:0;right:auto;min-width:min(100%,260px)}.office-secondary{padding-bottom:8px}.office-secondary a{padding:10px 12px}.office-workspace-groups{grid-template-columns:1fr}.office-workspace-group a{flex:1 1 auto}}`;
}

export function renderSystemNav(active: SystemArea): string {
  return `<nav class="system-nav" aria-label="系統導覽">${systemItems.map((item) => link(item, item.key === active)).join("")}</nav>`;
}

/** BackOfficeWorkspaceDecomposition: three operational axes and reloadable workspace routes. */
export function renderBackOfficeNav(active: BackOfficeArea): string {
  const axis = axisFor(active);
  const systemOpen = axis === "system" ? " open" : "";
  const workspaceNavigation = axis === "cost"
    ? groupedCostNavigation(active)
    : `<nav class="office-secondary" aria-label="目前主軸功能">${secondaryItems[axis].map((item) => link(item, item.active.includes(active) && (axis === "system" || item.isDefault === true || item.active.length === 1))).join("")}</nav>`;
  return `<section class="office-nav" aria-label="後台導覽"><nav class="office-primary" aria-label="後台主軸">${primaryItems.map((item) => link(item, item.key === axis)).join("")}<details class="office-system"${systemOpen}><summary>系統 ⚙</summary><div class="office-system-menu" role="group" aria-label="系統工具">${secondaryItems.system.map((item) => link(item, item.active.includes(active))).join("")}</div></details></nav>${workspaceNavigation}</section>`;
}
