import { RingBuffer } from "ring-buffer-ts";
import { handleError, getLogger } from "../../utils";
import { BufferUnderrunHandler, SpeakerProps } from "./Speakers.types";

const LOGGER = getLogger("Speakers");

/**
 * The 44.1 kHz sample rate is used for compact disc (CD) audio.
 * CDs provide uncompressed 16-bit stereo sound at 44.1 kHz.
 * Computer audio also frequently uses this frequency by default.
 */
const DEFAULT_SAMPLE_RATE = 44100;

/**
 * Controls how frequently the browser's audioprocess event is
 * dispatched and how many sample-frames need to be processed
 * on each call.
 *
 * A lower number is better (less latency)
 * Set to 0 to allow the browser to decide
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/createScriptProcessor#parameters
 */
const AUDIO_OUTPUT_BUFFER_SIZE = 1024;

/**
 * 2 channels for stereo audio
 */
const NUMBER_OF_AUDIO_CHANNELS = 2;

/**
 * Size of the internal ring buffer
 *
 * Min size would be:
 *  AUDIO_OUTPUT_BUFFER_SIZE * NUMBER_OF_AUDIO_CHANNELS
 * as that is what the audio process event is going to need
 * when it writes the audio to the actual output
 *
 * At minimum, we need to double that number because then we can
 * store the current audio block to write out while also filling
 * the next audio block to write out.  This prevents a buffer overrun
 * in ideal conditions
 *
 * But things aren't always ideal, so double this one more time
 * to provide a large buffer to capture additional samples as we run
 * and reduce the likelihood of a buffer overrun
 *
 * This is set because:
 * 1 channel of audio is 1024
 * 2 channels is 2048
 * 2 full samples is 4096 (this frame and next frame)
 * Double this to create a nice buffer: 8192
 *
 * NOTE: this is my best guess as to why 8192 is chosen
 */
const INPUT_BUFFER_CAPACITY: number =
  AUDIO_OUTPUT_BUFFER_SIZE * NUMBER_OF_AUDIO_CHANNELS * 2 * 2;

/**
 * @summary An audio output buffer which stores samples produced by the emulator and listens for an event from the browser to    send those samples to an actual audio output.
 *
 * On startup, writeBufferToAudioOutput is bound to the browser's
 * onaudioprocess event where it awaits calls from the browser for audio.
 *
 * When the emulator readies a sample it should call writeSampleToBuffer
 * which fills the internal buffer
 *
 * If everything works well, then the buffer should fill slightly faster
 * than it empties and audio runs smoothly.
 *
 * When the emulator isn't running fast enough, not enough samples will
 * be written to the buffer, and an onBufferUnderrun event is fired.
 * Handlers should attempt to put more audio into the buffer to catch up
 *
 * When the browser isn't processing audio fast enough the buffer will
 * overrun.  In that case the existing samples will be purged to make room
 * for the new samples
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/Media/Formats/Audio_concepts
 */
export class AudioBuffer {
  private readonly buffer: RingBuffer<number>;
  private readonly onBufferUnderrun: BufferUnderrunHandler;
  private audioContext?: AudioContext | null;
  private scriptNode?: ScriptProcessorNode | null;

  /** sample rate of the audio context, or undefined if there is no context */
  private _sampleRate?: number;

  /**
   * Create Speakers
   * @param props
   */
  constructor(props: SpeakerProps) {
    this.onBufferUnderrun = props.onBufferUnderrun;
    this.buffer = new RingBuffer(INPUT_BUFFER_CAPACITY * 2);
  }

  /**
   * Returns the amount of the buffer that is used
   */
  public get amountInBuffer(): number {
    return this.buffer.getBufferLength();
  }

  /**
   * Retrieves the sample rate from the audio context
   * or returns the default if there is no context
   */
  public get sampleRate(): number {
    if (!window.AudioContext) {
      return DEFAULT_SAMPLE_RATE;
    }
    if (!this._sampleRate) {
      const myCtx = new window.AudioContext();
      this._sampleRate = myCtx.sampleRate;
      myCtx.close();
    }
    return this._sampleRate;
  }

  /**
   * The total size of the internal ring buffer
   */
  private get bufferCapacity(): number {
    return this.buffer.getSize();
  }


  /**
   * Creates a script processor set to the AUDIO_OUTPUT_BUFFER_SIZE
   * and wires up the audio process event to writeBufferToAudioOutput
   *
   * WARNING: createScriptProcessor is deprecated and should be replaced with an AudioWorklet
   * but there are non-trivial issues when it comes to importing the module
   * https://stackoverflow.com/questions/49972336/audioworklet-error-domexception-the-user-aborted-a-request
   */
  createScriptProcessor() {
    //
    // The current API isn't promised to work in all browsers and should be replaced
    if (!this.audioContext?.createScriptProcessor) {
      LOGGER.info(
        "createScriptProcessor is not available in this browser, Audio is not supported"
      );
      return;
    }

    // create the script processor setting the size of the buffers
    // and the number of channels
    // Then
    this.scriptNode = this.audioContext.createScriptProcessor(
      AUDIO_OUTPUT_BUFFER_SIZE,
      0,
      NUMBER_OF_AUDIO_CHANNELS
    );
    this.scriptNode.onaudioprocess = this.writeBufferToAudioOutput;
    this.scriptNode.connect(this.audioContext.destination);
  }

