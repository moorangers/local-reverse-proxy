import fs from 'node:fs';
import path from 'node:path';
import type { GatewayConfig, RouteConfig } from './types.js';

const DEFAULT_HEALTH_CHECK_PATH = '/';

const DEFAULT_GATEWAY_CONFIG: GatewayConfig = {
  listenPort: 18080,
  healthCheckIntervalMs: 60000,
  routes: [
    {
      domain: 'oms.localtest.me',
      target: 'http://127.0.0.1:3002',
      websocket: true,
      healthCheckEnabled: false,
    },
  ],
};

class ConfigValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigValidationError';
  }
}

export const DEFAULT_CONFIG_PATH = path.resolve(process.cwd(), 'gateway.config.json');
export const DEFAULT_EXAMPLE_CONFIG_PATH = path.resolve(
  process.cwd(),
  'gateway.config.example.json',
);

export const loadEnvFile = (
  envPath = path.resolve(process.cwd(), '.env'),
): void => {
  if (!fs.existsSync(envPath)) {
    return;
  }

  const content = fs.readFileSync(envPath, 'utf-8');
  const lines = content.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    if (!key || process.env[key] != null) {
      continue;
    }

    process.env[key] = stripOptionalQuotes(value);
  }
};

export const stripOptionalQuotes = (value: string): string => {
  const hasDoubleQuotes = value.startsWith('"') && value.endsWith('"');
  const hasSingleQuotes = value.startsWith("'") && value.endsWith("'");
  if ((hasDoubleQuotes || hasSingleQuotes) && value.length >= 2) {
    return value.slice(1, -1);
  }
  return value;
};

export const ensureConfigFile = (configPath: string): void => {
  if (fs.existsSync(configPath)) {
    return;
  }

  fs.mkdirSync(path.dirname(configPath), { recursive: true });

  const localExamplePath = path.resolve(
    path.dirname(configPath),
    'gateway.config.example.json',
  );

  if (fs.existsSync(localExamplePath)) {
    fs.copyFileSync(localExamplePath, configPath);
  } else if (fs.existsSync(DEFAULT_EXAMPLE_CONFIG_PATH)) {
    fs.copyFileSync(DEFAULT_EXAMPLE_CONFIG_PATH, configPath);
  } else {
    fs.writeFileSync(
      configPath,
      JSON.stringify(DEFAULT_GATEWAY_CONFIG, null, 2) + '\n',
      'utf-8',
    );
  }
};

export const readGatewayConfig = (): GatewayConfig => {
  loadEnvFile();

  const configPath = DEFAULT_CONFIG_PATH;
  ensureConfigFile(configPath);

  let parsed: unknown;
  try {
    const raw = fs.readFileSync(configPath, 'utf-8');
    parsed = JSON.parse(raw);
  } catch {
    return failConfigValidation(configPath, 'must be valid JSON');
  }

  return parseGatewayConfig(parsed, configPath);
};

export const parseGatewayConfig = (
  value: unknown,
  source: string,
): GatewayConfig => {
  if (!value || typeof value !== 'object') {
    failConfigValidation(source, 'expected JSON object');
  }

  const config = value as Partial<GatewayConfig>;
  const listenPort = isValidPort(config.listenPort)
    ? config.listenPort
    : failConfigValidation(source, '"listenPort" must be integer 1-65535');

  const healthCheckIntervalMs = isValidPositiveInteger(
    config.healthCheckIntervalMs,
  )
    ? config.healthCheckIntervalMs
    : failConfigValidation(
        source,
        '"healthCheckIntervalMs" must be positive integer',
      );

  const routesRaw = Array.isArray(config.routes)
    ? config.routes
    : failConfigValidation(source, '"routes" must be array');

  if (routesRaw.length === 0) {
    failConfigValidation(source, '"routes" must not be empty');
  }

  const routes = routesRaw.map((route, index) =>
    parseRoute(route, source, index),
  );
  ensureUniqueDomains(routes, source);

  return {
    listenPort,
    healthCheckIntervalMs,
    routes,
  };
};

