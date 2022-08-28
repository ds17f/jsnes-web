import { ButtonKey, ControllerKey } from "jsnes";
import { getLogger } from "./utils/logging";

const LOGGER = getLogger("GamepadController");

type ButtonTypes = "axis" | "button";

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

interface GamepadControllerOptions {
  onButtonDown: () => {};
  onButtonUp: () => {};
  gamepadState: Gamepad[];
}

/**
 * A reduced view of the Gamepad interface
 * only tracking the fields which the GamepadController class
 * cares about
 */
interface GamepadState {
  /** The state of the axes of the gamepad */
  readonly axes: ReadonlyArray<number>;
  /** The state of the buttons of the gamepad */
  readonly buttons: ReadonlyArray<GamepadButton>;
}

/**
 *
 */
export default class GamepadController {
  private readonly onButtonDown: (
    controller: ControllerKey,
    button: ButtonKey
  ) => {};
  private readonly onButtonUp: (
    controller: ControllerKey,
    button: ButtonKey
  ) => {};
  /** Track the state of the gamepads */
  private readonly gamepadState: GamepadState[];
  private buttonCallback: ((props: ButtonCallbackProps) => void) | null;
  private gamepadConfig: Gamepads | undefined;

  constructor(options: GamepadControllerOptions) {
    this.onButtonDown = options.onButtonDown;
    this.onButtonUp = options.onButtonUp;
    this.gamepadState = [];
    this.buttonCallback = null;
  }

  disableIfGamepadEnabled = (
    callback: (controller: ControllerKey, button: ButtonKey) => {}
  ) => {
    const self = this;
    return (playerId: ControllerKey, buttonId: ButtonKey) => {
      if (!self.gamepadConfig) {
        return callback(playerId, buttonId);
      }

      const playerGamepadId = self.gamepadConfig.playerGamepadId;
      if (!playerGamepadId || !playerGamepadId[playerId - 1]) {
        // allow callback only if player is not associated to any gamepad
        return callback(playerId, buttonId);
      }
    };
  };

  /**
   * Determines which player the gamepad belongs to
   * @param gamepad
   */
  _getPlayerNumberFromGamepad = (gamepad: Gamepad) => {
    if (this.gamepadConfig?.playerGamepadId[0] === gamepad.id) {
      return 1;
    }

    if (this.gamepadConfig?.playerGamepadId[1] === gamepad.id) {
      return 2;
    }

    return 1;
  };

