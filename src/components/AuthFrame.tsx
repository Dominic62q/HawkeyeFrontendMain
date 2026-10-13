import { useEffect, useRef, type ReactNode } from "react";
import { useTheme } from "../lib/theme";
import { Logo } from "./Logo";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

/**
 * A wall-sized eye. The pupil follows the pointer, it blinks now and then,
 * and it shuts while a password is being typed.
 */
export function WatchingEye({ shut, wince }: { shut: boolean; wince: boolean }) {
  const ref = useRef<SVGSVGElement>(null);
  const pupil = useRef<SVGGElement>(null);

  useEffect(() => {
    if (window.matchMedia(REDUCED_MOTION).matches) return;
    const look = (e: PointerEvent) => {
      const box = ref.current?.getBoundingClientRect();
      if (!box || !pupil.current) return;
      const dx = (e.clientX - (box.left + box.width / 2)) / box.width;
      const dy = (e.clientY - (box.top + box.height / 2)) / box.height;
      const x = Math.max(-1, Math.min(1, dx * 3)) * 30;
      const y = Math.max(-1, Math.min(1, dy * 3)) * 12;
      pupil.current.style.transform = `translate(${x}px, ${y}px)`;
    };
    window.addEventListener("pointermove", look);
    return () => window.removeEventListener("pointermove", look);
  }, []);

  return (
    <svg
      ref={ref}
      className={`watcher ${shut ? "shut" : ""} ${wince ? "wince" : ""}`}
      viewBox="0 0 200 100"
      aria-hidden="true"
    >
      <defs>
        <clipPath id="lids">
          <path d="M4 50C44 6 76 4 100 4C124 4 156 6 196 50C156 94 124 96 100 96C76 96 44 94 4 50Z" />
        </clipPath>
      </defs>
      <g className="lidwrap">
        <path
          className="lid-line"
          d="M4 50C44 6 76 4 100 4C124 4 156 6 196 50C156 94 124 96 100 96C76 96 44 94 4 50Z"
        />
        <g clipPath="url(#lids)">
          <g className="gaze" ref={pupil}>
            <circle className="iris" cx="100" cy="50" r="34" />
            <circle className="ticks" cx="100" cy="50" r="28" />
            <circle className="ring" cx="100" cy="50" r="20" />
            <circle className="pupil" cx="100" cy="50" r="13" />
            <circle className="glint" cx="106" cy="44" r="3.4" />
          </g>
        </g>
      </g>
    </svg>
  );
}

/** The full-page layout shared by sign in, sign up, password reset and invites. */
export function AuthFrame({
  children,
  shut = false,
  wince = false,
  footer,
}: {
  children: ReactNode;
  shut?: boolean;
  wince?: boolean;
  footer?: [string, string];
}) {
  useTheme(); // apply the saved theme; the app shell does this too, but not before sign in
  const [left, right] = footer ?? [`on ${window.location.host}`, "Hawkeye · error tracking"];
  return (
    <div className="login">
      <WatchingEye shut={shut} wince={wince} />
      <header className="lhead">
        <Logo />
      </header>
      <main className="lmain">{children}</main>
      <footer className="lfoot">
        <span>{left}</span>
        <span>{right}</span>
      </footer>
    </div>
  );
}
