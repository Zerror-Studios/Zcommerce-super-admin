/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/**
 * The login helper (owner, 2026-11-04, from a reference recording): a small dark tile with two eyes that follow
 * the pointer anywhere on the page and blink now and then, and a speech bubble that types out one short line per
 * step ("What's your email?", "That looks right.", "I'm not looking."). While the password is typed the eyes
 * close. Screen readers get each line once, politely; with reduced motion the eyes stay still and the line shows
 * at once.
 */
import { forwardRef, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cx } from "../ui/cx";

export type AuthBuddyMood = "idle" | "happy" | "shy" | "thinking" | "sad";

export interface AuthBuddyProps {
  /** The line in the bubble. A new line is typed out again. */
  message: string;
  /** shy: eyes shut (password); thinking: eyes look up (signing in); sad: drooping eyes (an error). */
  mood?: AuthBuddyMood;
  className?: string;
}

/** How far the eyes move towards the pointer, in px. */
const EYE_TRAVEL = 3;
const TYPE_MS = 28;

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function AuthBuddy({ message, mood = "idle", className }: AuthBuddyProps) {
  const tileRef = useRef<HTMLDivElement>(null);
  const [look, setLook] = useState({ x: 0, y: 0 });
  const [blink, setBlink] = useState(false);
  const [typed, setTyped] = useState(message);

  // Eyes follow the pointer anywhere on the page.
  useEffect(() => {
    if (prefersReducedMotion()) return;
    let frame = 0;
    const onMove = (event: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const box = tileRef.current?.getBoundingClientRect();
        if (!box) return;
        const dx = event.clientX - (box.left + box.width / 2);
        const dy = event.clientY - (box.top + box.height / 2);
        const distance = Math.hypot(dx, dy) || 1;
        // Full travel from ~120px away; closer in, the eyes move less.
        const reach = Math.min(1, distance / 120);
        setLook({ x: (dx / distance) * EYE_TRAVEL * reach, y: (dy / distance) * EYE_TRAVEL * reach });
      });
    };
    window.addEventListener("pointermove", onMove);
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(frame);
    };
  }, []);

  // A blink every 3–6 seconds.
  useEffect(() => {
    if (prefersReducedMotion()) return;
    let timer: number;
    const schedule = () => {
      timer = window.setTimeout(() => {
        setBlink(true);
        window.setTimeout(() => setBlink(false), 140);
        schedule();
      }, 3000 + Math.random() * 3000);
    };
    schedule();
    return () => window.clearTimeout(timer);
  }, []);

  // Type the line out.
  useEffect(() => {
    if (prefersReducedMotion()) {
      setTyped(message);
      return;
    }
    setTyped("");
    let index = 0;
    const timer = window.setInterval(() => {
      index += 1;
      setTyped(message.slice(0, index));
      if (index >= message.length) window.clearInterval(timer);
    }, TYPE_MS);
    return () => window.clearInterval(timer);
  }, [message]);

  const shut = mood === "shy" || blink;
  const offset =
    mood === "thinking" ? { x: 3, y: -EYE_TRAVEL } : mood === "shy" ? { x: 0, y: 2 } : look;

  return (
    <div className={cx("flex items-center gap-2.5", className)}>
      <div
        ref={tileRef}
        aria-hidden
        className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-auth-field-line bg-auth-field shadow-[0_6px_16px_rgba(0,0,0,0.35)]"
      >
        <div
          className="flex items-center gap-1.5 transition-transform duration-150 ease-out"
          style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
        >
          {[0, 1].map((eye) => (
            <span
              key={eye}
              className={cx(
                "block w-1.5 rounded-full bg-brand-on transition-[height,transform] duration-100 ease-out",
                shut ? "h-0.5" : "h-2.5",
                mood === "sad" && !shut && (eye === 0 ? "-rotate-12" : "rotate-12"),
                mood === "happy" && !shut && "h-2",
              )}
            />
          ))}
        </div>
      </div>
      <p
        aria-hidden
        className="relative min-h-7 max-w-full rounded-2xl bg-surface px-3 py-1 text-label font-medium text-fg shadow-[0_6px_16px_rgba(0,0,0,0.25)]"
      >
        {typed || " "}
      </p>
      <span className="sr-only" aria-live="polite">
        {message}
      </span>
    </div>
  );
}

