export const lightTheme = {
  primary: "#2563EB",
  primaryLight: "#EFF6FF",
  primaryMid: "#DBEAFE",
  bg: "#F8FAFC",
  surface: "#FFFFFF",
  surfaceAlt: "#F1F5F9",
  border: "#E2E8F0",
  text: "#1E293B",
  textMuted: "#94A3B8",
  textSub: "#64748B",
  success: "#16A34A",
  successLight: "#F0FDF4",
  danger: "#DC2626",
  dangerLight: "#FEF2F2",
  warning: "#D97706",
  warningLight: "#FFFBEB",
  shadow: "0 1px 4px rgba(0,0,0,0.07)",
  shadowMd: "0 4px 16px rgba(0,0,0,0.08)",
};

export const darkTheme = {
  primary: "#3B82F6",
  primaryLight: "#1E293B",
  primaryMid: "#1E3A5F",
  bg: "#0B0F14",
  surface: "#12161C",
  surfaceAlt: "#1A1F26",
  border: "#232830",
  text: "#F1F5F9",
  textMuted: "#94A3B8",
  textSub: "#94A3B8",
  success: "#4ADE80",
  successLight: "#12291C",
  danger: "#F87171",
  dangerLight: "#341518",
  warning: "#FBBF24",
  warningLight: "#3A2A0E",
  shadow: "0 1px 4px rgba(0,0,0,0.3)",
  shadowMd: "0 4px 16px rgba(0,0,0,0.35)",
};

// Default export tetap light — dipakai apa adanya oleh komponen yang belum
// di-migrasi ke useTheme() (mis. PertaminaDashboard/Depot, BottomNav fallback)
const theme = lightTheme;
export default theme;