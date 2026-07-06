import type { HealthStatus } from './types.js';

export interface RouteStatusView {
  domain: string;
  target: string;
  websocket: boolean;
  healthCheckEnabled: boolean;
  healthCheckPath: string;
  activeHttp: number;
  activeWs: number;
  health?: HealthStatus;
}

export interface AdminStatusPayload {
  configPath: string;
  proxyStatus: 'ONLINE';
  listenPort: number;
  healthCheckIntervalMs: number;
  routeCount: number;
  healthyRouteCount: number;
  updatedAt: string;
  recentLogs: string[];
  routes: RouteStatusView[];
}

const escapeHtml = (value: string): string => {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
};

const escapeJsonForScript = (value: unknown): string => {
  return JSON.stringify(value)
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026');
};

export const renderAdminHtml = (status: AdminStatusPayload): string => {
  const safeConfigPath = escapeHtml(status.configPath);
  const safeStatus = escapeJsonForScript(status);
  const safeEditCommand = escapeHtml(
    `open -a "Visual Studio Code" ${status.configPath}`,
  );

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Local Reverse Proxy Admin</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f6f4ee;
        --panel: #fffdf8;
        --line: #d8d2c4;
        --text: #241f17;
        --muted: #766b59;
        --accent: #1f6f5f;
        --ok: #1f6f5f;
        --info: #2f5dbd;
        --warn: #bd7a1f;
        --error: #a63232;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "Avenir Next", "Segoe UI", sans-serif;
        background:
          radial-gradient(circle at top left, rgba(31, 111, 95, 0.14), transparent 32%),
          linear-gradient(180deg, #fbfaf6 0%, var(--bg) 100%);
        color: var(--text);
      }
      h1, h2, h3, p, pre { margin: 0; }
      button {
        border: 0;
        border-radius: 999px;
        padding: 10px 16px;
        background: var(--accent);
        color: white;
        cursor: pointer;
        font: inherit;
      }
      button:disabled { opacity: 0.65; cursor: wait; }
      code {
        font-family: "SFMono-Regular", "Consolas", monospace;
        font-size: 0.92em;
      }
      .page {
        max-width: 1480px;
        margin: 0 auto;
        padding: 28px 18px 40px;
      }
      .hero {
        display: grid;
        gap: 10px;
        margin-bottom: 18px;
      }
      .hero-top {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 16px;
      }
      .hero p {
        color: var(--muted);
        max-width: 820px;
      }
      .panel, .card {
        background: rgba(255, 253, 248, 0.94);
        border: 1px solid var(--line);
        border-radius: 18px;
        box-shadow: 0 10px 24px rgba(36, 31, 23, 0.04);
      }
      .cards {
        display: grid;
        gap: 12px;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        margin: 18px 0;
      }
      .card {
        padding: 18px 20px;
      }
      .card span {
        display: block;
        color: var(--muted);
        font-size: 0.86rem;
        margin-bottom: 8px;
      }
      .card strong {
        display: block;
        font-size: 0.92rem;
        line-height: 1.35;
        word-break: break-word;
      }
      .layout {
        display: grid;
        gap: 14px;
      }
      .panel {
        padding: 18px;
      }
      .panel.config-panel {
        display: flex;
        flex-direction: column;
      }
      .panel-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        margin-bottom: 14px;
      }
      .meta {
        color: var(--muted);
        font-size: 0.92rem;
      }
      .split {
        display: grid;
        gap: 14px;
        grid-template-columns: minmax(0, 1.15fr) minmax(320px, 0.85fr);
      }
      .badge {
        display: inline-flex;
        align-items: center;
        border-radius: 999px;
        padding: 7px 12px;
        font-size: 0.82rem;
        font-weight: 700;
      }
      .badge.online, .badge.up {
        background: rgba(31, 111, 95, 0.12);
        color: var(--ok);
      }
      .badge.down {
        background: rgba(166, 50, 50, 0.12);
        color: var(--error);
      }
      .badge.off {
        background: rgba(118, 107, 89, 0.12);
        color: #5e574c;
      }
      .route-list {
        display: grid;
        gap: 12px;
        grid-template-columns: repeat(4, minmax(0, 1fr));
      }
      .route {
        border: 1px solid var(--line);
        border-radius: 16px;
        padding: 14px;
        background: #fffefa;
        min-height: 180px;
        display: grid;
        gap: 10px;
      }
      .route-top {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 10px;
      }
      .route-main {
        min-width: 0;
      }
      .route-main h3 {
        font-size: 1rem;
        line-height: 1.3;
        word-break: break-word;
      }
      .route-main p {
        color: var(--muted);
        font-size: 0.88rem;
        word-break: break-word;
      }
      .route-details {
        display: grid;
        gap: 8px;
        margin-top: 4px;
      }
      .route-row {
        display: grid;
        gap: 4px;
      }
      .route-label {
        color: var(--muted);
        font-size: 0.78rem;
      }
      .route-value {
        font-size: 0.92rem;
        line-height: 1.35;
        word-break: break-word;
      }
      .log-list {
        list-style: none;
        padding: 0;
        margin: 0;
        display: grid;
        gap: 8px;
      }
      .log-item {
        font: 12px/1.55 "SFMono-Regular", "Consolas", monospace;
        white-space: pre-wrap;
        word-break: break-word;
      }
      .log-item.ok { color: var(--ok); }
      .log-item.info { color: var(--info); }
      .log-item.warn { color: var(--warn); }
      .log-item.error { color: var(--error); }
      .code-block {
        width: 100%;
        border-radius: 14px;
        border: 1px solid var(--line);
        padding: 14px;
        background: #fffefa;
        color: var(--text);
        overflow: auto;
        white-space: pre-wrap;
        word-break: break-word;
        font: 13px/1.55 "SFMono-Regular", "Consolas", monospace;
      }
      .logs {
        border: 1px solid var(--line);
        background: #fffefa;
        border-radius: 14px;
        padding: 14px;
        max-height: 520px;
        overflow: auto;
      }
      .config {
        flex: 1;
        min-height: 520px;
        max-height: 620px;
      }
      .snippet-list {
        display: grid;
        gap: 10px;
      }
      .snippet {
        border: 1px solid var(--line);
        border-radius: 14px;
        background: #fffefa;
        padding: 12px;
      }
      .snippet-head {
        display: flex;
        justify-content: space-between;
        gap: 8px;
        align-items: center;
        margin-bottom: 6px;
      }
      .copy-btn {
        padding: 5px 9px;
        font-size: 0.78rem;
        background: #efe9dc;
        color: var(--text);
      }
      .copy-btn.copied {
        background: rgba(31, 111, 95, 0.12);
        color: var(--ok);
      }
      .snippet p {
        color: var(--muted);
        margin-bottom: 8px;
        font-size: 0.9rem;
      }
      @media (max-width: 1240px) {
        .route-list { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      }
      @media (max-width: 980px) {
        .cards, .route-list, .split {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .hero-top, .panel-header {
          display: grid;
        }
      }
      @media (max-width: 700px) {
        .cards, .route-list, .split {
          grid-template-columns: 1fr;
        }
        .route-top {
          display: grid;
        }
      }
    </style>
  </head>
  <body>
    <main class="page">
      <section class="hero">
        <div class="hero-top">
          <div>
            <h1>Local Reverse Proxy Admin</h1>
            <p>หน้า monitor สำหรับดู proxy status, routes, recent logs และ command ที่คัดลอกไปใช้ใน terminal ได้ทันที</p>
          </div>
          <span class="badge online">${status.proxyStatus}</span>
        </div>
      </section>

      <section class="cards">
        <article class="card">
          <span>Listen Port</span>
          <strong id="listen-port">${status.listenPort}</strong>
        </article>
        <article class="card">
          <span>Healthy Routes</span>
          <strong id="healthy-routes">${status.healthyRouteCount}/${status.routeCount}</strong>
        </article>
        <article class="card">
          <span>Health Interval</span>
          <strong id="health-interval">${status.healthCheckIntervalMs} ms</strong>
        </article>
        <article class="card">
          <span>Last Update</span>
          <strong id="updated-at">${escapeHtml(status.updatedAt)}</strong>
        </article>
      </section>

      <section class="layout">
        <section class="panel">
          <div class="panel-header">
            <div>
              <h2>Routes</h2>
              <p class="meta">แสดง 4 cards ต่อแถว และคัดลอก domain ได้ทันที</p>
            </div>
            <button id="refresh-status" type="button">Refresh</button>
          </div>
          <div id="routes" class="route-list"></div>
        </section>

        <section class="panel">
          <div class="panel-header">
            <div>
              <h2>Recent Logs</h2>
              <p class="meta">แยกสีตามระดับ log โดยไม่ห่อเป็น card</p>
            </div>
          </div>
          <div class="logs">
            <ul id="recent-logs" class="log-list"></ul>
          </div>
        </section>

        <section class="split">
          <section class="panel config-panel">
            <div class="panel-header">
              <div>
                <h2>Config Snapshot</h2>
                <p class="meta">กรอบ config เต็ม panel</p>
              </div>
            </div>
            <pre id="config-viewer" class="code-block config"></pre>
            <p class="meta" style="margin-top:10px">ไฟล์จริง: <code>${safeConfigPath}</code></p>
          </section>

          <section class="panel">
            <div class="panel-header">
              <div>
                <h2>Terminal Commands</h2>
                <p class="meta">คัดลอกคำสั่งได้เลย</p>
              </div>
            </div>
            <div class="snippet-list">
              <article class="snippet">
                <div class="snippet-head">
                  <strong>Check PM2 status</strong>
                  <button class="copy-btn" type="button" data-copy="./scripts/proxy.sh status">Copy</button>
                </div>
                <p>ดูว่า service online อยู่ไหม</p>
                <pre class="code-block">./scripts/proxy.sh status</pre>
              </article>
              <article class="snippet">
                <div class="snippet-head">
                  <strong>Tail logs</strong>
                  <button class="copy-btn" type="button" data-copy="./scripts/proxy.sh logs">Copy</button>
                </div>
                <p>ติดตาม log ต่อเนื่องจาก PM2</p>
                <pre class="code-block">./scripts/proxy.sh logs</pre>
              </article>
              <article class="snippet">
                <div class="snippet-head">
                  <strong>Health endpoint</strong>
                  <button class="copy-btn" type="button" data-copy="curl -i http://127.0.0.1:${status.listenPort}/__routes">Copy</button>
                </div>
                <p>ดู route payload ตรงจาก proxy</p>
                <pre class="code-block">curl -i http://127.0.0.1:${status.listenPort}/__routes</pre>
              </article>
              <article class="snippet">
                <div class="snippet-head">
                  <strong>Restart after config change</strong>
                  <button class="copy-btn" type="button" data-copy="./scripts/proxy.sh restart">Copy</button>
                </div>
                <p>ใช้หลังแก้ <code>gateway.config.json</code></p>
                <pre class="code-block">./scripts/proxy.sh restart</pre>
              </article>
              <article class="snippet">
                <div class="snippet-head">
                  <strong>Edit config in editor</strong>
                  <button class="copy-btn" type="button" data-copy="${safeEditCommand}">Copy</button>
                </div>
                <p>เปิดไฟล์ config ด้วย VS Code</p>
                <pre class="code-block">${safeEditCommand}</pre>
              </article>
            </div>
          </section>
        </section>
      </section>
    </main>
    <script>
      const initialStatus = ${safeStatus};
      const routesEl = document.getElementById('routes');
      const listenPortEl = document.getElementById('listen-port');
      const healthIntervalEl = document.getElementById('health-interval');
      const healthyRoutesEl = document.getElementById('healthy-routes');
      const updatedAtEl = document.getElementById('updated-at');
      const logsEl = document.getElementById('recent-logs');
      const configViewerEl = document.getElementById('config-viewer');
      const refreshButton = document.getElementById('refresh-status');

      const text = (value) => {
        return String(value ?? '')
          .replaceAll('&', '&amp;')
          .replaceAll('<', '&lt;')
          .replaceAll('>', '&gt;')
          .replaceAll('"', '&quot;')
          .replaceAll("'", '&#39;');
      };

      const getHealthBadge = (health) => {
        if (!health || health.reason === 'disabled') {
          return '<span class="badge off">OFF</span>';
        }
        return health.up
          ? '<span class="badge up">UP</span>'
          : '<span class="badge down">DOWN</span>';
      };

      const getLogLevel = (line) => {
        if (line.startsWith('[OK]')) return 'ok';
        if (line.startsWith('[INFO]')) return 'info';
        if (line.startsWith('[WARN]')) return 'warn';
        if (line.startsWith('[ERROR]')) return 'error';
        return 'info';
      };

      const copyText = async (value, button) => {
        try {
          await navigator.clipboard.writeText(value);
          if (button) {
            const prev = button.textContent;
            button.textContent = 'Copied';
            button.classList.add('copied');
            setTimeout(() => {
              button.textContent = prev;
              button.classList.remove('copied');
            }, 1200);
          }
        } catch (_error) {
          if (button) {
            button.textContent = 'Copy failed';
          }
        }
      };

      const bindCopyButtons = () => {
        document.querySelectorAll('[data-copy]').forEach((button) => {
          if (button.dataset.bound === 'true') {
            return;
          }
          button.dataset.bound = 'true';
          button.addEventListener('click', () => {
            void copyText(button.getAttribute('data-copy') || '', button);
          });
        });
      };

      const renderStatus = (status) => {
        listenPortEl.textContent = String(status.listenPort);
        healthIntervalEl.textContent = String(status.healthCheckIntervalMs) + ' ms';
        healthyRoutesEl.textContent =
          String(status.healthyRouteCount) + '/' + String(status.routeCount);
        updatedAtEl.textContent = String(status.updatedAt);

        logsEl.innerHTML =
          Array.isArray(status.recentLogs) && status.recentLogs.length > 0
            ? status.recentLogs
                .map((line) => {
                  const level = getLogLevel(line);
                  return '<li class="log-item ' + level + '">' + text(line) + '</li>';
                })
                .join('')
            : '<li class="log-item info">No logs yet</li>';

        routesEl.innerHTML = status.routes
          .map((route) => {
            const routeName = route.domain.replace(/\\.localtest\\.me$/i, '');
            return \`
              <article class="route">
                <div class="route-top">
                  <div class="route-main">
                    <h3>\${text(routeName)}</h3>
                    <div class="route-details">
                      <div class="route-row">
                        <span class="route-label">domain</span>
                        <strong class="route-value">\${text(route.domain)}</strong>
                      </div>
                      <div class="route-row">
                        <span class="route-label">target</span>
                        <strong class="route-value">\${text(route.target)}</strong>
                      </div>
                      <div class="route-row">
                        <span class="route-label">websocket</span>
                        <strong class="route-value">\${route.websocket ? 'true' : 'false'}</strong>
                      </div>
                      <div class="route-row">
                        <span class="route-label">healthCheckEnabled</span>
                        <strong class="route-value">\${route.healthCheckEnabled ? 'true' : 'false'}</strong>
                      </div>
                    </div>
                  </div>
                  \${getHealthBadge(route.health)}
                </div>
              </article>
            \`;
          })
          .join('');

        bindCopyButtons();
      };

      const withBusy = async (button, work) => {
        const prev = button.textContent;
        button.disabled = true;
        button.textContent = 'Working...';
        try {
          await work();
        } finally {
          button.disabled = false;
          button.textContent = prev;
        }
      };

      const loadStatus = async () => {
        const response = await fetch('/__admin/status');
        if (!response.ok) {
          throw new Error('Cannot load status');
        }
        const data = await response.json();
        renderStatus(data);
      };

      const loadConfig = async () => {
        const response = await fetch('/__admin/config');
        if (!response.ok) {
          throw new Error('Cannot load config');
        }
        const data = await response.json();
        configViewerEl.textContent = data.raw;
      };

      refreshButton.addEventListener('click', () => {
        void withBusy(refreshButton, async () => {
          await loadStatus();
          await loadConfig();
        });
      });

      renderStatus(initialStatus);
      bindCopyButtons();
      void loadConfig().catch((error) => {
        configViewerEl.textContent =
          error instanceof Error ? error.message : 'Cannot load config';
      });
    </script>
  </body>
</html>`;
};
