import React, { Component, MouseEventHandler } from "react";
import "./Screen.css";
import { FrameBuffer } from "./FrameBuffer";

import { getLogger } from "../../utils";
const LOGGER = getLogger("Screen");

/** Width of the emulated screen (nes width is 256 pixels */
const SCREEN_WIDTH = 256;
/** Height of the emulated screen (nes height is 240 pixels */
const SCREEN_HEIGHT = 240;

/**
 * Props for the Screen
 */
interface ScreenProps {
  /** Handles a click on the canvas, x/y are the coordinates respective to the emulated screen */
  onMouseDown: (x: number, y: number) => void;
  /** Handle a mouse up on the screen */
  onMouseUp: () => void;
}

/**
 * @summary Renders an HTMLCanvas and handles buffering and writing image data to that canvas
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Typed_arrays#working_with_complex_data_structures
 */
export class Screen extends Component<ScreenProps> {
  private canvas?: HTMLCanvasElement;
  private canvasContext?: CanvasRenderingContext2D | null;
  private imageData?: ImageData;
  private frameBuffer?: FrameBuffer;

  render() {
    return (
      <canvas
        className="Screen"
        width={SCREEN_WIDTH}
        height={SCREEN_HEIGHT}
        onMouseDown={this.handleMouseDown}
        onMouseUp={this.props.onMouseUp}
        ref={(canvas: HTMLCanvasElement) => {
          this.canvas = canvas;
        }}
      />
    );
  }

  componentDidMount() {
    this.initCanvas();
  }

  componentDidUpdate() {
    this.initCanvas();
  }

  /**
   * @summary Write pixel data to the FrameBuffer
   *
   * Adds an alpha channel to the pixel data for each pixel and writes to the frame buffer.
   * The buffer should contain pixel data as integers, each representing BGR data
   *
   * @see https://stackoverflow.com/questions/367449/what-exactly-is-bgr-color-space
   * @see https://stackoverflow.com/questions/39213661/canvas-using-uint32array-wrong-colors-are-being-rendered
   * @see https://www.chromium.org/developers/design-documents/graphics-and-skia/  (search for RGBA)
   *
   * @param buffer one frame of image data with an integer in each position representing a single pixel for the screen. Integer should be 24-bit BGR data.
   */
  writeToFrameBuffer = (buffer: Buffer) => {
    if (!this.frameBuffer) {
      throw Error("Cannot write to FrameBuffer: not initialized");
    }

    LOGGER.trace("Convert pixel from NES BGR to canvas ABGR");
    const totalPixels = SCREEN_HEIGHT * SCREEN_WIDTH; // 61440
    for (let i = 0; i < totalPixels; i++) {
      // Add the alpha channel to the pixels coming from the buffer
      this.frameBuffer.buf32[i] = 0xff000000 | buffer[i]; // Full alpha
    }
  };

  /**
   * Resize the canvas to fit in the parent while maintaining the screen's aspect ratio
   */
  fitInParent = () => {
    const parent = this.canvas?.parentElement;
    if (!parent) {
      LOGGER.info("Cannot fit in parent: Canvas doesn't have a parent Element");
      return;
    }
    const parentWidth = parent.clientWidth;
    const parentHeight = parent.clientHeight;
    const parentRatio = parentWidth / parentHeight;
    const desiredRatio = SCREEN_WIDTH / SCREEN_HEIGHT;
    LOGGER.debug({ parentWidth, parentHeight, parentRatio, desiredRatio });

    if (desiredRatio < parentRatio) {
      LOGGER.info("Resize width to fit ratio");
      this.canvas!.style.width = `${Math.round(parentHeight * desiredRatio)}px`;
      this.canvas!.style.height = `${parentHeight}px`;
    } else {
      LOGGER.info("Resize height to fit ratio");
      this.canvas!.style.width = `${parentWidth}px`;
      this.canvas!.style.height = `${Math.round(parentWidth / desiredRatio)}px`;
    }
  };

  /**
   * Capture a PNG from the current canvas
   */
  screenshot() {
    LOGGER.info("Take screenshot");
    const img = new Image();
    img.src = this.canvas!.toDataURL("image/png");
    return img;
  }

  /**
   * Write the buffer to the canvas as imageData
   */
  flushFrameBufferToCanvas = () => {
    if (!this.frameBuffer) {
      throw Error("Cannot flush FrameBuffer: not initialized");
    }
    LOGGER.trace("Write image buffer to canvas");
    this.imageData!.data.set(this.frameBuffer.buf8);
    this.canvasContext!.putImageData(this.imageData!, 0, 0);
  };

  /**
   * Gets the ImageData from the CanvasContext for the entire canvas
   *
   * @param canvasContext
   */
  private getFullCanvasImageData = (
    canvasContext: CanvasRenderingContext2D
  ): ImageData => {
    const imageData = canvasContext.getImageData(
      0,
      0,
      SCREEN_WIDTH,
      SCREEN_HEIGHT
    );
    LOGGER.debug(`imageData: ${imageData}`);
    if (!imageData) {
      throw Error(`No imageData found`);
    }
    return imageData;
  };

  /**
   * Initialize a 2D context for the canvas and blank it out
   * @param canvas
   */
  private getBlankCanvasContext(
    canvas: HTMLCanvasElement
  ): CanvasRenderingContext2D {
    const canvasContext = canvas.getContext("2d");
    if (!canvasContext) {
      throw Error("No Canvas Context found");
    }

    LOGGER.info("Set blank canvas to be opaque and black");
    // set alpha to opaque
    canvasContext.globalAlpha = 1.0;
    // fill black
    canvasContext.fillStyle = "black";
    canvasContext.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    return canvasContext;
  }

  /**
   * Initialize the canvas and the frame buffer
   * @private
   */
  private initCanvas() {
    LOGGER.info("Initializing Canvas");
    LOGGER.debug(`canvas: ${this.canvas}`);
    if (!this.canvas) {
      throw Error("No Canvas found");
    }

    // Get a new 2d context which is initialized to blank
    this.canvasContext = this.getBlankCanvasContext(this.canvas);

    // Get the image data and store it to as a member var
    // we'll use it to write back to the canvas later
    this.imageData = this.getFullCanvasImageData(this.canvasContext);

    // Create the frame buffer for buffering image data bound for the canvas
    this.frameBuffer = new FrameBuffer(this.imageData.data.length);
  }

  /**
   * Translates the clicked location into an x/y coordinate in the emulated screen
   * and passes that to props.onMouseDown
   * @param e
   */
  private handleMouseDown: MouseEventHandler<HTMLCanvasElement> = (e) => {
    if (!this.props.onMouseDown) {
      LOGGER.info("No mouse down event defined");
      return;
    }

    // Make coordinates unscaled
    LOGGER.info("Translate screen click to canvas/emulator location");
    const scale = SCREEN_WIDTH / parseFloat(this.canvas!.style.width);
    const rect = this.canvas!.getBoundingClientRect();
    const x = Math.round((e.clientX - rect.left) * scale);
    const y = Math.round((e.clientY - rect.top) * scale);
    LOGGER.debug(`screenX: ${e.clientX}, screenY: ${e.clientY}`);
    LOGGER.debug(`canvasX: ${x}, canvasY: ${y}`);

    LOGGER.info("Notify onMouseDown handler of canvas coordinates");
    this.props.onMouseDown(x, y);
  };
}