/** A login field that slides open when its step comes (the next field after "Continue"). Closed, it can't be focused. Use in a `gap-4` column. */
export function AuthReveal({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <div
      className={cx(
        "grid transition-[grid-template-rows,opacity,margin] duration-300 ease-out motion-reduce:transition-none",
        // Closed, it also gives back the form's 16px gap so no empty space is left.
        open ? "grid-rows-[1fr] opacity-100" : "-mt-4 grid-rows-[0fr] opacity-0",
      )}
      aria-hidden={open ? undefined : true}
      // `inert` keeps a closed field out of the tab order and away from screen readers.
      inert={!open}
    >
      {/* Padding inside the clip so the focus ring isn't cut off */}
      <div className="-m-1 overflow-hidden p-1">{children}</div>
    </div>
  );
}

export interface AuthCodeInputProps {
  /** The digits typed so far ("" to "123456"). */
  value: string;
  onChange: (value: string) => void;
  /** Called once all boxes are filled, with the full code. */
  onComplete?: (code: string) => void;
  length?: number;
  error?: string;
  /** For screen readers: "One-time code". */
  label: string;
  autoFocus?: boolean;
}

/**
 * A one-time code as separate boxes (owner, 2026-11-04): typing moves to the next box, Backspace to the previous,
 * arrows move, and pasting or the phone's code suggestion fills them all. Digits only; an empty box is a space in
 * `value`.
 */
export const AuthCodeInput = forwardRef<HTMLInputElement, AuthCodeInputProps>(function AuthCodeInput(
  { value, onChange, onComplete, length = 6, error, label, autoFocus },
  ref,
) {
  const boxes = useRef<(HTMLInputElement | null)[]>([]);
  const errorId = useId();
  // An empty box is a space in `value`, so later digits stay in their boxes.
  const digits = Array.from({ length }, (_, index) => (value[index] ?? "").trim());
  const toValue = (list: string[]) => list.map((digit) => digit || " ").join("").trimEnd();

  const focusBox = (index: number) => boxes.current[Math.max(0, Math.min(length - 1, index))]?.focus();

  const write = (start: number, typed: string) => {
    const clean = typed.replace(/\D/g, "");
    if (!clean) return;
    const next = digits.slice();
    clean
      .slice(0, length - start)
      .split("")
      .forEach((digit, offset) => {
        next[start + offset] = digit;
      });
    const code = toValue(next);
    onChange(code);
    focusBox(start + clean.length);
    if (/^\d+$/.test(code) && code.length === length) onComplete?.(code);
  };

  return (
    <div role="group" aria-label={label} aria-describedby={error ? errorId : undefined} className="flex flex-col gap-1.5">
      <div className="flex justify-between gap-2">
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(element) => {
              boxes.current[index] = element;
              if (index === 0) {
                if (typeof ref === "function") ref(element);
                else if (ref) ref.current = element;
              }
            }}
            aria-label={`${label}, digit ${index + 1} of ${length}`}
            aria-invalid={error ? true : undefined}
            inputMode="numeric"
            autoComplete={index === 0 ? "one-time-code" : "off"}
            autoFocus={autoFocus && index === 0}
            maxLength={index === 0 ? length : 1}
            value={digit}
            onFocus={(event) => event.currentTarget.select()}
            onChange={(event) => {
              const typed = event.target.value;
              if (!typed) {
                const next = digits.slice();
                next[index] = "";
                onChange(toValue(next));
                return;
              }
              // The box keeps its old digit selected, so the new one is the last character typed
              write(index, typed.length > 1 && index > 0 ? typed.slice(-1) : typed);
            }}
            onKeyDown={(event) => {
              if (event.key === "Backspace" && !digits[index]) {
                event.preventDefault();
                const next = digits.slice();
                next[Math.max(0, index - 1)] = "";
                onChange(toValue(next));
                focusBox(index - 1);
              } else if (event.key === "ArrowLeft") {
                event.preventDefault();
                focusBox(index - 1);
              } else if (event.key === "ArrowRight") {
                event.preventDefault();
                focusBox(index + 1);
              }
            }}
            onPaste={(event) => {
              event.preventDefault();
              write(index, event.clipboardData.getData("text"));
            }}
            className={cx(
              "auth-field h-12 w-full min-w-0 rounded-lg border bg-auth-field text-center text-title-3 font-semibold text-brand-on outline-hidden transition-colors duration-instant num",
              "focus:border-auth-focus focus:shadow-auth-focus",
              error ? "border-auth-error" : "border-auth-field-line",
            )}
          />
        ))}
      </div>
      {error ? (
        <p id={errorId} role="alert" className="text-caption text-auth-error">
          {error}
        </p>
      ) : null}
    </div>
  );
});
