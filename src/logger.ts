type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'OK';
const MAX_RECENT_LOGS = 80;
const recentLogs: string[] = [];

export const serialize = (meta?: Record<string, unknown>): string => {
  if (!meta || Object.keys(meta).length === 0) {
    return '';
  }

  try {
    return JSON.stringify(meta);
  } catch {
    return '{"meta":"[unserializable]"}';
  }
};

export const log = (
  level: LogLevel,
  message: string,
  meta?: Record<string, unknown>,
): void => {
  const time = new Date().toISOString();
  const levelLabel = '[' + level + ']';
  const line = `${levelLabel} ${time} ${message} ${serialize(meta)}`;
  recentLogs.push(line);
  if (recentLogs.length > MAX_RECENT_LOGS) {
    recentLogs.shift();
  }
  if (level === 'ERROR') {
    console.error(line);
    return;
  }
  console.log(line);
};

export const getRecentLogs = (limit = 20): string[] => {
  const normalizedLimit = Number.isInteger(limit) && limit > 0 ? limit : 20;
  return recentLogs.slice(-normalizedLimit);
};

export const logInfo = (message: string, meta?: Record<string, unknown>): void => {
  log('INFO', message, meta);
};

export const logWarn = (message: string, meta?: Record<string, unknown>): void => {
  log('WARN', message, meta);
};

export const logError = (message: string, meta?: Record<string, unknown>): void => {
  log('ERROR', message, meta);
};

export const logSuccess = (
  message: string,
  meta?: Record<string, unknown>,
): void => {
  log('OK', message, meta);
};
