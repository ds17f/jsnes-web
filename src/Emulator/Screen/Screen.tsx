import React, { Component, MouseEventHandler } from "react";
import "./Screen.css";

import { getLogger } from "../../utils";
const LOGGER = getLogger("Screen");

const SCREEN_WIDTH: number = 256;
const SCREEN_HEIGHT: number = 240;

interface ScreenProps {
  onGenerateFrame: () => void;
  onMouseDown: (x: number, y: number) => void;
  onMouseUp: () => void;
}

export class Screen extends Component<ScreenProps> {
  private canvas?: HTMLCanvasElement;
  private canvasContext?: CanvasRenderingContext2D | null;
  private imageData?: ImageData;
  /** Canvas buffer to write on next animation frame */
  private buf?: ArrayBuffer;
  /** Canvas Buffer in 8 bit */
  private buf8?: Uint8ClampedArray;
  /** Canvas Buffer in 32 bit */
  private buf32?: Uint32Array;

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

  initCanvas() {
    LOGGER.info("Initializing Canvas");
    this.canvasContext = this.canvas?.getContext("2d");
    this.imageData = this.canvasContext?.getImageData(
      0,
      0,
      SCREEN_WIDTH,
      SCREEN_HEIGHT
    );
    LOGGER.debug(`canvas: ${this.canvas}`);
    LOGGER.debug(`imageData: ${this.imageData}`);
    if (!this.canvasContext || !this.imageData) {
      LOGGER.info(`Missing canvasContext or imageData`);
      return;
    }

    LOGGER.info("Black out Canvas");
    this.canvasContext.fillStyle = "black";
    // set alpha to opaque
    this.canvasContext.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    // buffer to write on next animation frame
    this.buf = new ArrayBuffer(this.imageData.data.length);
    // Get the canvas buffer in 8bit and 32bit
    this.buf8 = new Uint8ClampedArray(this.buf);
    this.buf32 = new Uint32Array(this.buf);

    LOGGER.info("Initialize alpha");
    // Set alpha
    for (let i = 0; i < this.buf32.length; ++i) {
      this.buf32[i] = 0xff000000;
    }
  }

  /**
   * Convert the NES BGR (little endian RGB) pixel data to the HTML Canvas's ABGR (RGBA little endian)
   * @param buffer
   */
  setBuffer = (buffer: Buffer) => {
    let i = 0;
    LOGGER.trace("Convert pixel from NES BGR to canvas ABGR");
    for (let y = 0; y < SCREEN_HEIGHT; ++y) {
      for (let x = 0; x < SCREEN_WIDTH; ++x) {
        i = y * 256 + x;
        // Convert pixel from NES BGR to canvas ABGR
        LOGGER.trace(`x: ${x}, y: ${y}: ${buffer[i]}`);
        this.buf32![i] = 0xff000000 | buffer[i]; // Full alpha
      }
    }
  };

  /**
   * Write the buffer to the canvas as imageData
   */
  writeBuffer = () => {
    LOGGER.trace("Write image buffer to canvas");
    this.imageData!.data.set(this.buf8!);
    this.canvasContext!.putImageData(this.imageData!, 0, 0);
  };

  fitInParent = () => {
    let parent = this.canvas!.parentElement;
    if (!parent) {
      LOGGER.info("Cannot fit in parent: Canvas doesn't have a parent Element");
      return;
    }
    let parentWidth = parent.clientWidth;
    let parentHeight = parent.clientHeight;
    let parentRatio = parentWidth / parentHeight;
    let desiredRatio = SCREEN_WIDTH / SCREEN_HEIGHT;
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

  screenshot() {
    LOGGER.info("Take screenshot");
    const img = new Image();
    img.src = this.canvas!.toDataURL("image/png");
    return img;
  }

  handleMouseDown: MouseEventHandler<HTMLCanvasElement> = e => {
    if (!this.props.onMouseDown) {
      LOGGER.info("No mouse down event defined");
      return;
    }

    // Make coordinates unscaled
    LOGGER.info("Translate screen click to canvas/emulator location");
    let scale = SCREEN_WIDTH / parseFloat(this.canvas!.style.width);
    let rect = this.canvas!.getBoundingClientRect();
    let x = Math.round((e.clientX - rect.left) * scale);
    let y = Math.round((e.clientY - rect.top) * scale);
    LOGGER.debug(`screenX: ${e.clientX}, screenY: ${e.clientY}`);
    LOGGER.debug(`canvasX: ${x}, canvasY: ${y}`);

    LOGGER.info("Notify onMouseDown handler of canvas coordinates");
    this.props.onMouseDown(x, y);
  };
}
