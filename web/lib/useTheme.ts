"use client";

import { useEffect, useState } from "react";

// Reads the theme that the pre-paint script in layout.tsx already applied,
// and toggles the `.dark` class on <html> (persisting the choice).
export function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
  }, []);

  function toggle() {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      document.documentElement.classList.toggle("dark", next === "dark");
      try {
        localStorage.setItem("theme", next);
      } catch {}
      return next;
    });
  }

  return { theme, toggle };
}
