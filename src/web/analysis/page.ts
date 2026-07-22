import { renderBackOfficeNav, renderNavigationStyles, renderSystemNav } from "../shared/navigation.js";

export function renderAnalysisPlaceholder(): string {
  return `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>場次分析 | 荒島 ROS 後台</title><style>${renderNavigationStyles()}:root{font-family:Arial,"Noto Sans TC",sans-serif;color:#183238;background:#f4f1eb}body{margin:0}main{max-width:980px;margin:auto;padding:20px}.panel{background:#fff;border:1px solid #d8cec0;border-radius:7px;padding:24px;margin-top:14px}h1{margin:0;font-size:30px}.muted{color:#607176}</style></head><body>${renderSystemNav("admin")}<main><h1>場次分析</h1>${renderBackOfficeNav("analysis")}<section class="panel"><h2>尚未啟用</h2><p class="muted">場次分析會在日結與歷史資料穩定後再啟用。目前請先使用「今日統計」查看當日收攤核對。</p></section></main></body></html>`;
}
