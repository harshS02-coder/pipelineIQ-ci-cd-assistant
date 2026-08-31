import pino from 'pino';
import { createRequire } from 'module';

const logLevel = process.env.LOG_LEVEL || 'info';

const require = createRequire(import.meta.url);
const hasPinoPretty = (() => {
  try {
    require.resolve('pino-pretty');
    return true;
  } catch {
    return false;
  }
})();

const isProduction = process.env.NODE_ENV === 'production';
const transport =
  !isProduction && hasPinoPretty
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
          singleLine: false,
        },
      }
    : undefined;

const logger = pino({
  level: logLevel,
  ...(transport ? { transport } : {}),
  timestamp: pino.stdTimeFunctions.isoTime,
});

export default logger;
