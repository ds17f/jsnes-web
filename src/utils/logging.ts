import Pino from "pino";

const DEFAULT_LOG_LEVEL =
  process.env.NODE_ENV === "production" ? "fatal" : "info";

/**
 * Get a configured logger
 * @param service
 * @param silenceOutput
 */
export const getLogger = (
  service: string,
  silenceOutput = false
): Pino.Logger => {
  const parentLogger = Pino({
    level: silenceOutput ? "silent" : DEFAULT_LOG_LEVEL
  });
  const childLogger = parentLogger.child({
    service: service
  });
  loggers[service] = { parentLogger, childLogger };

  return childLogger;
};

// Tracking methods to allow controlling log level at runtime
const loggers: {
  [key: string]: { parentLogger: Pino.Logger; childLogger: Pino.Logger };
} = {};

/**
 * Set the log levels of the loggers
 * @param level
 */
window.setLogLevels = (level: string) => {
  Object.values(loggers).forEach(logPair => {
    console.log(logPair.parentLogger.level);
    logPair.parentLogger.level = level;
    console.log(logPair.parentLogger.level);
  });
};

/**
 * Print the log levels of the loggers
 * @param level
 */
window.printLogLevels = () => {
  Object.values(loggers).forEach(logPair => {
    console.log(logPair.parentLogger.level);
  });
};

/**
 * Set the log level of a specific logger
 * @param service
 * @param level
 */
window.setLogLevel = (service: string, level: string) => {
  loggers[service].parentLogger.level = level;
};

/**
 * Print the log level of a specific logger
 * @param service
 */
window.printLogLevel = (service: string) => loggers[service].parentLogger;
