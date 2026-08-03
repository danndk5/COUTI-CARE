import { createContext, useContext, useState, useEffect } from "react";
import { lightTheme, darkTheme } from "../styles/theme";

const ThemeContext = createContext(null);

const STORAGE_KEY = "app-color-mode";

export const ThemeProvider = ({ children }) => {
  const [mode, setMode] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "dark" ? "dark" : "light";
    } catch {
      return "light";
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // localStorage tidak tersedia (mis. private mode) — abaikan, tema tetap
      // jalan untuk sesi ini saja tanpa disimpan
    }
  }, [mode]);

  const toggleTheme = () => setMode((m) => (m === "light" ? "dark" : "light"));

  const value = {
    mode,
    isDark: mode === "dark",
    theme: mode === "dark" ? darkTheme : lightTheme,
    toggleTheme,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

// Hook pemakaian: const { theme, mode, isDark, toggleTheme } = useTheme();
export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme() harus dipanggil di dalam <ThemeProvider>");
  }
  return ctx;
};