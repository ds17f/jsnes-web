import Pino from "pino";

const DEFAULT_LOG_LEVEL =
  process.env.NODE_ENV === "production" || "test" ? "fatal" : "info";

/**
 * Get a configured logger
 * @param service
 * @param silenceOutput
 */
export const getLogger = (
  service: string,
  silenceOutput: boolean = false
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
 * Sets the level for all known loggers
 * @param level
 * @param silent
 */
export const setLogLevels = (level: string, silent: boolean) => {
  Object.values(loggers).forEach(logPair => {
    !silent && console.log(logPair.parentLogger.level);
    logPair.parentLogger.level = level;
    !silent && console.log(logPair.parentLogger.level);
  });
};

/**
 * Prints the log levels for all loggers to the console
 */
export const getLogLevels = () => {
  Object.values(loggers).forEach(logPair => {
    console.log(logPair.parentLogger.level);
  });
};

/**
 * Sets the log level for a specific logger
 * @param service
 * @param level
 */
const setLogLevel = (service: string, level: string) => {
  loggers[service].parentLogger.level = level;
};

/**
 * returns a specific parent logger
 * @param service
 */
export const getLogLevel =  (service: string) => loggers[service].parentLogger;

// @ts-ignore
window["setLogLevels"] = setLogLevels
// @ts-ignore
window["getLogLevels"] = getLogLevels
// @ts-ignore
window["setLogLevel"] = setLogLevel
// @ts-ignore
window["getLogLevel"] = getLogLevel