import { NES } from "jsnes";

declare global {
  interface Window {
    /**
     * The NES emulator
     */
    nes: NES | undefined;
    /**
     * Set the log levels of the loggers
     * @param level
     */
    setLogLevels: (level: string) => void;
    /**
     * Print the log levels of the loggers
     * @param level
     */
    printLogLevels: () => void;
    /**
     * Set the log level of a specific logger
     * @param service
     * @param level
     */
    setLogLevel: (service: string, level: string) => void;
    /**
     * Print the log level of a specific logger
     * @param service
     */
    printLogLevel: (service: string) => void;
  }
  interface Navigator {
    webkitGetGamepads: () => Gamepad[];
  }
}
