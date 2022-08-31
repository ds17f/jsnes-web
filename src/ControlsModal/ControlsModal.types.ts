import { ButtonCallbackProps } from "../GamepadController";

export type PromptButtonHandler = (
  buttonDownHandler: GamepadButtonDownHandler | null
) => void;

export type GamepadButtonDownHandler = (callback: ButtonCallbackProps) => void;
