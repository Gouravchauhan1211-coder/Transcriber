import { config } from '../config';

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

const colors: Record<LogLevel, string> = {
  info: '\x1b[36m',   // cyan
  warn: '\x1b[33m',   // yellow
  error: '\x1b[31m',  // red
  debug: '\x1b[90m',  // gray
};
const reset = '\x1b[0m';

function log(level: LogLevel, message: string, meta?: unknown) {
  if (level === 'debug' && config.NODE_ENV === 'production') return;
  const ts = new Date().toISOString();
  const color = config.NODE_ENV === 'production' ? '' : colors[level];
  const rst = config.NODE_ENV === 'production' ? '' : reset;
  const prefix = `${color}[${level.toUpperCase()}]${rst}`;
  const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
  console.log(`${ts} ${prefix} ${message}${metaStr}`);
}

export const logger = {
  info: (msg: string, meta?: unknown) => log('info', msg, meta),
  warn: (msg: string, meta?: unknown) => log('warn', msg, meta),
  error: (msg: string, meta?: unknown) => log('error', msg, meta),
  debug: (msg: string, meta?: unknown) => log('debug', msg, meta),
};
