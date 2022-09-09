import { RingBuffer } from "ring-buffer-ts";
import { handleError, getLogger } from "../../utils";

const LOGGER = getLogger("Speakers");

type BufferUnderRunHandler = (actualSize: number, desiredSize: number) => void;

interface SpeakerProps {
  onBufferUnderRun: BufferUnderRunHandler;
}

export class Speakers {
  private readonly bufferCapacity: number;
  private readonly onBufferUnderrun: BufferUnderRunHandler;
  private readonly buffer: RingBuffer<number>;
  private audioCtx?: AudioContext | null;
  private scriptNode?: ScriptProcessorNode | null;

  constructor(props: SpeakerProps) {
    this.onBufferUnderrun = props.onBufferUnderRun;
    this.bufferCapacity = 8192;
    this.buffer = new RingBuffer(this.bufferCapacity * 2);
  }

  /**
   * Returns the amount of the buffer that is used
   */
  public get bufferSize(): number {
    return this.buffer.getBufferLength();
  }

  getSampleRate() {
    if (!window.AudioContext) {
      return 44100;
    }
    const myCtx = new window.AudioContext();
    const sampleRate = myCtx.sampleRate;
    myCtx.close();
    return sampleRate;
  }

  start() {
    // Audio is not supported
    if (!window.AudioContext) {
      LOGGER.info("No AudioContext, Audio is not supported");
      return;
    }
    this.audioCtx = new window.AudioContext();
    this.scriptNode = this.audioCtx.createScriptProcessor(1024, 0, 2);
    this.scriptNode.onaudioprocess = this.onaudioprocess;
    this.scriptNode.connect(this.audioCtx.destination);
  }

  stop() {
    if (this.scriptNode) {
      this.audioCtx &&
        this.audioCtx.destination &&
        this.scriptNode.disconnect(this.audioCtx.destination);
      this.scriptNode.onaudioprocess = null;
      this.scriptNode = null;
    }
    if (this.audioCtx) {
      this.audioCtx.close().catch(handleError);
      this.audioCtx = null;
    }
  }

  writeSample = (left: number, right: number) => {
    if (this.buffer.getBufferLength() / 2 >= this.bufferCapacity) {
      LOGGER.trace("Buffer overrun");
      this.buffer.remove(0, this.bufferCapacity / 2);
    }
    this.buffer.add(left);
    this.buffer.add(right);
  };

  onaudioprocess = (e: AudioProcessingEvent) => {
    const left = e.outputBuffer.getChannelData(0);
    const right = e.outputBuffer.getChannelData(1);
    const size = left.length;

    // We're going to buffer underrun. Attempt to fill the buffer.
    if (this.buffer.getBufferLength() < size * 2 && this.onBufferUnderrun) {
      this.onBufferUnderrun(this.buffer.getBufferLength(), size * 2);
    }

    let samples;
    try {
      samples = this.buffer.remove(0, size * 2);
    } catch (e) {
      // onBufferUnderrun failed to fill the buffer, so handle a real buffer
      // underrun

      // ignore empty buffers... assume audio has just stopped
      const bufferSize = this.buffer.getBufferLength() / 2;
      if (bufferSize > 0) {
        LOGGER.debug(`Buffer underrun (needed ${size}, got ${bufferSize})`);
      }
      for (let j = 0; j < size; j++) {
        left[j] = 0;
        right[j] = 0;
      }
      return;
    }
    for (let i = 0; i < size; i++) {
      left[i] = samples[i * 2];
      right[i] = samples[i * 2 + 1];
    }
  };
}
