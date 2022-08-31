import { ButtonKey } from "jsnes";

export type ButtonTypes = "axis" | "button";

/**
 * A set of gamepads and their configurations
 */
export interface Gamepads {
  /** An array of names of the gamepads, can be used to index the configs*/
  playerGamepadId: Array<string | null>;
  /** Keys in the configs map to the entries in the playerGamepadId array */
  configs: GamepadConfig;
}

/**
 * A map of controllerIDs to the button configurations for that gamepad
 */
export interface GamepadConfig {
  [key: string]: GamepadButtonConfig;
}

export interface GamepadButtonConfig {
  buttons: NesGamepadButton[];
}

/**
 * A button on the gamepad and its state
 */
export interface NesGamepadButton {
  /** The type of the button: "axis" or "button" */
  type: ButtonTypes;
  /** The NES control pad button that this is bound to **/
  buttonId: ButtonKey;
  /** The gamepad button */
  code: number;
  /** Axis can be analog, so track a number based on how far it's been pressed */
  value: number;
}

export interface ButtonCallbackProps {
  gamepadId: string;
  type: ButtonTypes;
  code: number;
  value?: number;
}

export interface StartPollingResult {
  stop: () => void;
}
