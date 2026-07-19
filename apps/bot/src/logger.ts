import pino from 'pino';

const isDev = process.env.NODE_ENV !== 'production';

export const logger = pino(
  isDev
    ? {
        level: process.env.LOG_LEVEL ?? 'debug',
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:HH:MM:ss' },
        },
      }
    : { level: process.env.LOG_LEVEL ?? 'info' },
);
