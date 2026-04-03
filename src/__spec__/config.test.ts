import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, jest } from '@jest/globals';

import {
  DEFAULT_EXAMPLE_CONFIG_PATH,
  ensureConfigFile,
  ensureUniqueDomains,
  failConfigValidation,
  failRouteValidation,
  getRequiredRouteString,
  isValidPort,
  isValidPositiveInteger,
  loadEnvFile,
  normalizeDomain,
  parseGatewayConfig,
  parseRoute,
  readGatewayConfig,
  stripOptionalQuotes,
  validateHttpUrl,
} from '../config.js';

describe('config helpers', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.TEST_KEY;
    delete process.env.TEST_QUOTED;
    delete process.env.TEST_SINGLE;
    delete process.env.EXISTING;
  });

  it('stripOptionalQuotes handles quoted and plain values', () => {
    expect(stripOptionalQuotes('"hello"')).toBe('hello');
    expect(stripOptionalQuotes("'world'")).toBe('world');
    expect(stripOptionalQuotes('plain')).toBe('plain');
    expect(stripOptionalQuotes('"')).toBe('"');
  });

  it('normalizeDomain trims and lowercases', () => {
    expect(normalizeDomain('  Oms.LocalTest.Me  ')).toBe('oms.localtest.me');
  });

  it('validates ports and positive integers', () => {
    expect(isValidPort(1)).toBe(true);
    expect(isValidPort(65535)).toBe(true);
    expect(isValidPort(0)).toBe(false);
    expect(isValidPort(70000)).toBe(false);
    expect(isValidPort(1.5)).toBe(false);

    expect(isValidPositiveInteger(1)).toBe(true);
    expect(isValidPositiveInteger(0)).toBe(false);
    expect(isValidPositiveInteger(-1)).toBe(false);
    expect(isValidPositiveInteger(1.2)).toBe(false);
  });

  it('getRequiredRouteString validates text values', () => {
    expect(getRequiredRouteString('  a  ', 'source.json', 0, 'domain')).toBe('a');
    expect(() => getRequiredRouteString(123, 'source.json', 0, 'target')).toThrow(
      '"target" must be non-empty string',
    );
    expect(() => getRequiredRouteString('   ', 'source.json', 0, 'domain')).toThrow(
      '"domain" must be non-empty string',
    );
  });

  it('validateHttpUrl accepts http/https and rejects invalid protocols', () => {
    expect(() => validateHttpUrl('http://127.0.0.1:3002', 'source.json', 0)).not.toThrow();
    expect(() => validateHttpUrl('https://example.com', 'source.json', 1)).not.toThrow();
    expect(() => validateHttpUrl('ftp://example.com', 'source.json', 2)).toThrow(
      '"target" must be valid http(s) URL',
    );
    expect(() => validateHttpUrl('not-a-url', 'source.json', 3)).toThrow(
      '"target" must be valid http(s) URL',
    );
  });

  it('parseRoute parses valid route and default health check path', () => {
    const route = parseRoute(
      {
        domain: 'oms.localtest.me',
        target: 'http://127.0.0.1:3002',
        websocket: true,
        healthCheckEnabled: true,
        healthCheckPath: '   ',
      },
      'source.json',
      0,
    );

    expect(route).toEqual({
      domain: 'oms.localtest.me',
      target: 'http://127.0.0.1:3002',
      websocket: true,
      healthCheckEnabled: true,
      healthCheckPath: '/',
    });
  });

  it('parseRoute validates route shape', () => {
    expect(() => parseRoute(null, 'source.json', 0)).toThrow('expected object');
    expect(
      () =>
        parseRoute(
          {
            domain: 'oms.localtest.me',
            target: 'http://127.0.0.1:3002',
            websocket: 'yes',
          },
          'source.json',
          0,
        ),
    ).toThrow('"websocket" must be boolean');

    expect(
      () =>
        parseRoute(
          {
            domain: 'oms.localtest.me',
            target: 'http://127.0.0.1:3002',
            healthCheckEnabled: 'yes',
          },
          'source.json',
          0,
        ),
    ).toThrow('"healthCheckEnabled" must be boolean');

    expect(
      () =>
        parseRoute(
          {
            domain: 'oms.localtest.me',
            target: 'http://127.0.0.1:3002',
            healthCheckPath: 123,
          },
          'source.json',
          0,
        ),
    ).toThrow('"healthCheckPath" must be string');

    expect(
      () =>
        parseRoute(
          {
            domain: 'oms.localtest.me',
            target: 'http://127.0.0.1:3002',
            healthCheckPath: 'health',
          },
          'source.json',
          0,
        ),
    ).toThrow('"healthCheckPath" must start with "/"');
  });

  it('ensureUniqueDomains rejects duplicates after normalization', () => {
    expect(() =>
      ensureUniqueDomains(
        [
          { domain: ' Oms.LocalTest.Me ', target: 'http://127.0.0.1:3002' },
          { domain: 'oms.localtest.me', target: 'http://127.0.0.1:3003' },
        ],
        'source.json',
      ),
    ).toThrow('duplicate domain');
  });

  it('parseGatewayConfig validates root structure and returns normalized config', () => {
    const parsed = parseGatewayConfig(
      {
        listenPort: 18080,
        healthCheckIntervalMs: 1000,
        routes: [{ domain: 'oms.localtest.me', target: 'http://127.0.0.1:3002' }],
      },
      'source.json',
    );

    expect(parsed.listenPort).toBe(18080);
    expect(parsed.healthCheckIntervalMs).toBe(1000);
    expect(parsed.routes).toHaveLength(1);

    expect(() => parseGatewayConfig(null, 'source.json')).toThrow('expected JSON object');
    expect(
      () =>
        parseGatewayConfig(
          { listenPort: 0, healthCheckIntervalMs: 1000, routes: [] },
          'source.json',
        ),
    ).toThrow('"listenPort" must be integer 1-65535');

    expect(
      () =>
        parseGatewayConfig(
          { listenPort: 18080, healthCheckIntervalMs: 0, routes: [] },
          'source.json',
        ),
    ).toThrow('"healthCheckIntervalMs" must be positive integer');

    expect(
      () =>
        parseGatewayConfig(
          { listenPort: 18080, healthCheckIntervalMs: 1000, routes: {} },
          'source.json',
        ),
    ).toThrow('"routes" must be array');

    expect(
      () =>
        parseGatewayConfig(
          { listenPort: 18080, healthCheckIntervalMs: 1000, routes: [] },
          'source.json',
        ),
    ).toThrow('"routes" must not be empty');
  });

  it('loadEnvFile reads valid variables and preserves existing values', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'proxy-env-'));
    const envPath = path.join(tempDir, '.env');

    fs.writeFileSync(
      envPath,
      [
        '# comment',
        'TEST_KEY=value',
        'TEST_QUOTED="quoted"',
        "TEST_SINGLE='single'",
        'EXISTING=changed',
        'INVALID',
        '=EMPTY',
      ].join('\n'),
      'utf-8',
    );

    process.env.EXISTING = 'keep';

    loadEnvFile(envPath);

    expect(process.env.TEST_KEY).toBe('value');
    expect(process.env.TEST_QUOTED).toBe('quoted');
    expect(process.env.TEST_SINGLE).toBe('single');
    expect(process.env.EXISTING).toBe('keep');
  });

  it('ensureConfigFile handles existing file and local example template', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'proxy-config-local-'));
    const configPath = path.join(tempDir, 'gateway.config.json');
    const localExamplePath = path.join(tempDir, 'gateway.config.example.json');

    fs.writeFileSync(configPath, '{"hello":"world"}\n', 'utf-8');
    ensureConfigFile(configPath);
    expect(fs.readFileSync(configPath, 'utf-8')).toContain('hello');

    fs.rmSync(configPath);
    fs.writeFileSync(localExamplePath, '{"listenPort":19090,"healthCheckIntervalMs":1000,"routes":[{"domain":"a.local","target":"http://127.0.0.1:3001"}]}\n', 'utf-8');

    ensureConfigFile(configPath);
    expect(fs.readFileSync(configPath, 'utf-8')).toContain('19090');
  });

  it('ensureConfigFile falls back to default template and built-in defaults', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'proxy-config-default-'));
    const configPath = path.join(tempDir, 'gateway.config.json');

    ensureConfigFile(configPath);
    const generated = fs.readFileSync(configPath, 'utf-8');
    expect(generated).toContain('listenPort');

    fs.rmSync(configPath);

    const realExistsSync = fs.existsSync.bind(fs);
    jest
      .spyOn(fs, 'existsSync')
      .mockImplementation((targetPath: fs.PathLike) => {
        if (String(targetPath) === DEFAULT_EXAMPLE_CONFIG_PATH) {
          return false;
        }
        return realExistsSync(targetPath);
      });

    ensureConfigFile(configPath);
    const fallback = fs.readFileSync(configPath, 'utf-8');
    expect(fallback).toContain('"listenPort": 18080');
    expect(fallback).toContain('"healthCheckIntervalMs": 60000');
  });

  it('readGatewayConfig throws for invalid JSON content', () => {
    const realReadFileSync = fs.readFileSync.bind(fs);

    jest
      .spyOn(fs, 'readFileSync')
      .mockImplementation((filePath: fs.PathOrFileDescriptor, options?: unknown) => {
        if (String(filePath).endsWith('gateway.config.json')) {
          return '{';
        }
        return realReadFileSync(filePath, options as never);
      });

    expect(() => readGatewayConfig()).toThrow('must be valid JSON');
  });

  it('throws custom config and route validation errors', () => {
    expect(() => failConfigValidation('source.json', 'bad')).toThrow(
      'Invalid config from source.json: bad',
    );
    expect(() => failRouteValidation('source.json', 2, 'bad route')).toThrow(
      'Invalid route[2] in source.json: bad route',
    );
  });
});
