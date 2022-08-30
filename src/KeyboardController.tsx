import {ButtonKey, Controller, ControllerKey} from "jsnes";

/**
 * Represents a single entry for a key on the keyboard
 * [Controller#, Button, Description]
 */
type KeyMapTuple = [ControllerKey, ButtonKey, string];

/**
 * Maps an ASCII code to a [controller, button, description]
 */
export interface KeyboardMapping {
  [key: number]: KeyMapTuple;
}

const DEFAULT_KEYBOARD_MAPPING: KeyboardMapping = {
  88: [1, Controller.BUTTON_A, "X"], // X
  89: [1, Controller.BUTTON_B, "Y"], // Y (Central European keyboard)
  90: [1, Controller.BUTTON_B, "Z"], // Z
  17: [1, Controller.BUTTON_SELECT, "Right Ctrl"], // Right Ctrl
  13: [1, Controller.BUTTON_START, "Enter"], // Enter
  38: [1, Controller.BUTTON_UP, "Up"], // Up
  40: [1, Controller.BUTTON_DOWN, "Down"], // Down
  37: [1, Controller.BUTTON_LEFT, "Left"], // Left
  39: [1, Controller.BUTTON_RIGHT, "Right"], // Right
  103: [2, Controller.BUTTON_A, "Num-7"], // Num-7
  105: [2, Controller.BUTTON_B, "Num-9"], // Num-9
  99: [2, Controller.BUTTON_SELECT, "Num-3"], // Num-3
  97: [2, Controller.BUTTON_START, "Num-1"], // Num-1
  104: [2, Controller.BUTTON_UP, "Num-8"], // Num-8
  98: [2, Controller.BUTTON_DOWN, "Num-2"], // Num-2
  100: [2, Controller.BUTTON_LEFT, "Num-4"], // Num-4
  102: [2, Controller.BUTTON_RIGHT, "Num-6"] // Num-6
};
interface KeyboardControllerOptions {
  onButtonDown: (controller: ControllerKey, button: ButtonKey) => void
  onButtonUp: (controller: ControllerKey, button: ButtonKey) => void
}

export default class KeyboardController {
  private readonly onButtonDown: (controller: ControllerKey, button: ButtonKey) => void;
  private readonly onButtonUp: (controller: ControllerKey, button: ButtonKey) => void;
  public keys: KeyboardMapping | undefined;

  constructor(options: KeyboardControllerOptions) {
    this.onButtonDown = options.onButtonDown;
    this.onButtonUp = options.onButtonUp;
  }

  /**
   * Loads serialized keymap from localStorage
   * if not found, uses the default
   */
  loadKeys = () => {
    let loadedKeymapping: KeyboardMapping | undefined;
    try {
      const storedKeys = localStorage.getItem("keys");
      if (storedKeys) {
        loadedKeymapping = JSON.parse(storedKeys) as KeyboardMapping;
      }
    } catch (e) {
      console.log("Failed to get keys from localStorage.", e);
    }

    this.keys = loadedKeymapping || DEFAULT_KEYBOARD_MAPPING;
  };

  /**
   * Stores a KeyboardMapping to local storage
   * @param newKeys
   */
  setKeys = (newKeys: KeyboardMapping) => {
    try {
      localStorage.setItem("keys", JSON.stringify(newKeys));
      this.keys = newKeys;
    } catch (e) {
      console.log("Failed to set keys in localStorage");
    }
  };

  /**
   * Handle a key pressed down on the keyboard
   * @param e
   */
  handleKeyDown = (e: KeyboardEvent) => {
    const key: KeyMapTuple | undefined = this.keys ? this.keys[e.keyCode] : undefined; // TODO: Consider using `code` instead as it is better supported but is a string
    if (key) {
      const [controller, button] = key;
      this.onButtonDown(controller, button);
      e.preventDefault();
    }
  };

  /**
   * Handle a key up on the keyboard
   * @param e
   */
  handleKeyUp = (e: KeyboardEvent) => {
    const key: KeyMapTuple | undefined = this.keys ? this.keys[e.keyCode] : undefined; // TODO: Consider using `code` instead as it is better supported but is a string
    if (key) {
      const [controller, button] = key;
      this.onButtonUp(controller, button);
      e.preventDefault();
    }
  };

  /**
   * Handle any keypress
   * @param e
   */
  handleKeyPress = (e: KeyboardEvent) => {
    e.preventDefault();
  };
}
