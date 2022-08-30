import Raven from "raven-js";
import { getLogger } from "./logging";
import { ProgressHandler } from "../RunPage";
import { ErrorInfo } from "react";

const LOGGER = getLogger("utils");

type LoadBinaryCallback = (err: Error | null, nesRomString?: string) => void;

export const handleError = (
  error: Error,
  errorInfo: ErrorInfo | null = null
) => {
  LOGGER.error(error);
  Raven.captureException(error, { extra: errorInfo });
};

export function loadBinary(
  path: string,
  callback: LoadBinaryCallback,
  handleProgress: ProgressHandler
): XMLHttpRequest {
  const req = new XMLHttpRequest();
  req.open("GET", path);
  req.overrideMimeType("text/plain; charset=x-user-defined");
  req.onload = function() {
    if (this.status === 200) {
      if (req.responseText.match(/^<!doctype html>/i)) {
        // Got HTML back, so it is probably falling back to index.html due to 404
        return callback(new Error("Page not found"));
      }

      callback(null, this.responseText);
    } else if (this.status === 0) {
      // Aborted, so ignore error
    } else {
      callback(new Error(req.statusText));
    }
  };
  req.onerror = function() {
    callback(new Error(req.statusText));
  };
  req.onprogress = handleProgress;
  req.send();
  return req;
}
