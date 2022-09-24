/**
 * A FrameBuffer for storing binary image data to be written to a Canvas 2d context.
 * Exposes two views of the buffer:
 *   - an array of 8-bit unsigned integers
 *   - an array of 32-bit unsigned integers
 * The 8-bit array is used to set every color of every pixel individually
 * The 32-bit array is used to view each pixel collectively (as ABGR data)
 */
export class FrameBuffer {
  /** A view of the buffer as an 8-bit array is used to set every color of every pixel individually */
  public readonly buf8: Uint8ClampedArray;
  /** A view of the bugger as a 32-bit array is used to view each pixel collectively (as ABGR data) */
  public readonly buf32: Uint32Array;

  constructor(bufferLength: number) {
    const imageBuffer = new ArrayBuffer(bufferLength);
    this.buf8 = new Uint8ClampedArray(imageBuffer);
    this.buf32 = new Uint32Array(imageBuffer);

    this.blankOutBuffer();
  }

  /**
   * Initialize the buffer with alpha set to full and black for all pixels
   */
  blankOutBuffer() {
    for (let i = 0; i < this.buf32.length; ++i) {
      this.buf32[i] = 0xff000000;
    }
  }
}

