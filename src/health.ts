import http from 'node:http';
import https from 'node:https';
import type { HealthStatus } from './types.js';

export const checkTargetHealth = async (
  targetUrl: string,
  healthCheckPath = '/',
): Promise<HealthStatus> => {
  return new Promise((resolve) => {
    try {
      const url = new URL(targetUrl);
      const client = url.protocol === 'https:' ? https : http;

      const req = client.request(
        {
          hostname: url.hostname,
          port: url.port ? Number(url.port) : undefined,
          path: healthCheckPath,
          method: 'GET',
          timeout: 3000,
        },
        (res) => {
          const statusCode = res.statusCode;
          const isUp =
            typeof statusCode === 'number' && statusCode >= 200 && statusCode < 500;

          resolve({
            up: isUp,
            statusCode,
            reason: isUp ? undefined : `status_code_${statusCode ?? 'unknown'}`,
            checkedAt: new Date().toISOString(),
          });
          res.resume();
        },
      );

      req.on('timeout', () => {
        req.destroy();
        resolve({
          up: false,
          reason: 'timeout',
          checkedAt: new Date().toISOString(),
        });
      });

      req.on('error', (error: Error) => {
        resolve({
          up: false,
          reason: error.message,
          checkedAt: new Date().toISOString(),
        });
      });

      req.end();
    } catch (error) {
      resolve({
        up: false,
        reason: error instanceof Error ? error.message : 'unknown error',
        checkedAt: new Date().toISOString(),
      });
    }
  });
};
