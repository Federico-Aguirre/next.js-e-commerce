import { Env } from './Env';

type LogLevel = 'error' | 'info' | 'debug' | 'warning' | 'trace' | 'fatal';

const levelPriority: Record<LogLevel, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warning: 40,
  error: 50,
  fatal: 60,
};

const shouldLog = (level: LogLevel) => {
  const configuredLevel = Env.NEXT_PUBLIC_LOGGING_LEVEL;
  const configuredPriority = levelPriority[configuredLevel];

  return (
    configuredPriority !== undefined &&
    levelPriority[level] >= configuredPriority
  );
};

export const logger = {
  info(message: string) {
    if (shouldLog('info')) {
      console.info(message);
    }
  },
  error(message: string) {
    if (shouldLog('error')) {
      console.error(message);
    }
  },
};
