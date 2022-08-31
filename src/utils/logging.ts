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

// @ts-ignore
window["setLogLevels"] = (level: string) => {
  Object.values(loggers).forEach(logPair => {
    console.log(logPair.parentLogger.level);
    logPair.parentLogger.level = level;
    console.log(logPair.parentLogger.level);
  });
};
// @ts-ignore
window["getLogLevels"] = () => {
  Object.values(loggers).forEach(logPair => {
    console.log(logPair.parentLogger.level);
  });
};

// @ts-ignore
window["setLogLevel"] = (service: string, level: string) => {
  loggers[service].parentLogger.level = level;
};
// @ts-ignore
window["getLogLevel"] = (service: string) => loggers[service].parentLogger;
