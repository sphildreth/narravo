// SPDX-License-Identifier: Apache-2.0
const LOG_LEVEL = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'development' ? 'debug' : 'info');

const log = (level: string, message: string, ...args: any[]) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`, ...args);
};

const logger = {
  debug: (message: string, ...args: any[]) => {
    if (LOG_LEVEL === 'debug') {
      log('debug', message, ...args);
    }
  },
  info: (message: string, ...args: any[]) => {
    log('info', message, ...args);
  },
  warn: (message: string, ...args: any[]) => {
    log('warn', message, ...args);
  },
  error: (message: string, ...args: any[]) => {
    log('error', message, ...args);
  },
};

export default logger;
