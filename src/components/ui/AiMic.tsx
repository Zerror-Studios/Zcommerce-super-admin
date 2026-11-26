/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/**
 * Voice input in every AI input (owner, 2026-11-25; the mic was a picture since 2026-11-21). `useSpeechInput` runs
 * the browser's speech recognition and writes what is heard into the field as the user speaks (helpers and privacy
 * note in speech-input.ts); `AiMicButton` is the mic that starts and stops it.
 *
 * - Speech is added after what is already typed; the field shows the live guess and settles as phrases finish.
 * - Typing, sending, or the field turning disabled ends listening, so speech never lands on top of an edit.
 * - It keeps listening through pauses (restarting the browser's run when it ends on its own) until the user presses
 *   ✓ (keep the text) or ✕ (drop what was said, back to the text from before), types or sends, or a minute passes
 *   without a word.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from "react";
import { cx } from "./cx";
import { IconCheck, IconClose, IconMic } from "./icons";
import { toast } from "./toast";
import {
  getSpeechRecognition,
  joinSpoken,
  micLabel,
  speechErrorOf,
  speechErrorMessage,
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
  /** The browser has opened the mic for this session (the waveform starts reading levels then). */
  capturing: boolean;
  error: SpeechError | null;
  start: () => void;
  /** Stop listening and keep what was heard (✓). */
  stop: () => void;
  /** Stop listening and put the field back to what it held before the mic was pressed (✕). */
  cancel: () => void;
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

/** Listening stops by itself after this long without hearing a word (a forgotten open mic). */
const SILENCE_LIMIT_MS = 60_000;
/** A run that ends this fast counts as a failed start; this many in a row ends the session with an error. */
const QUICK_END_MS = 1_000;
const QUICK_END_LIMIT = 3;

