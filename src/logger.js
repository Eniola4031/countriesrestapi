import pino from 'pino';
import pinoHttp from 'pino-http';

const { NODE_ENV = 'development', LOG_LEVEL = 'info', PRETTY_LOGS = 'true' } = process.env;

const isProd = NODE_ENV === 'production';
const usePretty = PRETTY_LOGS === 'true' && !isProd;

// Base app logger
export const logger = pino({
  level: LOG_LEVEL,
  transport: usePretty
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          singleLine: true,
          messageFormat: '{msg}',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie'],
    remove: true,
  },
});

export const httpLogger = pinoHttp({
  logger,
  genReqId: (req, res) => {
    const existing = req.headers['x-request-id'];
    if (existing) return existing;
    const id = Math.random().toString(36).slice(2, 10);
    res.setHeader('x-request-id', id);
    return id;
  },
  serializers: {
    req(req) {
      return {
        id: req.id,
        method: req.method,
        url: req.url,
        headers: {
          'user-agent': req.headers['user-agent'],
          'x-forwarded-for': req.headers['x-forwarded-for'],
        },
      };
    },
    res(res) {
      return {
        statusCode: res.statusCode,
      };
    },
    err(err) {
      return {
        type: err.type,
        message: err.message,
        stack: err.stack,
      };
    },
  },
  customSuccessMessage: function (req, res) {
    const rt = res.getHeader('X-Response-Time');
    return `OK ${req.method} ${req.url} ${res.statusCode}${rt ? ` ${rt}` : ''}`;
  },
  customLogLevel: function (req, res, err) {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  autoLogging: {
    ignore: (req) => ['/status', '/health', '/favicon.ico'].includes(req.url),
  },
});

export function responseTimeHeader(req, res, next) {
  const start = process.hrtime.bigint();

  res.once('header', () => {
    const diffNs = Number(process.hrtime.bigint() - start);
    const ms = (diffNs / 1e6).toFixed(2);
    res.setHeader('X-Response-Time', `${ms}ms`);
  });

  next();
}
