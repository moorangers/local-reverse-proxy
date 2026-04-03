import http from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Socket } from 'node:net';
import { randomUUID } from 'node:crypto';
import httpProxy from 'http-proxy';

import { gatewayConfig } from './config.js';
import { checkTargetHealth } from './health.js';
import { logError, logInfo, logSuccess, logWarn } from './logger.js';
import type { HealthStatus, RouteConfig } from './types.js';

type ReqWithMeta = IncomingMessage & {
  __requestId?: string;
  __startedAt?: number;
};

const ROUTES_ENDPOINT = '/__routes';

export const normalizeHost = (hostHeader?: string): string => {
  if (!hostHeader) {
    return '';
  }
  const normalized = hostHeader.trim().toLowerCase();

  // Host header for IPv6 can be "[::1]:3000". Return the pure host.
  if (normalized.startsWith('[')) {
    const closingBracketIndex = normalized.indexOf(']');
    if (closingBracketIndex > 1) {
      return normalized.slice(1, closingBracketIndex);
    }
  }

  return normalized.split(':')[0]?.trim() ?? '';
};

export const isHealthCheckEnabled = (route: RouteConfig): boolean => {
  return route.healthCheckEnabled ?? false;
};

export const buildInitialHealthStatus = (route: RouteConfig): HealthStatus => {
  if (!isHealthCheckEnabled(route)) {
    return {
      up: false,
      reason: 'disabled',
      checkedAt: new Date().toISOString(),
    };
  }

  return {
    up: false,
    reason: 'unknown',
    checkedAt: new Date().toISOString(),
  };
};

const routeMap = new Map<string, RouteConfig>();
const routeHealthMap = new Map<string, HealthStatus>();
const activeHttpConnections = new Map<string, number>();
const activeWsConnections = new Map<string, number>();

for (const route of gatewayConfig.routes) {
  const domain = normalizeHost(route.domain);
  if (!domain) {
    throw new Error(`Invalid route domain: "${route.domain}"`);
  }
  if (routeMap.has(domain)) {
    throw new Error(`Duplicate route domain: "${domain}"`);
  }
  routeMap.set(domain, route);
  activeHttpConnections.set(domain, 0);
  activeWsConnections.set(domain, 0);
  routeHealthMap.set(domain, buildInitialHealthStatus(route));
}

const proxy = httpProxy.createProxyServer({
  changeOrigin: true,
  xfwd: true,
  ws: true,
});

proxy.on('proxyReq', (proxyReq, req, _res, options) => {
  const request = req as ReqWithMeta;
  const domain = normalizeHost(request.headers.host);
  logInfo('proxy request', {
    requestId: request.__requestId,
    domain,
    method: request.method,
    path: request.url,
    target: typeof options.target === 'string' ? options.target : undefined,
  });

  proxyReq.setHeader('x-proxy-by', 'local-reverse-proxy');
  proxyReq.setHeader('x-request-id', request.__requestId ?? '');
});

proxy.on('proxyRes', (proxyRes, req) => {
  const request = req as ReqWithMeta;
  const domain = normalizeHost(request.headers.host);
  const durationMs = Date.now() - (request.__startedAt ?? Date.now());

  logSuccess('proxy response', {
    requestId: request.__requestId,
    domain,
    method: request.method,
    path: request.url,
    statusCode: proxyRes.statusCode,
    durationMs,
  });
});

proxy.on('error', (error, req, res) => {
  const request = req as ReqWithMeta | undefined;
  const domain = normalizeHost(request?.headers.host);

  logError('proxy error', {
    requestId: request?.__requestId,
    domain,
    method: request?.method,
    path: request?.url,
    error: error.message,
  });

  if (res && 'writeHead' in res && !res.headersSent) {
    const response = res;
    response.writeHead(502, { 'Content-Type': 'application/json' });
    response.end(
      JSON.stringify({
        message: 'Bad Gateway',
        error: error.message,
        domain,
      }),
    );
  }
});

proxy.on('open', (_proxySocket) => {
  logInfo('websocket tunnel opened');
});

proxy.on('close', (_res, _socket, _head) => {
  logWarn('websocket tunnel closed');
});

const server = http.createServer(
  (req: IncomingMessage, res: ServerResponse) => {
    const request = req as ReqWithMeta;
    request.__requestId = randomUUID();
    request.__startedAt = Date.now();

    if (isRoutesEndpoint(request.url)) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify(
          Array.from(routeMap.entries()).map(([domain, route]) => ({
            domain,
            target: route.target,
            healthCheckEnabled: isHealthCheckEnabled(route),
            healthCheckPath: route.healthCheckPath,
            activeHttp: activeHttpConnections.get(domain),
            activeWs: activeWsConnections.get(domain),
            health: routeHealthMap.get(domain),
          })),
          null,
          2,
        ),
      );
      return;
    }

    const domain = normalizeHost(request.headers.host);
    const route = routeMap.get(domain);

    if (!route) {
      logWarn('blocked request: domain not allowed', {
        requestId: request.__requestId,
        domain,
        method: request.method,
        path: request.url,
      });

      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          message: 'Forbidden domain',
          domain,
        }),
      );
      return;
    }

    increment(activeHttpConnections, domain);

    const remoteAddress = req.socket.remoteAddress;
    const currentActiveHttp = activeHttpConnections.get(domain) ?? 0;
    const health = routeHealthMap.get(domain);

    logInfo('incoming request', {
      requestId: request.__requestId,
      domain,
      target: route.target,
      method: request.method,
      path: request.url,
      remoteAddress,
      activeHttpConnections: currentActiveHttp,
      targetStatus: getTargetStatusLabel(health),
    });

    res.on('close', () => {
      decrement(activeHttpConnections, domain);
      logInfo('request connection closed', {
        requestId: request.__requestId,
        domain,
        activeHttpConnections: activeHttpConnections.get(domain) ?? 0,
      });
    });

    proxy.web(request, res, {
      target: route.target,
    });
  },
);

