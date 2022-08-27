import Pino  from 'pino'

const DEFAULT_LOG_LEVEL = "fatal";

/**
 * Get a configured logger
 * @param service
 */
export const getLogger = (service: string): Pino.Logger => {
  const logger = Pino({
    level: process.env.LOG_LEVEL || DEFAULT_LOG_LEVEL,
  }).child({
    service: service,
  })

  return logger;
};
