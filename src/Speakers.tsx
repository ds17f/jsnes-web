// @ts-ignore
import RingBuffer from "ringbufferjs"; // TODO: replace with ring-buffer-ts
import { handleError } from "./utils/utils";

import { getLogger } from "./utils/logging";
const LOGGER = getLogger("Speakers");

interface SpeakerProps {
  onBufferUnderrun: any;
}

export default class Speakers {
  private readonly bufferSize: number;
  private readonly onBufferUnderrun: any;
  private readonly buffer: any;
  private audioCtx?: AudioContext | null;
  private scriptNode?: ScriptProcessorNode | null;

  constructor(props: SpeakerProps) {
    this.onBufferUnderrun = props.onBufferUnderrun;
    this.bufferSize = 8192;
    this.buffer = new RingBuffer(this.bufferSize * 2);
  }

  getSampleRate() {
    if (!window.AudioContext) {
      return 44100;
    }
    let myCtx = new window.AudioContext();
    let sampleRate = myCtx.sampleRate;
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
    if (this.buffer.size() / 2 >= this.bufferSize) {
      LOGGER.trace("Buffer overrun");
      this.buffer.deqN(this.bufferSize / 2);
    }
    this.buffer.enq(left);
    this.buffer.enq(right);
  };

  onaudioprocess = (e: AudioProcessingEvent) => {
    const left = e.outputBuffer.getChannelData(0);
    const right = e.outputBuffer.getChannelData(1);
    const size = left.length;

    // We're going to buffer underrun. Attempt to fill the buffer.
    if (this.buffer.size() < size * 2 && this.onBufferUnderrun) {
      this.onBufferUnderrun(this.buffer.size(), size * 2);
    }

    let samples;
    try {
      // TODO, this deq and assigns the samples
      samples = this.buffer.deqN(size * 2);
    } catch (e) {
      // onBufferUnderrun failed to fill the buffer, so handle a real buffer
      // underrun

      // ignore empty buffers... assume audio has just stopped
      const bufferSize = this.buffer.size() / 2;
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