export function useSpeechInput({ value, onValueChange, maxLength, isDisabled = false, takeAskBarRequest = false }: UseSpeechInputOptions): SpeechInput {
  const [supported] = useState(() => getSpeechRecognition() !== null);
  const [listening, setListening] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState<SpeechError | null>(null);
  const recognition = useRef<SpeechRecognitionLike | null>(null);
  /** The text this hook last wrote; any other value means the user (or a send) changed the field. */
  const written = useRef<string | null>(null);
  const latest = useRef({ value, onValueChange, maxLength, isDisabled });
  useEffect(() => {
    latest.current = { value, onValueChange, maxLength, isDisabled };
  });

  /** The listening session the user started; null once they stop it (or it ends on an error). */
  const session = useRef<{ heardAt: number; quickEnds: number; before: string } | null>(null);

  const stop = useCallback(() => {
    session.current = null;
    const active = recognition.current;
    recognition.current = null;
    written.current = null;
    if (active) {
      active.onresult = null;
      active.onerror = null;
      active.onend = null;
      active.onaudiostart = null;
      try {
        active.abort();
      } catch {
        // Already ended.
      }
    }
    setListening(false);
    setCapturing(false);
  }, []);

  const start = useCallback(() => {
    const Recognition = getSpeechRecognition();
    if (!Recognition || session.current || latest.current.isDisabled) return;
    session.current = { heardAt: Date.now(), quickEnds: 0, before: latest.current.value };
    setError(null);
    setListening(true);

    const fail = (problem: SpeechError) => {
      stop();
      setError(problem);
      toast.error(speechErrorMessage(problem));
    };

    // Browsers end a recognition run on their own after a pause (Chrome after a few seconds of silence, and every
    // minute or so anyway). While the user hasn't pressed stop, a new run picks up from the text in the field.
    const listen = (typed: string) => {
      const active = new Recognition();
      const startedAt = Date.now();
      active.lang = speechLang();
      active.continuous = true;
      active.interimResults = true;
      active.maxAlternatives = 1;
      active.onresult = (event) => {
        if (recognition.current !== active) return;
        if (session.current) session.current.heardAt = Date.now();
        const next = joinSpoken(typed, spokenText(event.results), latest.current.maxLength);
        written.current = next;
        latest.current.onValueChange(next);
      };
      active.onaudiostart = () => {
        if (recognition.current === active) setCapturing(true);
      };
      active.onerror = (event) => {
        if (import.meta.env.DEV) console.warn("[voice input] recognition error:", event.error);
        if (recognition.current !== active) return;
        const problem = speechErrorOf(event.error);
        // Silence is normal mid-dictation: the run ends and the next one keeps listening.
        if (problem && problem !== "no-speech") fail(problem);
      };
      active.onend = () => {
        if (recognition.current !== active) return;
        recognition.current = null;
        const current = session.current;
        if (!current) return;
        const now = Date.now();
        current.quickEnds = now - startedAt < QUICK_END_MS ? current.quickEnds + 1 : 0;
        if (current.quickEnds >= QUICK_END_LIMIT) {
          fail("failed");
          return;
        }
        if (now - current.heardAt > SILENCE_LIMIT_MS || latest.current.isDisabled) {
          stop();
          return;
        }
        listen(written.current ?? latest.current.value);
      };
      recognition.current = active;
      written.current = typed;
      try {
        active.start();
      } catch (cause) {
        if (import.meta.env.DEV) console.warn("[voice input] could not start:", cause);
        recognition.current = null;
        fail("failed");
      }
    };

    listen(latest.current.value);
  }, [stop]);

  const cancel = useCallback(() => {
    const before = session.current?.before;
    stop();
    if (before !== undefined && before !== latest.current.value) latest.current.onValueChange(before);
  }, [stop]);

  const toggle = useCallback(() => {
    if (session.current) stop();
    else start();
  }, [start, stop]);

  // Typing, sending (the field clears) or any other outside change ends listening.
  useEffect(() => {
    if (session.current && written.current !== null && value !== written.current) stop();
  }, [value, stop]);

  useEffect(() => {
    if (isDisabled && session.current) stop();
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

  return { supported, listening, capturing, error, start, stop, cancel, toggle };
}

export interface AiMicButtonProps {
  speech: SpeechInput;
  isDisabled?: boolean;
  className?: string;
}

/**
 * The mic at the right end of an AI input, before Send (`.zc-ai-mic`). Idle: an ink mic. Listening: it widens into a
 * soft pill with ✕ (drop what was said), a live waveform of the user's voice, and ✓ (keep the text). Pressing any of
 * them keeps the focus in the field; from the keyboard, focus moves from the mic to ✓ and back when listening ends.
 * Unsupported browsers show the mic dimmed with the reason on hover.
 */
export function AiMicButton({ speech, isDisabled = false, className }: AiMicButtonProps) {
  const unavailable = !speech.supported || isDisabled;
  const label = micLabel(speech);
  const micRef = useRef<HTMLButtonElement>(null);
  const doneRef = useRef<HTMLButtonElement>(null);
  /** Where keyboard focus goes after the state flips (only when the pressed button had it). */
  const focusNext = useRef<"mic" | "done" | null>(null);
  const keep = (event: MouseEvent) => event.preventDefault();

  useLayoutEffect(() => {
    const target = focusNext.current === "done" ? doneRef.current : focusNext.current === "mic" ? micRef.current : null;
    focusNext.current = null;
    target?.focus();
  }, [speech.listening]);

  const finish = (how: "stop" | "cancel", button: HTMLButtonElement) => {
    if (document.activeElement === button) focusNext.current = "mic";
    if (how === "cancel") speech.cancel();
    else speech.stop();
  };

  if (speech.listening) {
    return (
      <span role="group" aria-label="Voice input" className={cx("zc-ai-mic", className)} data-listening>
        <button
          type="button"
          className="zc-ai-mic__cancel"
          aria-label="Discard voice input"
          title="Discard"
          onMouseDown={keep}
          onClick={(event) => finish("cancel", event.currentTarget)}
        >
          <IconClose aria-hidden />
        </button>
        <VoiceWave live={speech.capturing} />
        <button
          ref={doneRef}
          type="button"
          className="zc-ai-mic__done"
          aria-label="Keep text"
          title="Keep text"
          onMouseDown={keep}
          onClick={(event) => finish("stop", event.currentTarget)}
        >
          <IconCheck aria-hidden />
        </button>
      </span>
    );
  }

  return (
    <button
      ref={micRef}
      type="button"
      className={cx("zc-ai-mic", className)}
      aria-label={label}
      title={label}
      aria-pressed={false}
      aria-disabled={unavailable || undefined}
      data-error={speech.error ? speech.error : undefined}
      onMouseDown={keep}
      onClick={(event) => {
        if (unavailable) return;
        if (document.activeElement === event.currentTarget) focusNext.current = "done";
        speech.start();
      }}
    >
      <IconMic aria-hidden />
    </button>
  );
}

// ─── Live waveform ───────────────────────────────────────────────────────────

const WAVE_BARS = 12;
/** A new column every this many ms: the wave scrolls right to left like a recorder. */
const WAVE_STEP_MS = 70;
/** Quietest bar (a dot) and how much voice lifts it. */
const WAVE_FLOOR = 0.14;
const WAVE_GAIN = 5;

/**
 * Bars that follow the microphone's loudness, newest on the right. Speech recognition does not share its levels, so
 * this opens its own audio stream, but only once recognition has the mic (`live`), so the two never race for it.
 * Until then, without audio access, or with reduced motion, the bars show a calm CSS ripple / still dots.
 */
function VoiceWave({ live }: { live: boolean }) {
  const barsRef = useRef<HTMLSpanElement>(null);
  const [levels, setLevels] = useState(false);

  useEffect(() => {
    if (!live) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !navigator.mediaDevices?.getUserMedia) return;
    let cancelled = false;
    let frame = 0;
    let stream: MediaStream | null = null;
    let context: AudioContext | null = null;

    void navigator.mediaDevices
      .getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
      .then((media) => {
        if (cancelled) {
          media.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = media;
        context = new AudioContext();
        const analyser = context.createAnalyser();
        analyser.fftSize = 512;
        context.createMediaStreamSource(media).connect(analyser);
        const samples = new Uint8Array(analyser.fftSize);
        const history = Array.from({ length: WAVE_BARS }, () => 0);
        let peak = 0;
        let last = 0;
        setLevels(true);

        const tick = (now: number) => {
          analyser.getByteTimeDomainData(samples);
          let sum = 0;
          for (const sample of samples) {
            const centred = (sample - 128) / 128;
            sum += centred * centred;
          }
          // Loudest moment since the last column, so short syllables still show.
          peak = Math.max(peak, Math.min(1, Math.sqrt(sum / samples.length) * WAVE_GAIN));
          if (now - last >= WAVE_STEP_MS) {
            last = now;
            history.shift();
            history.push(peak);
            peak = 0;
            const bars = barsRef.current?.children;
            if (bars) {
              for (let index = 0; index < bars.length; index += 1) {
                const level = WAVE_FLOOR + (1 - WAVE_FLOOR) * (history[index] ?? 0);
                (bars[index] as HTMLElement).style.transform = `scaleY(${level.toFixed(3)})`;
              }
            }
          }
          frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      })
      .catch(() => {
        // No level access: the CSS ripple stands in.
      });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((track) => track.stop());
      void context?.close().catch(() => undefined);
      setLevels(false);
    };
  }, [live]);

  return (
    <span ref={barsRef} aria-hidden className="zc-ai-mic__wave" data-live={levels || undefined}>
      {Array.from({ length: WAVE_BARS }, (_, index) => (
        <span key={index} className="zc-ai-mic__bar" />
      ))}
    </span>
  );
}
