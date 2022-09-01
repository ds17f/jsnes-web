import React, { Component, MouseEventHandler } from "react";
import {
  Button,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Table
} from "reactstrap";
import { ButtonKey, Controller, ControllerKey } from "jsnes";
import { ControlMapperRow } from "../ControlMapperRow";
import {
  ButtonCallback,
  ButtonCallbackProps,
  GamepadConfig,
  Gamepads,
  NesGamepadButton,
  PromptButtonHandler
} from "../Emulator";
import { KeyboardMapping } from "../Emulator";
import { getLogger } from "../utils";

const LOGGER = getLogger("ControlsModal");

const GAMEPAD_ICON = "../img/nes_controller.png";
const KEYBOARD_ICON = "../img/keyboard.png";

export interface ControlsModalProps {
  gamepadConfig: Gamepads;
  keys: KeyboardMapping;
  setKeys: (keys: KeyboardMapping) => void;
  setGamepadConfig: (gamepadConfig: Gamepads) => void;
  promptButton: PromptButtonHandler;
  isOpen?: boolean;
  toggle?: MouseEventHandler<HTMLButtonElement>;
}

export interface ControlsModalState {
  gamepadConfig: Gamepads;
  keys: KeyboardMapping;
  modified: boolean;
  currentPromptButton?: number;
  controllerIcon?: string[];
  controllerIconAlt?: string[];
  button?: [ControllerKey, ButtonKey];
}

export class ControlsModal extends Component<
  ControlsModalProps,
  ControlsModalState
