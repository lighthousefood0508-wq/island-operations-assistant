function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    "\"": "&quot;"
  })[character] || character);
}

export function renderRosShell(title: string, description: string): string {
  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} | Desert Island ROS</title>
  <style>
    :root { font-family: Arial, sans-serif; color: #17333a; background: #f4f7f5; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; }
    main { width: min(680px, calc(100% - 40px)); border-top: 5px solid #dc5c3f; background: #fff; padding: 32px; box-sizing: border-box; }
    h1 { margin: 0 0 12px; font-size: 28px; }
    p { margin: 0; color: #50656a; line-height: 1.6; }
    small { display: block; margin-top: 28px; color: #7b8b8d; }
  </style>
</head>
<body><main><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p><small>Desert Island ROS v0.1 foundation</small></main></body>
</html>`;
}