server.on('upgrade', (req: IncomingMessage, socket: Socket, head: Buffer) => {
  const request = req as ReqWithMeta;
  request.__requestId = randomUUID();
  request.__startedAt = Date.now();

  const domain = normalizeHost(request.headers.host);
  const route = routeMap.get(domain);

  if (!route) {
    logWarn('blocked websocket: domain not allowed', {
      requestId: request.__requestId,
      domain,
    });
    socket.destroy();
    return;
  }

  if (!route.websocket) {
    logWarn('blocked websocket: websocket disabled for route', {
      requestId: request.__requestId,
      domain,
    });
    socket.destroy();
    return;
  }

  increment(activeWsConnections, domain);

  logInfo('websocket upgrade', {
    requestId: request.__requestId,
    domain,
    target: route.target,
    path: request.url,
    activeWsConnections: activeWsConnections.get(domain) ?? 0,
  });

  socket.on('close', () => {
    decrement(activeWsConnections, domain);
    logInfo('websocket connection closed', {
      requestId: request.__requestId,
      domain,
      activeWsConnections: activeWsConnections.get(domain) ?? 0,
    });
  });

  proxy.ws(request, socket, head, {
    target: route.target,
  });
});

server.listen(gatewayConfig.listenPort, () => {
  logSuccess('gateway started', {
    listenPort: gatewayConfig.listenPort,
  });

  for (const [domain, route] of routeMap.entries()) {
    logInfo('route registered', {
      domain,
      target: route.target,
      websocket: route.websocket ?? false,
      healthCheckEnabled: isHealthCheckEnabled(route),
    });
  }

  startHealthChecks();
});

export const startHealthChecks = (): void => {
  void performHealthChecks();
  const timer = setInterval(() => {
    void performHealthChecks();
  }, gatewayConfig.healthCheckIntervalMs);
  timer.unref();
};

export const performHealthChecks = async (): Promise<void> => {
  for (const [domain, route] of routeMap.entries()) {
    if (!isHealthCheckEnabled(route)) {
      routeHealthMap.set(domain, {
        up: false,
        reason: 'disabled',
        checkedAt: new Date().toISOString(),
      });
      continue;
    }

    let result: HealthStatus;
    try {
      result = await checkTargetHealth(route.target, route.healthCheckPath ?? '/');
    } catch (error) {
      result = {
        up: false,
        reason: error instanceof Error ? error.message : 'unknown health check error',
        checkedAt: new Date().toISOString(),
      };
    }

    routeHealthMap.set(domain, result);

    if (result.up) {
      logSuccess('health check', {
        domain,
        target: route.target,
        healthCheckPath: route.healthCheckPath ?? '/',
        status: 'UP',
        targetStatusCode: result.statusCode,
        activeHttpConnections: activeHttpConnections.get(domain) ?? 0,
        activeWsConnections: activeWsConnections.get(domain) ?? 0,
      });
    } else {
      logWarn('health check', {
        domain,
        target: route.target,
        healthCheckPath: route.healthCheckPath ?? '/',
        status: 'DOWN',
        reason: result.reason,
        activeHttpConnections: activeHttpConnections.get(domain) ?? 0,
        activeWsConnections: activeWsConnections.get(domain) ?? 0,
      });
    }
  }
};

export const getTargetStatusLabel = (
  health?: HealthStatus,
): 'UP' | 'DOWN' | 'DISABLED' => {
  if (!health) {
    return 'DOWN';
  }
  if (health.reason === 'disabled') {
    return 'DISABLED';
  }
  return health.up ? 'UP' : 'DOWN';
};

export const isRoutesEndpoint = (url?: string): boolean => {
  if (!url) {
    return false;
  }
  const [pathname] = url.split('?');
  return pathname === ROUTES_ENDPOINT;
};

export const increment = (map: Map<string, number>, key: string): void => {
  map.set(key, (map.get(key) ?? 0) + 1);
};

export const decrement = (map: Map<string, number>, key: string): void => {
  map.set(key, Math.max((map.get(key) ?? 1) - 1, 0));
};

let shutdownInProgress = false;

export const setupGracefulShutdown = (): void => {
  const handleSignal = (signal: NodeJS.Signals): void => {
    if (shutdownInProgress) {
      return;
    }
    shutdownInProgress = true;
    logWarn('shutdown signal received', { signal });

    server.close((error) => {
      if (error) {
        logError('server close failed', { signal, error: error.message });
        process.exitCode = 1;
      } else {
        logSuccess('gateway stopped', { signal });
      }
      process.exit();
    });

    setTimeout(() => {
      logError('force shutdown after timeout', { signal });
      process.exit(1);
    }, 5000).unref();
  };

  process.on('SIGINT', handleSignal);
  process.on('SIGTERM', handleSignal);
};

setupGracefulShutdown();
