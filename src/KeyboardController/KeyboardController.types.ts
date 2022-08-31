import { ButtonKey, ControllerKey } from "jsnes";

/**
 * Represents a single entry for a key on the keyboard
 * [Controller#, Button, Description]
 */
export type KeyMapTuple = [ControllerKey, ButtonKey, string];

/**
 * Maps an ASCII code to a [controller, button, description]
 */
export interface KeyboardMapping {
  [key: number]: KeyMapTuple;
}
