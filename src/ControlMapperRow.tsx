import React, { Component } from "react";
import {
  GamepadButtonConfig,
  NesGamepadButton,
  Gamepads
} from "./GamepadController";

interface ControlMapperRowProps {
  buttonName: string;
  keys: any;
  button: number; // Controller buttons are numbers: https://github.com/bfirsh/jsnes/blob/667d169fa046460317885fca6fcb1cac89e0a4fe/src/controller.js#L8-L15
  prevButton: number;
  currentPromptButton: number;
  gamepadConfig: Gamepads;
  handleClick: any;
}

interface ControlMapperRowState {
  playerOneButton?: string;
  playerTwoButton?: string;
  waitingForKey?: number;
}

class ControlMapperRow extends Component<
  ControlMapperRowProps,
  ControlMapperRowState
> {
  constructor(props: ControlMapperRowProps) {
    super(props);
    this.state = {
      playerOneButton: "",
      playerTwoButton: "",
      waitingForKey: 0
    };
    this.handleClick = this.handleClick.bind(this);
  }

  componentDidMount() {
    const keys = this.props.keys;
    const button = this.props.button;
    const playerButtons = [];
    for (const key in keys) {
      if (keys[key][0] === 1 && keys[key][1] === button) {
        playerButtons[0] = keys[key][2];
        console.log(playerButtons[0]);
      } else if (keys[key][0] === 2 && keys[key][1] === button) {
        playerButtons[1] = keys[key][2];
      }
    }
    this.setState({
      playerOneButton: playerButtons[0],
      playerTwoButton: playerButtons[1]
    });
  }

  componentDidUpdate(
    prevProps: Readonly<ControlMapperRowProps>,
    prevState: Readonly<ControlMapperRowState>
  ) {
    const keys = this.props.keys;
    const button = this.props.button;
    const playerButtons = [];
    let gamepadButton;
    let newButton;

    for (const key in keys) {
      if (keys[key][0] === 1 && keys[key][1] === button) {
        playerButtons[0] = keys[key][2];
        console.log(playerButtons[0]);
      } else if (keys[key][0] === 2 && keys[key][1] === button) {
        playerButtons[1] = keys[key][2];
      }
    }

    const searchButton = (
      gamepadConfig: GamepadButtonConfig,
      buttonId: number
    ) => {
      return gamepadConfig.buttons.filter(b => b.buttonId === buttonId)[0];
    };

    const searchNewButton = (
      prevGamepadConfig: GamepadButtonConfig,
      gamepadConfig: GamepadButtonConfig
    ) => {
      return gamepadConfig.buttons.filter(b => {
        return (
          !prevGamepadConfig ||
          !prevGamepadConfig.buttons.some(b2 => b2.buttonId === b.buttonId)
        );
      })[0];
    };

    let waitingForKey = 0;
    let waitingForKeyPlayer = 0;

    const gamepadButtonName = (
      gamepadButton: NesGamepadButton
    ): string | undefined => {
      if (gamepadButton.type === "button") return "Btn-" + gamepadButton.code;
      if (gamepadButton.type === "axis")
        return "Axis-" + gamepadButton.code + " " + gamepadButton.value;
    };

    if (this.props.gamepadConfig && this.props.gamepadConfig.playerGamepadId) {
      const playerGamepadId = this.props.gamepadConfig.playerGamepadId;
      if (playerGamepadId[0]) {
        playerButtons[0] = "";
        gamepadButton = searchButton(
          this.props.gamepadConfig.configs[playerGamepadId[0]],
          button
        );
        newButton = searchNewButton(
          prevProps.gamepadConfig.configs[playerGamepadId[0]],
          this.props.gamepadConfig.configs[playerGamepadId[0]]
        );
        if (gamepadButton) {
          playerButtons[0] = gamepadButtonName(gamepadButton);
        } else {
          if (newButton && newButton.buttonId === this.props.prevButton) {
            if (!waitingForKey) {
              waitingForKey = 1;
              waitingForKeyPlayer = 1;
            }
          }
        }
      }

      if (playerGamepadId[1]) {
        playerButtons[1] = "";
        gamepadButton = searchButton(
          this.props.gamepadConfig.configs[playerGamepadId[1]],
          button
        );
        newButton = searchNewButton(
          prevProps.gamepadConfig.configs[playerGamepadId[1]],
          this.props.gamepadConfig.configs[playerGamepadId[1]]
        );
        if (gamepadButton) {
          playerButtons[1] = gamepadButtonName(gamepadButton);
        } else {
          if (newButton && newButton.buttonId === this.props.prevButton) {
            if (!waitingForKey) {
              waitingForKey = 2;
              waitingForKeyPlayer = 2;
            }
          }
        }
      }
    }

    const newState: ControlMapperRowState = {};

    if (waitingForKey) {
      this.props.handleClick([waitingForKeyPlayer, this.props.button]);
    }
    // Prevent setState being called repeatedly
    if (
      prevState.playerOneButton !== playerButtons[0] ||
      prevState.playerTwoButton !== playerButtons[1]
    ) {
      newState.playerOneButton = playerButtons[0];
      newState.playerTwoButton = playerButtons[1];
    }

    if (waitingForKey) {
      newState.waitingForKey = waitingForKey;
    } else if (prevState.waitingForKey === 1) {
      if (this.props.currentPromptButton !== this.props.button) {
        newState.waitingForKey = 0;
      }
    } else if (prevState.waitingForKey === 2) {
      if (this.props.currentPromptButton !== this.props.button) {
        newState.waitingForKey = 0;
      }
    }

    if (Object.keys(newState).length > 0) {
      this.setState(newState);
    }
  }

  handleClick(player: number) {
    this.props.handleClick([player, this.props.button]);
    this.setState({
      waitingForKey: player
    });
  }

  render() {
    const waitingText = "Press key or button...";
    return (
      <tr>
        <td>{this.props.buttonName}</td>
        <td onClick={() => this.handleClick(1)}>
          {this.state.waitingForKey === 1
            ? waitingText
            : this.state.playerOneButton}
        </td>
        <td onClick={() => this.handleClick(2)}>
          {this.state.waitingForKey === 2
            ? waitingText
            : this.state.playerTwoButton}
        </td>
      </tr>
    );
  }
}

export default ControlMapperRow;
