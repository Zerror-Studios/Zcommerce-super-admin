/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/**
 * Voice input in every AI input (owner, 2026-11-25; the mic was a picture since 2026-11-21). `useSpeechInput` runs
 * the browser's speech recognition and writes what is heard into the field as the user speaks (helpers and privacy
 * note in speech-input.ts); `AiMicButton` is the mic that starts and stops it.
 *
 * - Speech is added after what is already typed; the field shows the live guess and settles as phrases finish.
 * - Typing, sending, or the field turning disabled ends listening, so speech never lands on top of an edit.
 * - It keeps listening through pauses until the mic is pressed again (or the browser ends the session).
 */
import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import { cx } from "./cx";
import { IconMic } from "./icons";
import {
  getSpeechRecognition,
  joinSpoken,
  micLabel,
  speechErrorOf,
  speechLang,
  spokenText,
  takeVoiceRequest,
  type SpeechError,
  type SpeechRecognitionLike,
} from "./speech-input";

export interface SpeechInput {
  /** False in browsers without speech recognition (Firefox). */
  supported: boolean;
  listening: boolean;
  error: SpeechError | null;
  start: () => void;
  stop: () => void;
  toggle: () => void;
}

export interface UseSpeechInputOptions {
  value: string;
  onValueChange: (value: string) => void;
  maxLength?: number;
  isDisabled?: boolean;
  /** Start listening on mount when the Ask bar's mic opened this field (requestVoiceOnOpen). */
  takeAskBarRequest?: boolean;
}

export function useSpeechInput({ value, onValueChange, maxLength, isDisabled = false, takeAskBarRequest = false }: UseSpeechInputOptions): SpeechInput {
  const [supported] = useState(() => getSpeechRecognition() !== null);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<SpeechError | null>(null);
  const recognition = useRef<SpeechRecognitionLike | null>(null);
  /** The text this hook last wrote; any other value means the user (or a send) changed the field. */
  const written = useRef<string | null>(null);
  const latest = useRef({ value, onValueChange, maxLength, isDisabled });
  useEffect(() => {
    latest.current = { value, onValueChange, maxLength, isDisabled };
  });

  const stop = useCallback(() => {
    const active = recognition.current;
    recognition.current = null;
    written.current = null;
    if (active) {
      active.onresult = null;
      active.onerror = null;
      active.onend = null;
      try {
        active.abort();
      } catch {
        // Already ended.
      }
    }
    setListening(false);
  }, []);

  const start = useCallback(() => {
    const Recognition = getSpeechRecognition();
    if (!Recognition || recognition.current || latest.current.isDisabled) return;
    const typed = latest.current.value;
    const active = new Recognition();
    active.lang = speechLang();
    active.continuous = true;
    active.interimResults = true;
    active.maxAlternatives = 1;
    active.onresult = (event) => {
      if (recognition.current !== active) return;
      const next = joinSpoken(typed, spokenText(event.results), latest.current.maxLength);
      written.current = next;
      latest.current.onValueChange(next);
    };
    active.onerror = (event) => {
      if (recognition.current !== active) return;
      const problem = speechErrorOf(event.error);
      if (problem) setError(problem);
    };
    active.onend = () => {
      if (recognition.current !== active) return;
      recognition.current = null;
      written.current = null;
      setListening(false);
    };
    recognition.current = active;
    written.current = typed;
    setError(null);
    setListening(true);
    try {
      active.start();
    } catch {
      recognition.current = null;
      written.current = null;
      setListening(false);
      setError("failed");
    }
  }, []);

  const toggle = useCallback(() => {
    if (recognition.current) stop();
    else start();
  }, [start, stop]);

  // Typing, sending (the field clears) or any other outside change ends listening.
  useEffect(() => {
    if (recognition.current && written.current !== null && value !== written.current) stop();
  }, [value, stop]);

  useEffect(() => {
    if (isDisabled && recognition.current) stop();
  }, [isDisabled, stop]);

  // The Ask bar's mic opened this field: listen straight away. Taken in a timeout so React's dev double mount
  // (mount, unmount, mount) doesn't use up the request on the first, throw-away mount.
  useEffect(() => {
    if (!takeAskBarRequest) return;
    const timer = window.setTimeout(() => {
      if (takeVoiceRequest()) start();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [takeAskBarRequest, start]);

  useEffect(() => stop, [stop]);

  return { supported, listening, error, start, stop, toggle };
}

export interface AiMicButtonProps {
  speech: SpeechInput;
  isDisabled?: boolean;
  className?: string;
}

/**
 * The mic at the right end of an AI input, before Send (`.zc-ai-mic`): ink when idle, a pulsing red disc while
 * listening. Pressing it keeps the focus in the field. Unsupported browsers show it dimmed with the reason on hover.
 */
export function AiMicButton({ speech, isDisabled = false, className }: AiMicButtonProps) {
  const unavailable = !speech.supported || isDisabled;
  const label = micLabel(speech);
  return (
    <button
      type="button"
      className={cx("zc-ai-mic", className)}
      aria-label={label}
      title={label}
      aria-pressed={speech.listening}
      aria-disabled={unavailable || undefined}
      data-listening={speech.listening || undefined}
      data-error={speech.error && !speech.listening ? speech.error : undefined}
      onMouseDown={(event: MouseEvent) => event.preventDefault()}
      onClick={() => {
        if (!unavailable) speech.toggle();
      }}
    >
      <IconMic aria-hidden />
    </button>
  );
}
