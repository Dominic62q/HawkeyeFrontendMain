export function Eye({ className = "eye" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" aria-hidden="true">
      <path
        d="M4 50C20 22 36 12 50 12C64 12 80 22 96 50C80 78 64 88 50 88C36 88 20 78 4 50Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="9"
        strokeLinejoin="round"
      />
      <circle cx="50" cy="50" r="20" fill="var(--signal)" />
      <circle cx="57" cy="43" r="6" fill="var(--paper)" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="logo">
      <Eye />
      Hawkeye
    </span>
  );
}
