import { getLogger } from "../../utils";
import { GenerateFrameHandler, WriteFrameHandler } from "./FrameTimer.types";
const LOGGER = getLogger("FrameTimer");

/** The default frame rate for the emulator */
const DEFAULT_FRAMES_PER_SECOND = 60.098;

/**
 * Props for FrameTimer
 */
interface FrameTimerProps {
  /**
   * Event raised when it is time to generate another frame
   */
  onGenerateFrame: GenerateFrameHandler;
  /**
   * Event raised when it's time to write a frame to the screen
   */
  onWriteFrame: WriteFrameHandler;
  /**
   * The frame rate
   */
  frameRateInSeconds?: number;
}

/**
 * FrameTimer requests animation frames from the browser and determines if
 * the interval between requests is fast enough to satisfy the frameRateInSeconds.
 * If it is not, additional frames are rendered but display is skipped.  Only
 * the latest rendered frame will be displayed.
 */
export class FrameTimer {
  private readonly onGenerateFrame: GenerateFrameHandler;
  private readonly onWriteFrame: WriteFrameHandler;

  /** The interval in milliseconds that it should take to generate a single frame */
  private readonly interval: number;
  /** Tracks the current request of the browser's animation routine so that we can stop it on shutdown */
  private requestId?: number;

  /** True when the frame timer is running */
  private running: boolean;
  /** The time, in milli since epoch, that the last frame was generated. */
  private lastFrameTime: number;

  constructor(props: FrameTimerProps) {
    // Run at 60 FPS by default
    const frameRate = props.frameRateInSeconds || DEFAULT_FRAMES_PER_SECOND;
    // 1000 / 60 == 16.667 == the number of milliseconds to generate a single frame
    this.interval = 1e3 / frameRate;
    // Since it's the first run, we don't have a last frame, so previous time is 0
    this.lastFrameTime = 0;

    // setup handlers
    this.onGenerateFrame = props.onGenerateFrame;
    this.onWriteFrame = props.onWriteFrame;
    this.onAnimationFrame = this.onAnimationFrame.bind(this);

    // TODO: should this actually be set here?  Or should we wait until start()
    this.running = true;
  }

  /**
   * Startup the frame timer and request the first animation frame
   */
  start() {
    this.running = true;
    this.requestAnimationFrame();
  }

  /**
   * Request a frame from the browser and provide the onAnimationFrame callback
   */
  requestAnimationFrame() {
    this.requestId = window.requestAnimationFrame(this.onAnimationFrame);
  }

  /**
   * Handler for window.requestAnimationFrame
   *
   * Each time a frame is ready to be rendered we need to:
   * - Ask for the next frame
   * - Figure out how much time has passed between the last and current frame
   * - Write the most current frame (by raising the onWriteFrame event)
   * - Determine if there were frames that needed to be skipped because too much time has passed
   * - Skip any frames that need to be skipped and set the nextFrameTime to after the skipped frames
   *
   * @param time - Current time based on number of milliseconds since epoch
   */
  onAnimationFrame: FrameRequestCallback = (time: DOMHighResTimeStamp) => {
    // Request the next animation frame to keep things moving
    // we'll process this frame while we wait for the next callback
    this.requestAnimationFrame();

    // figure out how far past the interval we have gone
    // this is used to figure out where we should be (newFrameTime)
    // and where the next frame will be (timeToNextFrame)
    let excess = time % this.interval;

    // newFrameTime is the current time aligned to 60fps intervals.
    // i.e. 16.6, 33.3, etc ...
    let newFrameTime = time - excess;

    // we haven't rendered a frame ever
    if (!this.lastFrameTime) {
      this.lastFrameTime = newFrameTime;
      return;
    }

    // how many frames have passed since the last frame we rendered
    let numFrames = Math.round(
      (newFrameTime - this.lastFrameTime) / this.interval
    );

    // This can happen a lot on a 144Hz display
    if (numFrames === 0) {
      LOGGER.trace("WOAH, no frames");
      return;
    }

    // no matter what numFrames is, we'll only write the first one for this interval
    this.generateFrame();
    this.onWriteFrame();

    // we rendered 1, so we need to skip the others (if they exist)
    if (numFrames > 1) {
      const numberToSkip = numFrames - 1;
      const timeToNextFrame = this.interval - excess;
      this.skipFrames(numberToSkip, this.lastFrameTime, timeToNextFrame);
    }
  };

  /**
   * Skips a number of frames by rendering them evenly across the timeToNextFrame
   * @param numberToSkip Number of frames to skip
   * @param lastFrameTime The time of the last successfully rendered frame
   * @param timeToNextFrame How long we have to skip those frames
   */
  skipFrames(
    numberToSkip: number,
    lastFrameTime: number,
    timeToNextFrame: number
  ) {
    // we generate additional frames evenly before the next
    // onAnimationFrame call.
    // additional frames are generated but not displayed
    // until next frame draw
    for (let i = 0; i < numberToSkip; i++) {
      setTimeout(() => {
        // generate the frame, but we aren't going to display it
        this.generateFrame();
      }, (i * timeToNextFrame) / (numberToSkip + 1));
    }
    // if we had more than 1 frame then we have to skip frames
    // so let's log that we're doing this (numFrames - 1 because we did render 1)
    if (numberToSkip) {
      LOGGER.trace("SKIP", numberToSkip, lastFrameTime);
    }
  }

  /**
   * Raises the onGenerateFrame event and updates the lastFrameTime
   */
  generateFrame() {
    this.onGenerateFrame();
    this.lastFrameTime += this.interval;
  }

  /**
   * Shut down the frame timer and cancel any requested animations
   */
  stop() {
    this.running = false;
    if (this.requestId) {
      window.cancelAnimationFrame(this.requestId);
    }
    this.lastFrameTime = 0;
  }
}
