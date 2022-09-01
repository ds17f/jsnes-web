import Raven from "raven-js";
import React, { Component } from "react";
import { NES } from "jsnes";

import { FrameTimer } from "./FrameTimer";
import { GamepadController, StartPollingResult } from "./GamepadController";
import { KeyboardController } from "./KeyboardController";
import { Screen } from "./Screen";
import { Speakers } from "./Speakers";

import { getLogger } from "../utils";
const LOGGER = getLogger("Emulator");

interface EmulatorProps {
  romData: string;
  paused?: boolean;
}

/*
 * Runs the emulator.
 *
 * The only UI is a canvas element. It assumes it is a singleton in various ways
 * (binds to window, keyboard, speakers, etc).
 */
export class Emulator extends Component<EmulatorProps> {
  public gamepadController?: GamepadController; // TODO: private
  public keyboardController?: KeyboardController; // TODO: private

  private screen?: Screen;
  private speakers?: Speakers;
  private nes?: NES;
  private frameTimer?: FrameTimer;
  private gamepadPolling?: StartPollingResult;
  private fpsInterval?: NodeJS.Timer;

  render() {
    return (
      <Screen
        ref={(screen: Screen) => {
          this.screen = screen;
        }}
        onGenerateFrame={() => {
          this.nes!.frame();
        }}
        onMouseDown={(x, y) => {
          this.nes!.zapperMove(x, y);
          this.nes!.zapperFireDown();
        }}
        onMouseUp={() => {
          this.nes!.zapperFireUp();
        }}
      />
    );
  }

  componentDidMount() {
    // Initial layout
    this.fitInParent();

    this.speakers = new Speakers({
      onBufferUnderRun: (actualSize: number, desiredSize: number) => {
        if (this.props.paused) {
          return;
        }
        // Skip a video frame so audio remains consistent. This happens for
        // a variety of reasons:
        // - Frame rate is not quite 60fps, so sometimes buffer empties
        // - Page is not visible, so requestAnimationFrame doesn't get fired.
        //   In this case emulator still runs at full speed, but timing is
        //   done by audio instead of requestAnimationFrame.
        // - System can't run emulator at full speed. In this case it'll stop
        //    firing requestAnimationFrame.
        LOGGER.trace(
          "Buffer underrun, running another frame to try and catch up"
        );

        this.frameTimer!.generateFrame();
        // desiredSize will be 2048, and the NES produces 1468 samples on each
        // frame so we might need a second frame to be run. Give up after that
        // though -- the system is not catching up
        if (this.speakers!.bufferSize < desiredSize) {
          LOGGER.trace("Still buffer underrun, running a second frame");
          this.frameTimer!.generateFrame();
        }
      }
    });

    this.nes = new NES({
      onFrame: this.screen!.setBuffer,
      onStatusUpdate: LOGGER.info, // TODO: Consider sending a dedicated logger for NES
      onAudioSample: this.speakers.writeSample,
      sampleRate: this.speakers.getSampleRate()
    });

    // @ts-ignore For debugging. (["nes"] instead of .nes to avoid VS Code type errors.)
    window["nes"] = this.nes;

    // Raven returns type Function, but the wrapped functions are the correct types
    // so just cast them down and things should be fine
    this.frameTimer = new FrameTimer({
      onGenerateFrame: Raven.wrap(this.nes.frame) as () => {},
      onWriteFrame: Raven.wrap(this.screen!.writeBuffer) as () => {}
    });

    // Set up gamepad and keyboard
    this.gamepadController = new GamepadController({
      onButtonDown: this.nes.buttonDown,
      onButtonUp: this.nes.buttonUp
    });

    this.gamepadController.loadGamepadConfig();
    this.gamepadPolling = this.gamepadController.startPolling();

    this.keyboardController = new KeyboardController({
      onButtonDown: this.gamepadController.disableIfGamepadEnabled(
        this.nes.buttonDown
      ),
      onButtonUp: this.gamepadController.disableIfGamepadEnabled(
        this.nes.buttonUp
      )
    });

    // Load keys from localStorage (if they exist)
    this.keyboardController.loadKeys();

    document.addEventListener("keydown", this.keyboardController.handleKeyDown);
    document.addEventListener("keyup", this.keyboardController.handleKeyUp);
    document.addEventListener(
      "keypress",
      this.keyboardController.handleKeyPress
    );

    this.nes.loadROM(this.props.romData);
    this.start();
  }

  componentWillUnmount() {
    this.stop();

    // Unbind keyboard
    document.removeEventListener(
      "keydown",
      this.keyboardController!.handleKeyDown
    );
    document.removeEventListener("keyup", this.keyboardController!.handleKeyUp);
    document.removeEventListener(
      "keypress",
      this.keyboardController!.handleKeyPress
    );

    // Stop gamepad
    this.gamepadPolling!.stop();

    // @ts-ignore For debugging. (["nes"] instead of .nes to avoid VS Code type errors.)
    window["nes"] = undefined;
  }

  componentDidUpdate(prevProps: Readonly<EmulatorProps>) {
    if (this.props.paused !== prevProps.paused) {
      if (this.props.paused) {
        this.stop();
      } else {
        this.start();
      }
    }

    // TODO: handle changing romData
  }

  start = () => {
    this.frameTimer!.start();
    this.speakers!.start();
    this.fpsInterval = setInterval(() => {
      LOGGER.trace(`FPS: ${this.nes!.getFPS()}`);
    }, 1000);
  };

  stop = () => {
    this.frameTimer!.stop();
    this.speakers!.stop();
    clearInterval(this.fpsInterval);
  };

  /*
   * Fill parent element with screen. Typically called if parent element changes size.
   */
  fitInParent() {
    this.screen!.fitInParent();
  }
}