> {
  constructor(props: ControlsModalProps) {
    super(props);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleGamepadButtonDown = this.handleGamepadButtonDown.bind(this);
    this.listenForKey = this.listenForKey.bind(this);

    LOGGER.info("initialize gamepad with defaults");
    const gamepadConfig = this.props.gamepadConfig || {};
    gamepadConfig.playerGamepadId = this.props.gamepadConfig
      .playerGamepadId || [null, null];
    gamepadConfig.configs = this.props.gamepadConfig.configs || {};
    LOGGER.info("initialize icons");
    const controllerIcon = this.props.gamepadConfig.playerGamepadId.map(
      gamepadId => (gamepadId ? GAMEPAD_ICON : KEYBOARD_ICON)
    );
    const controllerIconAlt = this.props.gamepadConfig.playerGamepadId.map(
      gamepadId => (gamepadId ? "gamepad" : "keyboard")
    );

    LOGGER.info("set initialized state");
    this.state = {
      gamepadConfig,
      controllerIcon,
      controllerIconAlt,
      currentPromptButton: -1,
      keys: props.keys,
      button: undefined,
      modified: false
    };
  }

  componentWillUnmount() {
    if (this.state.modified) {
      this.props.setKeys(this.state.keys);
      this.props.setGamepadConfig(this.state.gamepadConfig);
    }
    this.removeKeyListener();
  }

  /**
   * Listens to a keypress to update the key that's bound to the nes button
   * @param currentPromptController
   * @param currentPromptButton
   */
  listenForKey(
    currentPromptController: ControllerKey,
    currentPromptButton: ButtonKey
  ) {
    // Clear the bound key
    this.removeKeyListener();
    this.setState({
      button: [currentPromptController, currentPromptButton],
      currentPromptButton
    });
    // Load a new key
    this.props.promptButton(this.handleGamepadButtonDown);
    document.addEventListener("keydown", this.handleKeyDown);
  }

  handleGamepadButtonDown: ButtonCallback = (
    buttonInfo: ButtonCallbackProps
  ) => {
    // Clear the key that we are resetting
    this.removeKeyListener();

    const [playerId, buttonId] = this.state.button!;

    const gamepadId = buttonInfo.gamepadId;
    const gamepadConfig = this.state.gamepadConfig;

    // link player to gamepad
    const playerGamepadId = gamepadConfig.playerGamepadId.slice(0);
    const newConfig: GamepadConfig = {};

    playerGamepadId[playerId - 1] = gamepadId;

    const rejectButtonId = (b: NesGamepadButton) => {
      return b.buttonId !== buttonId;
    };

    const newButton: NesGamepadButton = {
      code: buttonInfo.code,
      type: buttonInfo.type,
      buttonId: buttonId as ButtonKey,
      value: buttonInfo.value!
    };
    newConfig[gamepadId] = {
      buttons: (gamepadConfig.configs[gamepadId] || { buttons: [] }).buttons
        .filter(rejectButtonId)
        .concat([newButton])
    };

    const configs = Object.assign({}, gamepadConfig.configs, newConfig);

    this.setState({
      gamepadConfig: {
        configs: configs,
        playerGamepadId: playerGamepadId
      },
      currentPromptButton: -1,
      controllerIcon: playerGamepadId.map(gamepadId =>
        gamepadId ? GAMEPAD_ICON : KEYBOARD_ICON
      ),
      modified: true
    });
  };

  handleKeyDown(event: KeyboardEvent) {
    this.removeKeyListener();

    const button: [ControllerKey, ButtonKey] = this.state.button!;
    const keys = this.state.keys;
    const newKeys: KeyboardMapping = {};
    for (const key in keys) {
      const [controllerKey, buttonKey] = keys[key];
      if (controllerKey !== button[0] || buttonKey !== button[1]) {
        newKeys[key] = keys[key];
      }
    }

    const playerGamepadId = this.state.gamepadConfig.playerGamepadId.slice(0);
    const playerId = button[0];
    playerGamepadId[playerId - 1] = null;

    const [controllerKey, buttonKey] = button;
    const keyDescription =
      event.key.length > 1 ? event.key : String(event.key).toUpperCase();
    this.setState({
      keys: {
        ...newKeys,
        [event.keyCode]: [controllerKey, buttonKey, keyDescription]
      },
      button: undefined,
      gamepadConfig: {
        configs: this.state.gamepadConfig.configs,
        playerGamepadId: playerGamepadId
      },
      currentPromptButton: -1,
      controllerIcon: playerGamepadId.map(gamepadId =>
        gamepadId ? GAMEPAD_ICON : KEYBOARD_ICON
      ),
      controllerIconAlt: playerGamepadId.map(gamepadId =>
        gamepadId ? "gamepad" : "keyboard"
      ),
      modified: true
    });
  }

  /**
   * Remove the listener for the key that was pressed
   * so that we don't send it to the emulator and
   * we can change it
   */
  removeKeyListener() {
    this.props.promptButton(null);
    document.removeEventListener("keydown", this.handleKeyDown);
  }

  render() {
    return (
      <Modal
        isOpen={this.props.isOpen}
        toggle={this.props.toggle}
        className="ControlsModal"
      >
        <ModalHeader toggle={this.props.toggle}>Controls</ModalHeader>
        <ModalBody>
          <Table>
            <thead>
              <tr>
                <th>Button</th>
                <th>
                  Player 1
                  <img
                    className="controller-icon"
                    src={this.state.controllerIcon![0]}
                    alt={this.state.controllerIconAlt![0]}
                  />
                </th>
                <th>
                  Player 2
                  <img
                    className="controller-icon"
                    src={this.state.controllerIcon![1]}
                    alt={this.state.controllerIconAlt![1]}
                  />
                </th>
              </tr>
            </thead>
            <tbody>
              <ControlMapperRow
                buttonName="Left"
                currentPromptButton={this.state.currentPromptButton}
                button={Controller.BUTTON_LEFT}
                prevButton={Controller.BUTTON_SELECT}
                keys={this.state.keys}
                handleClick={this.listenForKey}
                gamepadConfig={this.state.gamepadConfig}
              />
              <ControlMapperRow
                buttonName="Right"
                currentPromptButton={this.state.currentPromptButton}
                button={Controller.BUTTON_RIGHT}
                prevButton={Controller.BUTTON_LEFT}
                keys={this.state.keys}
                handleClick={this.listenForKey}
                gamepadConfig={this.state.gamepadConfig}
              />
              <ControlMapperRow
                buttonName="Up"
                currentPromptButton={this.state.currentPromptButton}
                button={Controller.BUTTON_UP}
                prevButton={Controller.BUTTON_RIGHT}
                keys={this.state.keys}
                handleClick={this.listenForKey}
                gamepadConfig={this.state.gamepadConfig}
              />
              <ControlMapperRow
                buttonName="Down"
                currentPromptButton={this.state.currentPromptButton}
                button={Controller.BUTTON_DOWN}
                prevButton={Controller.BUTTON_UP}
                keys={this.state.keys}
                handleClick={this.listenForKey}
                gamepadConfig={this.state.gamepadConfig}
              />
              <ControlMapperRow
                buttonName="A"
                currentPromptButton={this.state.currentPromptButton}
                button={Controller.BUTTON_A}
                prevButton={Controller.BUTTON_DOWN}
                keys={this.state.keys}
                handleClick={this.listenForKey}
                gamepadConfig={this.state.gamepadConfig}
              />
              <ControlMapperRow
                buttonName="B"
                currentPromptButton={this.state.currentPromptButton}
                button={Controller.BUTTON_B}
                prevButton={Controller.BUTTON_A}
                keys={this.state.keys}
                handleClick={this.listenForKey}
                gamepadConfig={this.state.gamepadConfig}
              />
              <ControlMapperRow
                buttonName="Start"
                currentPromptButton={this.state.currentPromptButton}
                button={Controller.BUTTON_START}
                prevButton={Controller.BUTTON_B}
                keys={this.state.keys}
                handleClick={this.listenForKey}
                gamepadConfig={this.state.gamepadConfig}
              />
              <ControlMapperRow
                buttonName="Select"
                currentPromptButton={this.state.currentPromptButton}
                button={Controller.BUTTON_SELECT}
                prevButton={Controller.BUTTON_START}
                keys={this.state.keys}
                handleClick={this.listenForKey}
                gamepadConfig={this.state.gamepadConfig}
              />
            </tbody>
          </Table>
        </ModalBody>
        <ModalFooter>
          <Button outline color="primary" onClick={this.props.toggle}>
            Close
          </Button>
        </ModalFooter>
      </Modal>
    );
  }
}
