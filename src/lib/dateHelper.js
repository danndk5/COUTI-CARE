// Helper untuk format tanggal/jam dari Supabase
// Supabase kadang return timestamp tanpa 'Z' di akhir, yang menyebabkan
// JavaScript menganggapnya sebagai waktu lokal (bukan UTC), sehingga konversi timezone jadi salah.
// Fungsi ini memastikan timestamp selalu dibaca sebagai UTC, lalu dikonversi ke timezone yang benar.

const TIMEZONE = "Asia/Makassar"; // Ganti sesuai lokasi: Asia/Jakarta (WIB), Asia/Makassar (WITA), Asia/Jayapura (WIT)

const parseAsUTC = (timestamp) => {
  if (!timestamp) return null;
  // Kalau belum ada 'Z' atau offset (+xx:xx), tambahkan 'Z' supaya dibaca sebagai UTC
  const hasTimezoneInfo = /Z$|[+-]\d{2}:\d{2}$/.test(timestamp);
  const fixedTimestamp = hasTimezoneInfo ? timestamp : `${timestamp}Z`;
  return new Date(fixedTimestamp);
};

export const formatDate = (timestamp) => {
  const date = parseAsUTC(timestamp);
  if (!date) return "-";
  return date.toLocaleDateString("id-ID", { timeZone: TIMEZONE });
};

export const formatTime = (timestamp) => {
  const date = parseAsUTC(timestamp);
  if (!date) return "-";
  return date.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIMEZONE,
  });
};

export const formatDateTime = (timestamp) => {
  return `${formatDate(timestamp)} · ${formatTime(timestamp)}`;
};