  /**
   * Connect the audio to the internal buffer and plug that into
   * an actual output destination for audio
   */
  start() {
    // Audio is not supported
    if (!window.AudioContext) {
      LOGGER.info("No AudioContext, Audio is not supported");
      return;
    }
    this.audioContext = new window.AudioContext();

    this.createScriptProcessor();
  }

  /**
   * Shutdown the audioContext and scriptNode
   */
  stop() {
    if (this.scriptNode) {
      // disconnect the audio from the speakers
      this.audioContext?.destination &&
        this.scriptNode.disconnect(this.audioContext.destination);
      // remove the handler
      this.scriptNode.onaudioprocess = null;
      // garbage collect
      this.scriptNode = null;
    }

    // clean up the audio context
    if (this.audioContext) {
      this.audioContext.close().catch(handleError);
      this.audioContext = null;
    }
  }

  /**
   * Writes audio samples to the internal buffer so they can
   * eventually be written to the audio output buffer
   *
   * The left and right samples are written consecutively
   * and can be read as an audio sample frame: n[left, right]
   *
   * If the internal buffer is full, then we have a buffer overrun
   * as there's nowhere to put the new audio.
   * When that happens, throw out the audio at the front of the buffer
   * and write the new samples, this causes stuttering and bad sound
   * so we need to ensure that INPUT_BUFFER_CAPACITY is large enough
   * to prevent this from happening
   *
   * @param left sample for the left audio channel
   * @param right sample for the right audio channel
   */
  writeSampleToBuffer = (left: number, right: number) => {
    if (this.amountInBuffer >= this.bufferCapacity) {
      const removeAmountFromBuffer = INPUT_BUFFER_CAPACITY / 2;
      LOGGER.info(
        `Audio Buffer overrun, dumping ${removeAmountFromBuffer} samples from head of buffer`
      );
      this.buffer.remove(0, removeAmountFromBuffer);
    }
    this.buffer.add(left);
    this.buffer.add(right);
  };

  /**
   * Writes the buffered audio samples to the left and right channel
   * of the audio output buffer when the onaudioprocess event is called
   *
   * If the current buffer isn't big enough to fill the left and right
   * channel, then onBufferUnderrun is raised in an attempt to fill
   * the buffer with enough audio for the frame
   *
   * If after that attempt, the buffer still doesn't have enough
   * audio, then give up and shut down the audio for this frame
   *
   * @param audioProcessingEvent
   */
  writeBufferToAudioOutput = (audioProcessingEvent: AudioProcessingEvent) => {
    const left = audioProcessingEvent.outputBuffer.getChannelData(0);
    const right = audioProcessingEvent.outputBuffer.getChannelData(1);
    const audioChannelSize = left.length; // 1024
    LOGGER.trace({ audioChannelSize });

    // We have 2 channels (left/right) and each is 1024 in size
    // if the amount of audio data in the buffer
    // isn't enough to fill both the left and right channel
    // then we have a buffer underrun condition
    // so we need to fire the event for buffer underrun to try and catch up
    if (this.amountInBuffer < audioChannelSize * 2 && this.onBufferUnderrun) {
      this.onBufferUnderrun(this.amountInBuffer, audioChannelSize * 2);
    }

    // This ring buffer doesn't error when it can't fully return
    // the removed request.  Instead it just returns a subset
    // https://github.com/domske/ring-buffer-ts/blob/master/src/ring-buffer.ts#L118
    //
    // So an underrun condition exists when we ask for 100 samples and only get 99
    const samples = this.buffer.remove(0, audioChannelSize * 2);
    if (samples.length < audioChannelSize * 2) {
      // onBufferUnderrun failed to fill the buffer, so handle a real buffer
      // underrun

      // ignore empty samples... assume audio has just stopped
      if (samples.length === 0) {
        LOGGER.info(
          `Buffer underrun (needed ${audioChannelSize}, got ${samples.length})`
        );
      }

      // send nothing to the left and right channels
      for (let j = 0; j < audioChannelSize; j++) {
        left[j] = 0;
        right[j] = 0;
      }

      return;
    }

    // Write the samples into the left and right channels
    for (let i = 0; i < audioChannelSize; i++) {
      left[i] = samples[i * 2];
      right[i] = samples[i * 2 + 1];
    }
  };
}
