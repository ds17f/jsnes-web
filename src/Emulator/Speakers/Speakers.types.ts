export type BufferUnderrunHandler = (
  samplesInBuffer: number,
  totalRequiredBytes: number
) => void;

export interface SpeakerProps {
  onBufferUnderrun: BufferUnderrunHandler;
}

