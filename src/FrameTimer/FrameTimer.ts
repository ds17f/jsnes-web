import { getLogger } from "../utils";
const LOGGER = getLogger("FrameTimer");

const FPS = 60.098;

interface FrameTimerProps {
  onGenerateFrame: () => void;
  onWriteFrame: () => void;
}

export class FrameTimer {
  private readonly onGenerateFrame: () => void;
  private readonly onWriteFrame: () => void;
  private readonly interval: number;
  private _requestID?: number;

  private running: boolean;
  private lastFrameTime: number;

  constructor(props: FrameTimerProps) {
    // Run at 60 FPS
    this.onGenerateFrame = props.onGenerateFrame;
    // Run on animation frame
    this.onWriteFrame = props.onWriteFrame;
    this.onAnimationFrame = this.onAnimationFrame.bind(this);
    this.running = true;
    this.interval = 1e3 / FPS;
    this.lastFrameTime = 0; // Was `false` but should be a number, was coerced to 0 anyway
  }

  start() {
    this.running = true;
    this.requestAnimationFrame();
  }

  stop() {
    this.running = false;
    if (this._requestID) {
      window.cancelAnimationFrame(this._requestID);
    }
    this.lastFrameTime = 0; // Was `false` but should be a number, was coerced to 0 anyway
  }

  requestAnimationFrame() {
    this._requestID = window.requestAnimationFrame(this.onAnimationFrame);
  }

  generateFrame() {
    this.onGenerateFrame();
    this.lastFrameTime += this.interval;
  }

  onAnimationFrame = (time: number) => {
    this.requestAnimationFrame();
    // how many ms after 60fps frame time
    let excess = time % this.interval;

    // newFrameTime is the current time aligned to 60fps intervals.
    // i.e. 16.6, 33.3, etc ...
    let newFrameTime = time - excess;

    // first frame, do nothing
    if (!this.lastFrameTime) {
      this.lastFrameTime = newFrameTime;
      return;
    }

    let numFrames = Math.round(
      (newFrameTime - this.lastFrameTime) / this.interval
    );

    // This can happen a lot on a 144Hz display
    if (numFrames === 0) {
      LOGGER.trace("WOAH, no frames");
      return;
    }

    // update display on first frame only
    this.generateFrame();
    this.onWriteFrame();

    // we generate additional frames evenly before the next
    // onAnimationFrame call.
    // additional frames are generated but not displayed
    // until next frame draw
    let timeToNextFrame = this.interval - excess;
    for (let i = 1; i < numFrames; i++) {
      setTimeout(() => {
        this.generateFrame();
      }, (i * timeToNextFrame) / numFrames);
    }
    if (numFrames > 1) {
      LOGGER.trace("SKIP", numFrames - 1, this.lastFrameTime);
    }
  };
}
