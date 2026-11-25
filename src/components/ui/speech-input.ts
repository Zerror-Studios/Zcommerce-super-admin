/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/**
 * Voice input for the AI inputs (owner, 2026-11-25): pure helpers behind `useSpeechInput` (AiMic.tsx).
 *
 * It uses the browser's own speech recognition (Web Speech API: Chrome, Edge, Safari). The browser turns speech into
 * text; Zcom only receives the text when the user sends it, like typed text. Firefox has no speech recognition, so
 * there the mic shows as unavailable.
 */

export interface SpeechAlternativeLike {
  readonly transcript: string;
}

export interface SpeechResultLike {
  readonly isFinal: boolean;
  readonly length: number;
  readonly [index: number]: SpeechAlternativeLike;
}

export interface SpeechResultListLike {
  readonly length: number;
  readonly [index: number]: SpeechResultLike;
}

/** The part of the browser's `SpeechRecognition` the AI inputs use. */
export interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: { results: SpeechResultListLike }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  abort(): void;
}

export type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

/** The browser's speech recognition (prefixed in Chrome, Edge and Safari), or null when it has none. */
export function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const scope = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
}

/** The language to listen for: the browser's own (e.g. en-IN), else English. */
export function speechLang(): string {
  if (typeof navigator !== "undefined" && navigator.language) return navigator.language;
  return "en-US";
}

/** Everything heard so far in this session (final phrases plus the current guess), as one line. */
export function spokenText(results: SpeechResultListLike): string {
  const parts: string[] = [];
  for (let index = 0; index < results.length; index += 1) parts.push(results[index]?.[0]?.transcript ?? "");
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

/** The text already in the field, then what was said, with one space between. */
export function joinSpoken(typed: string, spoken: string, maxLength?: number): string {
  let next: string;
  if (!spoken) next = typed;
  else if (!typed.trim()) next = spoken;
  else next = /\s$/.test(typed) ? typed + spoken : `${typed} ${spoken}`;
  return maxLength != null && maxLength > 0 ? next.slice(0, maxLength) : next;
}

export type SpeechError = "blocked" | "no-mic" | "failed";

/** What a recognition error means to the user; null for the ones that need no message (silence, our own stop). */
export function speechErrorOf(code: string): SpeechError | null {
  switch (code) {
    case "no-speech":
    case "aborted":
      return null;
    case "not-allowed":
    case "service-not-allowed":
      return "blocked";
    case "audio-capture":
      return "no-mic";
    default:
      return "failed";
  }
}

/** The mic's name for screen readers and its hover title. */
export function micLabel(state: { supported: boolean; listening: boolean; error: SpeechError | null }): string {
  if (!state.supported) return "Voice input isn't available in this browser. Try Chrome, Edge or Safari.";
  if (state.listening) return "Stop voice input";
  if (state.error === "blocked") return "Microphone blocked. Allow it in the browser's site settings, then try again.";
  if (state.error === "no-mic") return "No microphone found";
  if (state.error === "failed") return "Voice input stopped. Try again.";
  return "Speak instead of typing";
}

// ─── Ask bar hand-off ────────────────────────────────────────────────────────

/** How long a mic click on the Ask bar waits for the chat box's reply field to appear (it may still be loading). */
const VOICE_REQUEST_TTL_MS = 10_000;
let voiceRequestedAt = 0;

/** The Ask bar's mic: open the chat box and start listening there. */
export function requestVoiceOnOpen(now: number = Date.now()): void {
  voiceRequestedAt = now;
}

/** The reply field takes the Ask bar's request once (true when it was made in the last few seconds). */
export function takeVoiceRequest(now: number = Date.now()): boolean {
  const requested = voiceRequestedAt > 0 && now - voiceRequestedAt <= VOICE_REQUEST_TTL_MS;
  voiceRequestedAt = 0;
  return requested;
}
