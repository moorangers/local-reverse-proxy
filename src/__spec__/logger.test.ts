import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { log, logError, logInfo, logSuccess, logWarn, serialize } from '../logger.js';

describe('serialize', () => {
  it('returns empty string when metadata is undefined', () => {
    expect(serialize()).toBe('');
  });

  it('serializes plain metadata to JSON', () => {
    expect(serialize({ route: 'oms.localtest.me' })).toBe(
      '{"route":"oms.localtest.me"}',
    );
  });

  it('returns fallback JSON when metadata is unserializable', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    expect(serialize(circular)).toBe('{"meta":"[unserializable]"}');
  });
});

describe('log', () => {
  const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
  const errorSpy = jest
    .spyOn(console, 'error')
    .mockImplementation(() => undefined);

  beforeEach(() => {
    logSpy.mockClear();
    errorSpy.mockClear();
  });

  it('writes non-error levels to console.log', () => {
    log('INFO', 'proxy request', { domain: 'oms.localtest.me' });

    expect(logSpy).toHaveBeenCalledTimes(1);
    const line = String(logSpy.mock.calls[0]?.[0] ?? '');
    expect(line).toContain('[INFO]');
    expect(line).toContain('proxy request');
    expect(line).toContain('"domain":"oms.localtest.me"');
  });

  it('writes ERROR level to console.error', () => {
    log('ERROR', 'proxy failed', { code: 502 });

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const line = String(errorSpy.mock.calls[0]?.[0] ?? '');
    expect(line).toContain('[ERROR]');
    expect(line).toContain('proxy failed');
    expect(line).toContain('"code":502');
  });

  it('supports wrapper helpers', () => {
    logInfo('info');
    logWarn('warn');
    logSuccess('ok');
    logError('err');

    expect(logSpy).toHaveBeenCalledTimes(3);
    expect(errorSpy).toHaveBeenCalledTimes(1);

    const lines = logSpy.mock.calls.map((entry) => String(entry[0] ?? ''));
    expect(lines.some((line) => /\[INFO\].* info /.test(line))).toBe(true);
    expect(lines.some((line) => /\[WARN\].* warn /.test(line))).toBe(true);
    expect(lines.some((line) => /\[OK\].* ok /.test(line))).toBe(true);

    const errorLine = String(errorSpy.mock.calls[0]?.[0] ?? '');
    expect(errorLine).toMatch(/\[ERROR\].* err /);
  });
});
