/**
 * Structured logger utility using Winston
 * Logs are only shown when DEBUG environment variable is set (except errors)
 */

import winston from 'winston';

const isDebug = process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development';

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  })
);

const transports: winston.transport[] = [];

// Single console transport with conditional level
transports.push(
  new winston.transports.Console({
    level: isDebug ? 'debug' : 'error',
    format: consoleFormat
  })
);

export const logger = winston.createLogger({
  level: isDebug ? 'debug' : 'error',
  format: logFormat,
  transports,
  silent: !isDebug && process.env.NODE_ENV === 'production'
});
