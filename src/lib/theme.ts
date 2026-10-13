import { useCallback, useEffect, useState } from "react";

export type Theme = "paper" | "night";
const KEY = "hawkeye-theme";

function read(): Theme {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "paper" || saved === "night") return saved;
  } catch {
    // storage can be unavailable (private mode); fall through to the OS preference
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "night" : "paper";
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(read);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      // ignore: the theme still applies for this session
    }
  }, [theme]);

  const toggle = useCallback(() => setTheme((t) => (t === "paper" ? "night" : "paper")), []);
  return { theme, toggle };
}