  poll = () => {
    LOGGER.trace("Polling Gamepad");

    const gamepads: Gamepad[] = navigator.getGamepads
      ? navigator.getGamepads()
      // @ts-ignore webkitGetGamepads() isn't a thing?
      : navigator.webkitGetGamepads(); // TODO: what is webkitGetGamepads()
    LOGGER.trace("GamePads: ", JSON.stringify(gamepads));

    const usedPlayers = [];

    for (let gamepadIndex = 0; gamepadIndex < gamepads.length; gamepadIndex++) {
      LOGGER.debug(`Reading gamepad ${gamepadIndex} button states (?????)`);
      const gamepad = gamepads[gamepadIndex];
      const previousGamepad = this.gamepadState[gamepadIndex];
      LOGGER.trace({ gamepad, previousGamepad });

      if (!gamepad) {
        LOGGER.debug("No gamepad found");
        continue;
      }

      if (!previousGamepad) {
        LOGGER.debug("Initialize gamepad state");
        this.gamepadState[gamepadIndex] = {
          buttons: gamepad.buttons.map(b => Object.assign({}, b)),
          axes: gamepad.axes.slice(0)
        };
        continue;
      }

      LOGGER.debug("Load button current and prior states");
      const buttons = gamepad.buttons;
      const previousButtons = previousGamepad.buttons;

      if (this.buttonCallback) {
        LOGGER.debug("this.buttonCallback exists");

        LOGGER.debug("Process axes changes");
        for (let code = 0; code < gamepad.axes.length; code++) {
          /**
           * If the axis has changed state to be axisState, notify the buttonCallback
           *
           * @param axisState the expected value of the axis
           * @param buttonCallback a callback to call if the axis has moved to axisState
           */
          const processAxisChange = (
            axisState: number,
            buttonCallback: (props: ButtonCallbackProps) => void
          ) => {
            const axis = gamepad.axes[code];
            const previousAxis = previousGamepad.axes[code];
            LOGGER.trace({ axis, previousAxis });
            if (axis === axisState && previousAxis !== axisState) {
              LOGGER.debug(
                `Axis changed to ${axisState}, call notify buttonCallback`
              );
              const buttonCallbackProps: ButtonCallbackProps = {
                gamepadId: gamepad.id,
                type: "axis",
                code: code,
                value: axis
              };
              LOGGER.trace({ buttonCallbackProps });
              buttonCallback(buttonCallbackProps);
            }
          };

          processAxisChange(-1, this.buttonCallback);
          processAxisChange(1, this.buttonCallback);
        }

        LOGGER.debug("Process button changes for all buttons on the gamepad");
        for (let code = 0; code < buttons.length; code++) {
          const button = buttons[code];
          const previousButton = previousButtons[code];
          LOGGER.trace(`Gamepad Button: ${button}`);
          LOGGER.trace(`Prior button state: ${previousButton}`);

          if (button.pressed && !previousButton.pressed) {
            LOGGER.debug(`button: ${button} has been pressed`);
            const buttonCallbackProps: ButtonCallbackProps = {
              gamepadId: gamepad.id,
              type: "button",
              code: code
            };
            LOGGER.trace(`buttonCallbackProps: ${buttonCallbackProps}`);
            this.buttonCallback(buttonCallbackProps);
          }
        }
      } else if (this.gamepadConfig) {
        LOGGER.debug("No buttonCallback, but yes gamepadConfig");
        let playerNumber = this._getPlayerNumberFromGamepad(gamepad);
        LOGGER.trace(`player number: ${playerNumber}`);
        if (usedPlayers.length < 2) {
          LOGGER.debug("Adding player gamepad");
          if (usedPlayers.indexOf(playerNumber) !== -1) {
            LOGGER.debug("New player");
            playerNumber++;
            if (playerNumber > 2) playerNumber = 1;
          }
          usedPlayers.push(playerNumber);

          if (this.gamepadConfig.configs[gamepad.id]) {
            LOGGER.debug(`Gamepad ${gamepad.id} is configured`);
            const configButtons = this.gamepadConfig.configs[gamepad.id]
              .buttons;
            LOGGER.trace(`configButtons: ${configButtons}`);

            LOGGER.debug("Process button presses");
            for (let i = 0; i < configButtons.length; i++) {
              const configButton = configButtons[i];
              const playerControllerKey = playerNumber as ControllerKey;
              if (configButton.type === "button") {
                const code = configButton.code;
                const button = buttons[code];
                const previousButton = previousButtons[code];

                if (button.pressed && !previousButton.pressed) {
                  LOGGER.trace(
                    `Button ${button} has been pressed, notify onButtonDown`
                  );
                  this.onButtonDown(playerControllerKey, configButton.buttonId);
                } else if (!button.pressed && previousButton.pressed) {
                  LOGGER.trace(
                    `Button ${button} has been released, notify onButtonUp`
                  );
                  this.onButtonUp(playerControllerKey, configButton.buttonId);
                }
              } else if (configButton.type === "axis") {
                const code = configButton.code;
                const axis = gamepad.axes[code];
                const previousAxis = previousGamepad.axes[code];

                if (
                  axis === configButton.value &&
                  previousAxis !== configButton.value
                ) {
                  LOGGER.debug(
                    `axis: ${axis} is being pressed, notify onButtonDown`
                  );
                  this.onButtonDown(playerControllerKey, configButton.buttonId);
                }

                if (
                  axis !== configButton.value &&
                  previousAxis === configButton.value
                ) {
                  LOGGER.debug(
                    `axis: ${axis} has been released, notify onButtonUp`
                  );
                  this.onButtonUp(playerControllerKey, configButton.buttonId);
                }
              }
            }
          }
        }
      }

      LOGGER.debug("Update the state of the gamepad after processing");
      this.gamepadState[gamepadIndex] = {
        buttons: buttons.map(b => Object.assign({}, b)),
        axes: gamepad.axes.slice(0)
      };
    }
  };

  /**
   * Used for binding gamepad buttons to a callback for the button
   * @param f
   */
  promptButton = (f: (buttonInfo: ButtonCallbackProps | undefined) => void) => {
    LOGGER.trace("Gamepad promptButton");
    LOGGER.trace(f);
    if (!f) {
      LOGGER.debug("Clear buttonCallback");
      this.buttonCallback = f;
    } else {
      LOGGER.debug("Set buttonCallback");
      this.buttonCallback = (buttonInfo: ButtonCallbackProps) => {
        this.buttonCallback = null;
        f(buttonInfo);
      };
    }
  };

  loadGamepadConfig = () => {
    let gamepadConfig;
    try {
      gamepadConfig = localStorage.getItem("gamepadConfig");
      if (gamepadConfig) {
        gamepadConfig = JSON.parse(gamepadConfig);
      }
    } catch (e) {
      console.log("Failed to get gamepadConfig from localStorage.", e);
    }

    this.gamepadConfig = gamepadConfig;
  };

  setGamepadConfig = (gamepadConfig: Gamepads) => {
    try {
      localStorage.setItem("gamepadConfig", JSON.stringify(gamepadConfig));
      this.gamepadConfig = gamepadConfig;
    } catch (e) {
      console.log("Failed to set gamepadConfig in localStorage");
    }
  };

  startPolling = () => {
    // @ts-ignore navigator.webkitGetGamepads isn't a thing?
    if (!(navigator.getGamepads || navigator.webkitGetGamepads)) {
      return { stop: () => {} };
    }

    let stopped = false;
    const loop = () => {
      if (stopped) return;

      this.poll();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);

    return {
      stop: () => {
        stopped = true;
      }
    };
  };
}
