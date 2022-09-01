import { ButtonKey, ControllerKey } from "jsnes";
import { getLogger } from "../../utils";
import {
  ButtonCallback,
  ButtonCallbackProps,
  Gamepads,
  PromptButtonHandler,
  StartPollingResult
} from "./GamepadController.types";

// Silence logging because the polling loop is very noisy
// if you need/want to see stuff in here
// switch the LOGGER definitions below
const LOGGER = getLogger("GamepadController", true);
// const LOGGER = getLogger("GamepadController");

interface GamepadControllerOptions {
  onButtonDown: (controller: ControllerKey, button: ButtonKey) => void;
  onButtonUp: (controller: ControllerKey, button: ButtonKey) => void;
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
export class GamepadController {
  private readonly onButtonDown: (
    controller: ControllerKey,
    button: ButtonKey
  ) => void;
  private readonly onButtonUp: (
    controller: ControllerKey,
    button: ButtonKey
  ) => void;
  /** Track the state of the gamepads */
  private readonly gamepadState: GamepadState[];
  private buttonCallback: ButtonCallback | null;
  public gamepadConfig: Gamepads | undefined;

  constructor(options: GamepadControllerOptions) {
    this.onButtonDown = options.onButtonDown;
    this.onButtonUp = options.onButtonUp;
    this.gamepadState = [];
    this.buttonCallback = null;
  }

  disableIfGamepadEnabled = (
    callback: (controller: ControllerKey, button: ButtonKey) => void
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
    LOGGER.debug("Polling Gamepad");

    const gamepads: Gamepad[] = navigator.getGamepads
      ? navigator.getGamepads()
      : // @ts-ignore webkitGetGamepads() isn't a thing?
        navigator.webkitGetGamepads(); // TODO: what is webkitGetGamepads()
    LOGGER.debug("GamePads: ", JSON.stringify(gamepads));

    const usedPlayers = [];

    for (let gamepadIndex = 0; gamepadIndex < gamepads.length; gamepadIndex++) {
      LOGGER.info(`Reading gamepad ${gamepadIndex} button states (?????)`);
      const gamepad = gamepads[gamepadIndex];
      const previousGamepad = this.gamepadState[gamepadIndex];
      LOGGER.debug({ gamepad, previousGamepad });

      if (!gamepad) {
        LOGGER.info("No gamepad found");
        continue;
      }

      if (!previousGamepad) {
        LOGGER.info("Initialize gamepad state");
        this.gamepadState[gamepadIndex] = {
          buttons: gamepad.buttons.map(b => Object.assign({}, b)),
          axes: gamepad.axes.slice(0)
        };
        continue;
      }

      LOGGER.info("Load button current and prior states");
      const buttons = gamepad.buttons;
      const previousButtons = previousGamepad.buttons;

      if (this.buttonCallback) {
        LOGGER.info("this.buttonCallback exists");

        LOGGER.info("Process axes changes");
        for (let code = 0; code < gamepad.axes.length; code++) {
          /**
           * If the axis has changed state to be axisState, notify the buttonCallback
           *
           * @param axisState the expected value of the axis
           * @param buttonCallback a callback to call if the axis has moved to axisState
           */
          const processAxisChange = (
            axisState: number,
            buttonCallback: ButtonCallback
          ) => {
            const axis = gamepad.axes[code];
            const previousAxis = previousGamepad.axes[code];
            LOGGER.debug({ axis, previousAxis });
            if (axis === axisState && previousAxis !== axisState) {
              LOGGER.info(
                `Axis changed to ${axisState}, call notify buttonCallback`
              );
              const buttonCallbackProps: ButtonCallbackProps = {
                gamepadId: gamepad.id,
                type: "axis",
                code: code,
                value: axis
              };
              LOGGER.debug({ buttonCallbackProps });
              buttonCallback(buttonCallbackProps);
            }
          };

          processAxisChange(-1, this.buttonCallback);
          processAxisChange(1, this.buttonCallback);
        }

        LOGGER.info("Process button changes for all buttons on the gamepad");
        for (let code = 0; code < buttons.length; code++) {
          const button = buttons[code];
          const previousButton = previousButtons[code];
          LOGGER.debug(`Gamepad Button: ${button}`);
          LOGGER.debug(`Prior button state: ${previousButton}`);

          if (button.pressed && !previousButton.pressed) {
            LOGGER.info(`button: ${button} has been pressed`);
            const buttonCallbackProps: ButtonCallbackProps = {
              gamepadId: gamepad.id,
              type: "button",
              code: code
            };
            LOGGER.debug(`buttonCallbackProps: ${buttonCallbackProps}`);
            this.buttonCallback(buttonCallbackProps);
          }
        }
      } else if (this.gamepadConfig) {
        LOGGER.info("No buttonCallback, but yes gamepadConfig");
        let playerNumber = this._getPlayerNumberFromGamepad(gamepad);
        LOGGER.debug(`player number: ${playerNumber}`);
        if (usedPlayers.length < 2) {
          LOGGER.info("Adding player gamepad");
          if (usedPlayers.indexOf(playerNumber) !== -1) {
            LOGGER.info("New player");
            playerNumber++;
            if (playerNumber > 2) playerNumber = 1;
          }
          usedPlayers.push(playerNumber);

          if (this.gamepadConfig.configs[gamepad.id]) {
            LOGGER.info(`Gamepad ${gamepad.id} is configured`);
            const configButtons = this.gamepadConfig.configs[gamepad.id]
              .buttons;
            LOGGER.debug(`configButtons: ${configButtons}`);

            LOGGER.info("Process button presses");
            for (let i = 0; i < configButtons.length; i++) {
              const configButton = configButtons[i];
              const playerControllerKey = playerNumber as ControllerKey;
              if (configButton.type === "button") {
                const code = configButton.code;
                const button = buttons[code];
                const previousButton = previousButtons[code];

                if (button.pressed && !previousButton.pressed) {
                  LOGGER.debug(
                    `Button ${button} has been pressed, notify onButtonDown`
                  );
                  this.onButtonDown(playerControllerKey, configButton.buttonId);
                } else if (!button.pressed && previousButton.pressed) {
                  LOGGER.debug(
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
                  LOGGER.info(
                    `axis: ${axis} is being pressed, notify onButtonDown`
                  );
                  this.onButtonDown(playerControllerKey, configButton.buttonId);
                }

                if (
                  axis !== configButton.value &&
                  previousAxis === configButton.value
                ) {
                  LOGGER.info(
                    `axis: ${axis} has been released, notify onButtonUp`
                  );
                  this.onButtonUp(playerControllerKey, configButton.buttonId);
                }
              }
            }
          }
        }
      }

      LOGGER.info("Update the state of the gamepad after processing");
      this.gamepadState[gamepadIndex] = {
        buttons: buttons.map(b => Object.assign({}, b)),
        axes: gamepad.axes.slice(0)
      };
    }
  };

  /**
   * Used for binding gamepad buttons to a callback for the button
   * @param buttonDownHandler
   */
  promptButton: PromptButtonHandler = (
    buttonDownHandler: ((buttonInfo: ButtonCallbackProps) => void) | null
  ) => {
    LOGGER.debug("Gamepad promptButton");
    LOGGER.debug(buttonDownHandler);
    if (!buttonDownHandler) {
      LOGGER.info("Clear buttonCallback");
      this.buttonCallback = buttonDownHandler;
    } else {
      LOGGER.info("Set buttonCallback");
      this.buttonCallback = (buttonInfo: ButtonCallbackProps) => {
        this.buttonCallback = null;
        buttonDownHandler(buttonInfo);
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

  startPolling = (): StartPollingResult => {
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
