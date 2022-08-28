import Pino  from 'pino'

const DEFAULT_LOG_LEVEL = "debug";

/**
 * Get a configured logger
 * @param service
 * @param silenceOutput
 */
export const getLogger = (service: string, silenceOutput: boolean = false): Pino.Logger => {
  const logger = Pino({
    level: silenceOutput ? "silent" : process.env.LOG_LEVEL || DEFAULT_LOG_LEVEL,
  }).child({
    service: service,
  })

  return logger;
};
