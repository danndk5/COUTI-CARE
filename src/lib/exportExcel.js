import * as XLSX from "xlsx";
import { formatDate, formatTime } from "./dateHelper";
import { isGpsAbnormal, isHseBermasalah, isP1Bermasalah } from "./exportHelper";

const KATEGORI_TITLE = {
  gps: "GPS & CCTV",
  hse: "Uji Kedap MT",
  p1:  "Cek Random P1",
};

export const generateExcel = ({ data, topKerusakan, ringkasan, periodeLabel, kategori }) => {
  const wb = XLSX.utils.book_new();

  // ── Sheet: Ringkasan ──────────────────────────────────────────────────────
  const ringkasanRows = [
    ["Laporan Export Data Inspeksi — GPS & CCTV Checker"],
    ["Periode", periodeLabel],
    ["Digenerate pada", new Date().toLocaleString("id-ID")],
    [],
    ["Kategori", "Total Diperiksa", "Perlu Tindak Lanjut"],
  ];
  if (kategori.includes("gps")) ringkasanRows.push([KATEGORI_TITLE.gps, ringkasan.gps.total, ringkasan.gps.bermasalah]);
  if (kategori.includes("hse")) ringkasanRows.push([KATEGORI_TITLE.hse, ringkasan.hse.total, ringkasan.hse.bermasalah]);
  if (kategori.includes("p1"))  ringkasanRows.push([KATEGORI_TITLE.p1,  ringkasan.p1.total,  ringkasan.p1.bermasalah]);
  const wsRingkasan = XLSX.utils.aoa_to_sheet(ringkasanRows);
  wsRingkasan["!cols"] = [{ wch: 30 }, { wch: 22 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsRingkasan, "Ringkasan");

  // ── Sheet: Kendaraan Paling Sering Bermasalah ────────────────────────────────
  const topRows = [
    ["Nomor Polisi", "Transportir", "GPS & CCTV", "Uji Kedap MT", "Cek Random P1", "Total Temuan"],
    ...topKerusakan.map((k) => [k.nomor_polisi, k.transportir, k.gps, k.hse, k.p1, k.total]),
  ];
  const wsTop = XLSX.utils.aoa_to_sheet(topRows);
  wsTop["!cols"] = [{ wch: 16 }, { wch: 24 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, wsTop, "Kendaraan Sering Rusak");

  // ── Sheet: GPS & CCTV ─────────────────────────────────────────────────────
  if (kategori.includes("gps")) {
    const rows = [
      ["Tanggal", "Jam", "Nomor Polisi", "Nama Armada", "Transportir", "Status", "Status Perbaikan"],
      ...data.gps.map((i) => [
        formatDate(i.created_at),
        formatTime(i.created_at),
        i.nomor_polisi || "-",
        i.nama_armada || "-",
        i.perusahaan_transportir || "-",
        isGpsAbnormal(i) ? "Abnormal" : "Normal",
        i.status === "selesai" ? "Selesai Diperbaiki" : (isGpsAbnormal(i) ? "Perlu Tindak Lanjut" : "-"),
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 12 }, { wch: 8 }, { wch: 14 }, { wch: 18 }, { wch: 22 }, { wch: 12 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, ws, KATEGORI_TITLE.gps);
  }

  // ── Sheet: Uji Kedap MT ───────────────────────────────────────────────────
  if (kategori.includes("hse")) {
    const rows = [
      ["Tanggal", "Jam", "Nomor Polisi", "Transportir", "Kategori MT", "Kapasitas", "Kompartemen", "Status"],
      ...data.hse.map((i) => [
        formatDate(i.created_at),
        formatTime(i.created_at),
        i.nomor_polisi || "-",
        i.transportir || "-",
        i.kategori_mt === "merah_putih" ? "MT Merah Putih" : "MT Industri",
        i.kapasitas_mt || "-",
        i.jumlah_kompartemen ?? "-",
        isHseBermasalah(i) ? "Perlu Tindak Lanjut" : "Kedap / Lulus",
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 12 }, { wch: 8 }, { wch: 14 }, { wch: 22 }, { wch: 16 }, { wch: 12 }, { wch: 13 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, ws, KATEGORI_TITLE.hse);
  }

  // ── Sheet: Cek Random P1 ──────────────────────────────────────────────────
  if (kategori.includes("p1")) {
    const rows = [
      ["Tanggal", "Nomor Polisi", "Transportir", "Kategori MT", "Jumlah Temuan", "Status", "Detail Temuan"],
      ...data.p1.map((i) => [
        formatDate(i.created_at),
        i.nomor_polisi || "-",
        i.transportir || "-",
        i.kategori_mt === "merah_putih" ? "MT Merah Putih" : "MT Industri",
        i.inspeksi_p1_temuan?.length || 0,
        isP1Bermasalah(i) ? "Perlu Tindak Lanjut" : "Tidak Ada Temuan",
        (i.inspeksi_p1_temuan || []).map((t) => t.judul).join("; ") || "-",
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 12 }, { wch: 14 }, { wch: 22 }, { wch: 16 }, { wch: 14 }, { wch: 18 }, { wch: 45 }];
    XLSX.utils.book_append_sheet(wb, ws, KATEGORI_TITLE.p1);
  }

  const filename = `Export-Inspeksi-${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);
};