export interface RouteConfig {
  domain: string;
  target: string;

  healthCheckEnabled?: boolean;
  healthCheckPath?: string;

  websocket?: boolean;
}

export interface GatewayConfig {
  listenPort: number;
  healthCheckIntervalMs: number;
  routes: RouteConfig[];
}

export interface HealthStatus {
  up: boolean;
  statusCode?: number;
  reason?: string;
  checkedAt: string;
}