export const parseRoute = (
  route: unknown,
  source: string,
  index: number,
): RouteConfig => {
  if (!route || typeof route !== 'object') {
    failRouteValidation(source, index, 'expected object');
  }

  const value = route as Partial<RouteConfig>;
  const domain = getRequiredRouteString(value.domain, source, index, 'domain');
  const target = getRequiredRouteString(value.target, source, index, 'target');

  validateHttpUrl(target, source, index);

  if (value.websocket != null && typeof value.websocket !== 'boolean') {
    failRouteValidation(source, index, '"websocket" must be boolean');
  }

  if (
    value.healthCheckEnabled != null &&
    typeof value.healthCheckEnabled !== 'boolean'
  ) {
    failRouteValidation(source, index, '"healthCheckEnabled" must be boolean');
  }

  if (
    value.healthCheckPath != null &&
    typeof value.healthCheckPath !== 'string'
  ) {
    failRouteValidation(source, index, '"healthCheckPath" must be string');
  }

  const normalizedHealthCheckPath = value.healthCheckPath?.trim();
  if (
    normalizedHealthCheckPath != null &&
    normalizedHealthCheckPath !== '' &&
    !normalizedHealthCheckPath.startsWith('/')
  ) {
    failRouteValidation(source, index, '"healthCheckPath" must start with "/"');
  }

  return {
    domain,
    target,
    websocket: value.websocket,
    healthCheckEnabled: value.healthCheckEnabled,
    healthCheckPath:
      normalizedHealthCheckPath === ''
        ? DEFAULT_HEALTH_CHECK_PATH
        : normalizedHealthCheckPath,
  };
};

export const getRequiredRouteString = (
  value: unknown,
  source: string,
  index: number,
  fieldName: 'domain' | 'target',
): string => {
  const textValue =
    typeof value === 'string'
      ? value
      : failRouteValidation(source, index, `"${fieldName}" must be non-empty string`);
  const normalized = textValue.trim();
  if (!normalized) {
    failRouteValidation(
      source,
      index,
      `"${fieldName}" must be non-empty string`,
    );
  }
  return normalized;
};

export const ensureUniqueDomains = (
  routes: RouteConfig[],
  source: string,
): void => {
  const domainSet = new Set<string>();

  for (const route of routes) {
    const normalized = normalizeDomain(route.domain);
    if (domainSet.has(normalized)) {
      failConfigValidation(source, `duplicate domain "${route.domain}"`);
    }
    domainSet.add(normalized);
  }
};

export const validateHttpUrl = (
  value: string,
  source: string,
  routeIndex: number,
): void => {
  try {
    const targetUrl = new URL(value);
    if (targetUrl.protocol !== 'http:' && targetUrl.protocol !== 'https:') {
      throw new ConfigValidationError('unsupported protocol');
    }
  } catch {
    failRouteValidation(
      source,
      routeIndex,
      '"target" must be valid http(s) URL',
    );
  }
};

export const normalizeDomain = (domain: string): string => {
  return domain.trim().toLowerCase();
};

export const isValidPort = (value: unknown): value is number => {
  return Number.isInteger(value) && Number(value) > 0 && Number(value) <= 65535;
};

export const isValidPositiveInteger = (value: unknown): value is number => {
  return Number.isInteger(value) && Number(value) > 0;
};

export const failConfigValidation = (source: string, reason: string): never => {
  throw new ConfigValidationError(`Invalid config from ${source}: ${reason}`);
};

export const failRouteValidation = (
  source: string,
  index: number,
  reason: string,
): never => {
  throw new ConfigValidationError(
    `Invalid route[${index}] in ${source}: ${reason}`,
  );
};

export const gatewayConfig: GatewayConfig = readGatewayConfig();
