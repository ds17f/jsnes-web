import Raven from "raven-js";
import React, { Component } from "react";
import { NES } from "jsnes";

import { FrameTimer } from "./FrameTimer";
import { GamepadController, StartPollingResult } from "./GamepadController";
import { KeyboardController } from "./KeyboardController";
import { Screen } from "./Screen";
import { AudioBuffer } from "./Speakers";

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
  private speakers?: AudioBuffer;
  private nes?: NES;
  private frameTimer?: FrameTimer;
  private gamepadPolling?: StartPollingResult;
  private fpsInterval?: NodeJS.Timer;

  constructor(props: EmulatorProps) {
    super(props)
    this.onAudioBufferUnderrun = this.onAudioBufferUnderrun.bind(this)
  }

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

  async componentDidMount() {
    // Initial layout
    this.fitInParent();

    // We need to make the speakers first,
    // so we can use them in the NES
    this.speakers = new AudioBuffer({
      onBufferUnderrun: this.onAudioBufferUnderrun
    });

    // make a dedicated logger to listen to status updates from the NES
    const nesLogger = getLogger("NES")
    this.nes = new NES({
      onFrame: this.screen!.setBuffer,
      onStatusUpdate: nesLogger.debug, // Assume these are debug level messages
      onAudioSample: this.speakers.writeSampleToBuffer,
      sampleRate: this.speakers.sampleRate
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
    await this.start();
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

  /**
   * Handles a buffer underrun event from the Speakers
   *
   *
   * @param samplesInBuffer
   * @param totalRequiredBytes
   */
  onAudioBufferUnderrun(samplesInBuffer: number, totalRequiredBytes: number) {
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
    LOGGER.trace("Buffer underrun, running another frame to try and catch up");

    this.frameTimer!.generateFrame();
    // totalRequiredBytes will be 2048, and the NES produces 1468 samples on each
    // frame so we might need a second frame to be run. Give up after that
    // though -- the system is not catching up
    if (this.speakers!.amountInBuffer < totalRequiredBytes) {
      LOGGER.trace("Still buffer underrun, running a second frame");
      this.frameTimer!.generateFrame();
    }
  }
}
