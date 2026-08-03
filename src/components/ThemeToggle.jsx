import { useTheme } from "../context/ThemeContext";

// Tombol toggle tema — taruh di header, biasanya di samping tombol logout.
// Emoji dipakai (bukan Icon component) supaya tidak bergantung nama ikon
// yang mungkin belum ada di set Icon.jsx kamu.
const ThemeToggle = () => {
  const { isDark, toggleTheme, theme } = useTheme();

  return (
    <div
      onClick={toggleTheme}
      title={isDark ? "Ganti ke tema terang" : "Ganti ke tema gelap"}
      style={{
        cursor: "pointer",
        padding: 10,
        borderRadius: 12,
        background: theme.surfaceAlt,
        border: `1px solid ${theme.border}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 16,
        lineHeight: 1,
        userSelect: "none",
      }}
    >
      {isDark ? "☀️" : "🌙"}
    </div>
  );
};

export default ThemeToggle;