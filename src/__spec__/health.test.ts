import http from 'node:http';
import https from 'node:https';
import { EventEmitter } from 'node:events';
import { runInNewContext } from 'node:vm';
import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { checkTargetHealth } from '../health.js';

interface MockRequest extends EventEmitter {
  end: () => void;
  destroy: () => void;
}

const createMockRequest = (): MockRequest => {
  const req = new EventEmitter() as MockRequest;
  req.end = jest.fn();
  req.destroy = jest.fn();
  return req;
};

describe('checkTargetHealth', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns UP for 2xx over http', async () => {
    jest.spyOn(http, 'request').mockImplementation(((...args: unknown[]) => {
      const req = createMockRequest();
      const callback = args.find(
        (arg): arg is (res: unknown) => void => typeof arg === 'function',
      );
      callback?.({ statusCode: 204, resume: jest.fn() });
      return req as never;
    }) as typeof http.request);

    const result = await checkTargetHealth('http://127.0.0.1:3002', '/health');

    expect(result.up).toBe(true);
    expect(result.statusCode).toBe(204);
    expect(result.reason).toBeUndefined();
    expect(typeof result.checkedAt).toBe('string');
  });

  it('returns DOWN with status_code_unknown when status is missing', async () => {
    jest.spyOn(https, 'request').mockImplementation(((...args: unknown[]) => {
      const req = createMockRequest();
      const callback = args.find(
        (arg): arg is (res: unknown) => void => typeof arg === 'function',
      );
      callback?.({ statusCode: undefined, resume: jest.fn() });
      return req as never;
    }) as typeof https.request);

    const result = await checkTargetHealth('https://example.com', '/ready');

    expect(result.up).toBe(false);
    expect(result.reason).toBe('status_code_unknown');
  });

  it('returns DOWN with timeout reason', async () => {
    jest.spyOn(http, 'request').mockImplementation(((_options, _callback) => {
      const req = createMockRequest();
      req.end = jest.fn(() => {
        req.emit('timeout');
      });
      return req as never;
    }) as typeof http.request);

    const result = await checkTargetHealth('http://127.0.0.1:3002', '/timeout');

    expect(result.up).toBe(false);
    expect(result.reason).toBe('timeout');
  });

  it('returns DOWN with error reason from request error event', async () => {
    jest.spyOn(http, 'request').mockImplementation(((_options, _callback) => {
      const req = createMockRequest();
      req.end = jest.fn(() => {
        req.emit('error', new Error('ECONNREFUSED'));
      });
      return req as never;
    }) as typeof http.request);

    const result = await checkTargetHealth('http://127.0.0.1:3002', '/error');

    expect(result.up).toBe(false);
    expect(result.reason).toBe('ECONNREFUSED');
  });

  it('returns DOWN for invalid url input (Error case)', async () => {
    const result = await checkTargetHealth('not-a-url');

    expect(result.up).toBe(false);
    expect(result.reason).toBeTruthy();
  });

  it('returns DOWN with explicit Error message from catch branch', async () => {
    const RealURL = globalThis.URL;
    (globalThis as { URL: typeof URL }).URL = class URLMock {
      constructor() {
        throw new Error('bad-url');
      }
    } as never;

    try {
      const result = await checkTargetHealth('http://127.0.0.1:3002');
      expect(result.up).toBe(false);
      expect(result.reason).toBe('bad-url');
    } finally {
      (globalThis as { URL: typeof URL }).URL = RealURL;
    }
  });

  it('returns DOWN with unknown error for foreign-realm Error objects', async () => {
    const RealURL = globalThis.URL;
    const foreignRealmError = runInNewContext('new Error("invalid")') as Error;

    (globalThis as { URL: typeof URL }).URL = class URLMock {
      constructor() {
        throw foreignRealmError;
      }
    } as never;

    try {
      const result = await checkTargetHealth('http://127.0.0.1:3002');
      expect(result.up).toBe(false);
      expect(result.reason).toBe('unknown error');
    } finally {
      (globalThis as { URL: typeof URL }).URL = RealURL;
    }
  });
});
