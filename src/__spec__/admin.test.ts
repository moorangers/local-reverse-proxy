import { describe, expect, it } from '@jest/globals';

import { renderAdminHtml } from '../admin.js';

describe('renderAdminHtml', () => {
  it('renders dashboard content and escapes status payload for script usage', () => {
    const html = renderAdminHtml({
      configPath: '/tmp/gateway.config.json',
      proxyStatus: 'ONLINE',
      listenPort: 18080,
      healthCheckIntervalMs: 60000,
      routeCount: 1,
      healthyRouteCount: 1,
      updatedAt: '2026-07-06T00:00:00.000Z',
      recentLogs: ['[INFO] 2026-07-06T00:00:00.000Z gateway started'],
      routes: [
        {
          domain: 'oms.localtest.me',
          target: 'http://127.0.0.1:3002/?q=<tag>',
          websocket: true,
          healthCheckEnabled: true,
          healthCheckPath: '/health',
          activeHttp: 1,
          activeWs: 0,
          health: {
            up: true,
            checkedAt: '2026-07-06T00:00:00.000Z',
          },
        },
      ],
    });

    expect(html).toContain('Local Reverse Proxy Admin');
    expect(html).toContain('/tmp/gateway.config.json');
    expect(html).toContain('\\u003ctag\\u003e');
    expect(html).toContain('Terminal Commands');
    expect(html).toContain('./scripts/proxy.sh restart');
    expect(html).toContain('/__admin/config');
  });
});
