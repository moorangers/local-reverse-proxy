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
        --accent-2: #2f5dbd;
        --danger: #a63232;
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
      .page {
        max-width: 1040px;
        margin: 0 auto;
        padding: 28px 18px 40px;
      }
      h1, h2, h3, p, pre { margin: 0; }
      .hero {
        display: grid;
        gap: 10px;
        margin-bottom: 18px;
      }
      .hero p {
        color: var(--muted);
        max-width: 720px;
      }
      .hero-top {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: center;
      }
      .cards {
        display: grid;
        gap: 10px;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        margin: 18px 0;
      }
      .card, .panel {
        background: rgba(255, 253, 248, 0.92);
        border: 1px solid var(--line);
        border-radius: 16px;
        box-shadow: 0 10px 24px rgba(36, 31, 23, 0.04);
      }
      .card { padding: 16px; }
      .card strong {
        display: block;
        font-size: 1.35rem;
        margin-top: 6px;
      }
      .card span, .meta, .hint {
        color: var(--muted);
        font-size: 0.92rem;
      }
      .layout {
        display: grid;
        gap: 14px;
        grid-template-columns: 1fr;
      }
      .split {
        display: grid;
        gap: 14px;
        grid-template-columns: 1fr 1fr;
      }
      .panel {
        padding: 16px;
      }
      .panel-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        margin-bottom: 12px;
      }
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
      .route-list {
        display: grid;
        gap: 10px;
      }
      .route {
        border: 1px solid var(--line);
        border-radius: 14px;
        padding: 12px;
        background: #fffefa;
      }
      .route-top {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        align-items: flex-start;
        margin-bottom: 10px;
      }
      .badge {
        display: inline-flex;
        align-items: center;
        border-radius: 999px;
        padding: 6px 10px;
        font-size: 0.82rem;
        font-weight: 700;
      }
      .badge.up, .badge.online {
        background: rgba(31, 111, 95, 0.12);
        color: var(--accent);
      }
      .badge.down {
        background: rgba(166, 50, 50, 0.12);
        color: var(--danger);
      }
      .badge.disabled {
        background: rgba(118, 107, 89, 0.12);
        color: #5e574c;
      }
      .route-grid {
        display: grid;
        gap: 8px;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      }
      .kv {
        padding: 10px 12px;
        border-radius: 12px;
        background: #f8f4ea;
      }
      .kv label {
        display: block;
        color: var(--muted);
        font-size: 0.78rem;
        margin-bottom: 4px;
      }
      .code-block {
        border-radius: 14px;
        border: 1px solid var(--line);
        padding: 14px;
        font: 13px/1.55 "SFMono-Regular", "Consolas", monospace;
        background: #fffefa;
        color: var(--text);
        overflow: auto;
        white-space: pre-wrap;
        word-break: break-word;
      }
      .logs {
        min-height: 180px;
        max-height: 320px;
      }
      .config {
        min-height: 220px;
        max-height: 420px;
      }
      .snippet-list {
        display: grid;
        gap: 10px;
      }
      .snippet {
        border: 1px solid var(--line);
        border-radius: 12px;
        background: #fffefa;
        padding: 12px;
      }
      .snippet strong {
        display: block;
        margin-bottom: 6px;
      }
      .snippet p {
        color: var(--muted);
        margin-bottom: 8px;
        font-size: 0.92rem;
      }
      code {
        font-family: "SFMono-Regular", "Consolas", monospace;
        font-size: 0.92em;
      }
      @media (max-width: 920px) {
        .hero-top, .panel-header, .route-top, .split {
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
            <p>หน้า monitor แบบมินิมอลสำหรับดู proxy status, route health, recent logs และ command ที่เอาไปใช้ต่อใน terminal ได้เอง</p>
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
          <strong id="health-interval">${status.healthCheckIntervalMs}</strong>
        </article>
        <article class="card">
          <span>Last Update</span>
          <strong id="updated-at" style="font-size:1rem">${escapeHtml(status.updatedAt)}</strong>
        </article>
      </section>

      <section class="layout">
        <section class="panel">
          <div class="panel-header">
            <div>
              <h2>Routes</h2>
              <p class="meta">ข้อมูลสดจาก proxy process ที่กำลังรันอยู่</p>
            </div>
            <button id="refresh-status" type="button">Refresh</button>
          </div>
          <div id="routes" class="route-list"></div>
        </section>
      </section>

      <section class="split" style="margin-top:14px">
        <section class="panel">
          <div class="panel-header">
            <div>
              <h2>Recent Logs</h2>
              <p class="meta">log ล่าสุดใน process ปัจจุบัน</p>
            </div>
          </div>
          <pre id="recent-logs" class="code-block logs"></pre>
        </section>

        <section class="panel">
          <div class="panel-header">
            <div>
              <h2>Config Snapshot</h2>
              <p class="meta">อ่านไฟล์ config ปัจจุบันแบบ read-only</p>
            </div>
          </div>
          <pre id="config-viewer" class="code-block config"></pre>
          <p class="hint" style="margin-top:10px">ไฟล์จริง: <code>${safeConfigPath}</code></p>
        </section>
      </section>

      <section class="panel" style="margin-top:14px">
        <div class="panel-header">
          <div>
            <h2>Terminal Commands</h2>
            <p class="meta">UI นี้ไม่สั่ง start/stop/restart ให้โดยตรง เพื่อให้คุณรันเองจาก terminal ได้ชัดเจนและปลอดภัยกว่า</p>
          </div>
        </div>
        <div class="snippet-list">
          <article class="snippet">
            <strong>Check PM2 status</strong>
            <p>ดูว่า service online อยู่ไหม</p>
            <pre class="code-block">./scripts/proxy.sh status</pre>
          </article>
          <article class="snippet">
            <strong>Tail logs</strong>
            <p>ติดตาม log ต่อเนื่องจาก PM2</p>
            <pre class="code-block">./scripts/proxy.sh logs</pre>
          </article>
          <article class="snippet">
            <strong>Health endpoint</strong>
            <p>ดู route payload ตรงจาก proxy</p>
            <pre class="code-block">curl -i http://127.0.0.1:${status.listenPort}/__routes</pre>
          </article>
          <article class="snippet">
            <strong>Restart after config change</strong>
            <p>ใช้หลังแก้ <code>gateway.config.json</code></p>
            <pre class="code-block">./scripts/proxy.sh restart</pre>
          </article>
          <article class="snippet">
            <strong>Edit config in editor</strong>
            <p>เปิดไฟล์ config ด้วย VS Code</p>
            <pre class="code-block">${safeEditCommand}</pre>
          </article>
        </div>
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

      const getHealthBadge = (health) => {
        if (!health || health.reason === 'disabled') {
          return '<span class="badge disabled">DISABLED</span>';
        }
        return health.up
          ? '<span class="badge up">UP</span>'
          : '<span class="badge down">DOWN</span>';
      };

      const text = (value) => {
        return String(value ?? '')
          .replaceAll('&', '&amp;')
          .replaceAll('<', '&lt;')
          .replaceAll('>', '&gt;')
          .replaceAll('"', '&quot;')
          .replaceAll("'", '&#39;');
      };

      const renderStatus = (status) => {
        listenPortEl.textContent = String(status.listenPort);
        healthIntervalEl.textContent = String(status.healthCheckIntervalMs);
        healthyRoutesEl.textContent =
          String(status.healthyRouteCount) + '/' + String(status.routeCount);
        updatedAtEl.textContent = String(status.updatedAt);
        logsEl.textContent =
          Array.isArray(status.recentLogs) && status.recentLogs.length > 0
            ? status.recentLogs.join('\\n')
            : 'No logs yet';

        routesEl.innerHTML = status.routes.map((route) => {
          const reason = route.health?.reason || '-';
          const checkedAt = route.health?.checkedAt || '-';
          const statusCode = route.health?.statusCode ?? '-';
          return \`
            <article class="route">
              <div class="route-top">
                <div>
                  <h3>\${text(route.domain)}</h3>
                  <p class="hint">\${text(route.target)}</p>
                </div>
                \${getHealthBadge(route.health)}
              </div>
              <div class="route-grid">
                <div class="kv"><label>WebSocket</label><strong>\${route.websocket ? 'enabled' : 'disabled'}</strong></div>
                <div class="kv"><label>Health Path</label><strong>\${text(route.healthCheckPath || '/')}</strong></div>
                <div class="kv"><label>Active HTTP</label><strong>\${text(route.activeHttp)}</strong></div>
                <div class="kv"><label>Active WS</label><strong>\${text(route.activeWs)}</strong></div>
                <div class="kv"><label>Status Code</label><strong>\${text(statusCode)}</strong></div>
                <div class="kv"><label>Last Check</label><strong>\${text(checkedAt)}</strong></div>
                <div class="kv"><label>Reason</label><strong>\${text(reason)}</strong></div>
              </div>
            </article>
          \`;
        }).join('');
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
        }).catch((error) => {
          logsEl.textContent = error instanceof Error ? error.message : 'Cannot refresh';
        });
      });

      renderStatus(initialStatus);
      void loadConfig().catch((error) => {
        configViewerEl.textContent =
          error instanceof Error ? error.message : 'Cannot load config';
      });
    </script>
  </body>
</html>`;
};
