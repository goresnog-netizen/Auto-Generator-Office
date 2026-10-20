/**
 * Theme Provider — React context + CSS variable theme manager
 */
import React, { createContext, useContext, useEffect, useState } from "react";

interface ThemeContextValue {
  mode: "light" | "dark";
  setMode: (m: "light" | "dark") => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  mode: "dark",
  setMode: () => {},
  toggle: () => {},
});

export const useTheme = () => useContext(ThemeContext);

/**
 * Warna datang dari CSS: `tokens.css` (dark) dan
 * `:root[data-theme="light"]` (base.css). Provider hanya menyalakan atribut,
 * tidak menulis inline style — kalau menulis, inline menang dan mode terang
 * tetap gelap.
 */
export const ThemeProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [mode, setMode] = useState<"light" | "dark">(() => {
    const saved = localStorage.getItem("nitz909-theme");
    if (saved === "light" || saved === "dark") return saved;
    return "dark";
  });

  useEffect(() => {
    localStorage.setItem("nitz909-theme", mode);
    const root = document.documentElement;
    // Matikan transisi sesaat agar tema baru langsung jadi (anti macet).
    root.classList.add("tanpa-transisi");
    root.setAttribute("data-theme", mode);
    root.style.colorScheme = mode;
    const raf = requestAnimationFrame(() =>
      requestAnimationFrame(() => root.classList.remove("tanpa-transisi")),
    );
    return () => cancelAnimationFrame(raf);
  }, [mode]);

  const toggle = () => setMode((m) => (m === "dark" ? "light" : "dark"));

  return (
    <ThemeContext.Provider value={{ mode, setMode, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
};
