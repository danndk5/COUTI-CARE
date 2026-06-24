/**
 * inspeksiHelper.js
 * Helper terpusat untuk logika inspeksi GPS & CCTV.
 * Import dari sini — jangan tulis ulang logika ini di komponen.
 */

// Field-field yang menentukan status Normal/Abnormal
const STATUS_FIELDS = [
  "segel_gps",
  "kabel_gps",
  "segel_bricket_dashcam",
  "segel_kabel_dashcam",
  "segel_bricket_kanan",
  "segel_kabel_kanan",
  "segel_bricket_kiri",
  "segel_kabel_kiri",
];

const TIMEZONE = "Asia/Makassar"; // Samakan dengan lib/dateHelper.js

/**
 * Cek apakah satu item inspeksi statusnya Normal.
 * @param {Object} item - row dari tabel `inspeksi`
 * @returns {boolean}
 */
export const isInspeksiNormal = (item) =>
  STATUS_FIELDS.every((f) => item[f]?.toLowerCase() === "normal");

/**
 * Dapatkan label status inspeksi: "Normal" | "Abnormal"
 * @param {Object} item - row dari tabel `inspeksi`
 * @returns {"Normal"|"Abnormal"}
 */
export const getStatusInspeksi = (item) =>
  isInspeksiNormal(item) ? "Normal" : "Abnormal";

// Alias — beberapa screen (RiwayatScreen, DetailScreen) memanggil dengan nama ini
export const getStatusFromInspeksi = getStatusInspeksi;

/**
 * Hitung statistik dari array inspeksi.
 * @param {Array} inspeksiList
 * @returns {{ total: number, normal: number, abnormal: number }}
 */
export const hitungStats = (inspeksiList) => {
  const total = inspeksiList.length;
  const normal = inspeksiList.filter(isInspeksiNormal).length;
  return { total, normal, abnormal: total - normal };
};

/**
 * Map row inspeksi dari Supabase ke format tampilan.
 * @param {Object} item - row dari tabel `inspeksi`
 * @returns {Object}
 */
export const mapInspeksiItem = (item) => ({
  id: item.id,
  plat: item.nomor_polisi,
  armada: item.nama_armada,
  pemeriksa: item.nama_pemeriksa,
  perusahaan: item.perusahaan_transportir,
  tanggal: item.created_at,
  status: getStatusInspeksi(item),
});

/**
 * FIX: Supabase mengembalikan timestamp tanpa 'Z' di akhir (tanpa info timezone),
 * sehingga `new Date()` salah menganggapnya sebagai waktu lokal, bukan UTC.
 * Fungsi ini memastikan timestamp selalu dibaca sebagai UTC sebelum dikonversi.
 *
 * Konversi ISO string ke tanggal lokal (timezone-safe) format YYYY-MM-DD.
 * Dipakai untuk filter tanggal agar tidak kena bug UTC vs waktu lokal.
 * @param {string} isoString
 * @returns {string} "YYYY-MM-DD"
 */
export const toLocalDateString = (isoString) => {
  if (!isoString) return "";

  const hasTimezoneInfo = /Z$|[+-]\d{2}:\d{2}$/.test(isoString);
  const fixedString = hasTimezoneInfo ? isoString : `${isoString}Z`;
  const d = new Date(fixedString);

  // Format ke YYYY-MM-DD sesuai timezone lokal (bukan UTC)
  return d.toLocaleDateString("en-CA", { timeZone: TIMEZONE }); // en-CA = format YYYY-MM-DD
};

/**
 * Validasi field CCTV — semua kamera harus sudah diisi statusnya.
 * @param {Object} cctv - state cctv dari FormScreen
 * @returns {boolean}
 */
export const isCctvValid = (cctv) => {
  const kameraList = ["dashcam", "kanan", "kiri"];
  return kameraList.every(
    (cam) => cctv[cam].segel_bricket !== "" && cctv[cam].segel_kabel !== ""
  );
};