import ExcelJS from "exceljs";
import { formatDate, formatTime } from "./dateHelper";
import { isGpsAbnormal, isHseBermasalah, isP1Bermasalah, formatPeriodeForFilename } from "./exportHelper";

const KATEGORI_TITLE = {
  gps: "GPS & CCTV",
  hse: "Uji Kedap MT",
  p1:  "Cek Random P1",
};

const HEADER_FILL   = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A8A" } };
const HEADER_FONT   = { color: { argb: "FFFFFFFF" }, bold: true };
const DANGER_FILL   = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEE2E2" } };
const DANGER_FONT   = { color: { argb: "FFB91C1C" }, bold: true };
const LINK_FONT     = { color: { argb: "FF2563EB" }, underline: true };

const styleHeaderRow = (row) => {
  row.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: "middle" };
  });
};

const setupSheet = (ws, columns, lastColLetter) => {
  ws.columns = columns;
  styleHeaderRow(ws.getRow(1));
  ws.views = [{ state: "frozen", ySplit: 1 }];
  ws.autoFilter = `A1:${lastColLetter}1`;
};

export const generateExcel = async ({ data, topKerusakan, ringkasan, periodeLabel, kategori, periodeRange }) => {
  const wb = new ExcelJS.Workbook();
  wb.creator = "GPS & CCTV Checker";
  wb.created = new Date();

  // ── Sheet: Ringkasan ──────────────────────────────────────────────────────
  const wsR = wb.addWorksheet("Ringkasan");
  wsR.columns = [{ width: 32 }, { width: 22 }, { width: 22 }];
  const titleRow = wsR.addRow(["Laporan Export Data Inspeksi — GPS & CCTV Checker"]);
  titleRow.font = { bold: true, size: 13 };
  wsR.addRow(["Periode", periodeLabel]);
  wsR.addRow(["Digenerate pada", new Date().toLocaleString("id-ID")]);
  wsR.addRow([]);
  const headRow = wsR.addRow(["Kategori", "Total Diperiksa", "Perlu Tindak Lanjut"]);
  styleHeaderRow(headRow);
  if (kategori.includes("gps")) wsR.addRow([KATEGORI_TITLE.gps, ringkasan.gps.total, ringkasan.gps.bermasalah]);
  if (kategori.includes("hse")) wsR.addRow([KATEGORI_TITLE.hse, ringkasan.hse.total, ringkasan.hse.bermasalah]);
  if (kategori.includes("p1"))  wsR.addRow([KATEGORI_TITLE.p1,  ringkasan.p1.total,  ringkasan.p1.bermasalah]);

  // ── Sheet: Kendaraan Paling Sering Bermasalah ────────────────────────────────
  const wsTop = wb.addWorksheet("Kendaraan Sering Rusak");
  setupSheet(wsTop, [
    { header: "Nomor Polisi",  key: "plat",        width: 16 },
    { header: "Transportir",   key: "transportir",  width: 26 },
    { header: "GPS & CCTV",    key: "gps",          width: 14 },
    { header: "Uji Kedap MT",  key: "hse",          width: 14 },
    { header: "Cek Random P1", key: "p1",           width: 14 },
    { header: "Total Temuan",  key: "total",         width: 14 },
  ], "F");
  topKerusakan.forEach((k) => {
    wsTop.addRow({ plat: k.nomor_polisi, transportir: k.transportir, gps: k.gps, hse: k.hse, p1: k.p1, total: k.total });
  });

  // ── Sheet: GPS & CCTV ─────────────────────────────────────────────────────
  if (kategori.includes("gps")) {
    const ws = wb.addWorksheet(KATEGORI_TITLE.gps);
    setupSheet(ws, [
      { header: "Tanggal",          key: "tgl",        width: 12 },
      { header: "Jam",              key: "jam",        width: 8 },
      { header: "Nomor Polisi",     key: "plat",       width: 14 },
      { header: "Nama Armada",      key: "armada",     width: 18 },
      { header: "Transportir",      key: "transportir", width: 24 },
      { header: "Status",           key: "status",     width: 12 },
      { header: "Status Perbaikan", key: "perbaikan",  width: 18 },
      { header: "Jumlah Foto",      key: "jumlahFoto", width: 12 },
      { header: "Link Foto",        key: "linkFoto",   width: 14 },
    ], "I");

    data.gps.forEach((i) => {
      const abnormal = isGpsAbnormal(i);
      const foto = i._foto || [];
      const row = ws.addRow({
        tgl: formatDate(i.created_at),
        jam: formatTime(i.created_at),
        plat: i.nomor_polisi || "-",
        armada: i.nama_armada || "-",
        transportir: i.perusahaan_transportir || "-",
        status: abnormal ? "Abnormal" : "Normal",
        perbaikan: i.status === "selesai" ? "Selesai Diperbaiki" : (abnormal ? "Perlu Tindak Lanjut" : "-"),
        jumlahFoto: foto.length,
        linkFoto: foto[0] ? "Lihat Foto" : "-",
      });
      if (foto[0]) {
        const cell = row.getCell("linkFoto");
        cell.value = { text: "Lihat Foto", hyperlink: foto[0].url };
        cell.font = LINK_FONT;
      }
      if (abnormal) {
        row.eachCell((cell) => { cell.fill = DANGER_FILL; });
        row.getCell("status").font = DANGER_FONT;
      }
    });
  }

  // ── Sheet: Uji Kedap MT ───────────────────────────────────────────────────
  if (kategori.includes("hse")) {
    const ws = wb.addWorksheet(KATEGORI_TITLE.hse);
    setupSheet(ws, [
      { header: "Tanggal",      key: "tgl",         width: 12 },
      { header: "Jam",          key: "jam",         width: 8 },
      { header: "Nomor Polisi", key: "plat",        width: 14 },
      { header: "Transportir",  key: "transportir", width: 24 },
      { header: "Kategori MT",  key: "kategoriMt",  width: 16 },
      { header: "Kapasitas",    key: "kapasitas",   width: 12 },
      { header: "Kompartemen",  key: "kompartemen", width: 13 },
      { header: "Status",       key: "status",      width: 16 },
      { header: "Jumlah Foto",  key: "jumlahFoto",  width: 12 },
      { header: "Link Foto",    key: "linkFoto",    width: 14 },
    ], "J");

    data.hse.forEach((i) => {
      const bermasalah = isHseBermasalah(i);
      const foto = i._foto || [];
      const row = ws.addRow({
        tgl: formatDate(i.created_at),
        jam: formatTime(i.created_at),
        plat: i.nomor_polisi || "-",
        transportir: i.transportir || "-",
        kategoriMt: i.kategori_mt === "merah_putih" ? "MT Merah Putih" : "MT Industri",
        kapasitas: i.kapasitas_mt || "-",
        kompartemen: i.jumlah_kompartemen ?? "-",
        status: bermasalah ? "Perlu Tindak Lanjut" : "Kedap / Lulus",
        jumlahFoto: foto.length,
        linkFoto: foto[0] ? "Lihat Foto" : "-",
      });
      if (foto[0]) {
        const cell = row.getCell("linkFoto");
        cell.value = { text: "Lihat Foto", hyperlink: foto[0].url };
        cell.font = LINK_FONT;
      }
      if (bermasalah) {
        row.eachCell((cell) => { cell.fill = DANGER_FILL; });
        row.getCell("status").font = DANGER_FONT;
      }
    });
  }

  // ── Sheet: Cek Random P1 ──────────────────────────────────────────────────
  if (kategori.includes("p1")) {
    const ws = wb.addWorksheet(KATEGORI_TITLE.p1);
    setupSheet(ws, [
      { header: "Tanggal",        key: "tgl",         width: 12 },
      { header: "Nomor Polisi",   key: "plat",        width: 14 },
      { header: "Transportir",    key: "transportir", width: 24 },
      { header: "Kategori MT",    key: "kategoriMt",  width: 16 },
      { header: "Jumlah Temuan",  key: "jumlahTemuan", width: 14 },
      { header: "Status",         key: "status",      width: 18 },
      { header: "Detail Temuan",  key: "detail",       width: 45 },
      { header: "Jumlah Foto",    key: "jumlahFoto",  width: 12 },
      { header: "Link Foto",      key: "linkFoto",    width: 14 },
    ], "I");

    data.p1.forEach((i) => {
      const bermasalah = isP1Bermasalah(i);
      const foto = i._foto || [];
      const row = ws.addRow({
        tgl: formatDate(i.created_at),
        plat: i.nomor_polisi || "-",
        transportir: i.transportir || "-",
        kategoriMt: i.kategori_mt === "merah_putih" ? "MT Merah Putih" : "MT Industri",
        jumlahTemuan: i.inspeksi_p1_temuan?.length || 0,
        status: bermasalah ? "Perlu Tindak Lanjut" : "Tidak Ada Temuan",
        detail: (i.inspeksi_p1_temuan || []).map((t) => t.judul).join("; ") || "-",
        jumlahFoto: foto.length,
        linkFoto: foto[0] ? "Lihat Foto" : "-",
      });
      if (foto[0]) {
        const cell = row.getCell("linkFoto");
        cell.value = { text: "Lihat Foto", hyperlink: foto[0].url };
        cell.font = LINK_FONT;
      }
      if (bermasalah) {
        row.eachCell((cell) => { cell.fill = DANGER_FILL; });
        row.getCell("status").font = DANGER_FONT;
      }
    });
  }

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const periodeSlug = periodeRange ? formatPeriodeForFilename(periodeRange.fromISO, periodeRange.toISO) : new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `Export-Inspeksi_${periodeSlug}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};