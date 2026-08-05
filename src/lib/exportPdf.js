import jsPDF from "jspdf";
import JSZip from "jszip";
import { formatDate, formatTime } from "./dateHelper";
import { isGpsAbnormal, isHseBermasalah, isP1Bermasalah } from "./exportHelper";

const KATEGORI_TITLE = {
  gps: "GPS & CCTV",
  hse: "Uji Kedap MT",
  p1:  "Cek Random P1",
};

// Convert URL foto (Supabase Storage, public) jadi base64 supaya bisa ditempel ke PDF.
const urlToBase64 = async (url) => {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
};

// Ambil dimensi asli foto (supaya bisa ditempatkan tanpa distorsi/gepeng)
const getImageDims = (base64) => new Promise((resolve) => {
  const img = new Image();
  img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
  img.onerror = () => resolve(null);
  img.src = base64;
});

const statusLabel = (kat, item) => {
  if (kat === "gps") return isGpsAbnormal(item) ? "Abnormal — Perlu Tindak Lanjut" : "Normal";
  if (kat === "hse") return isHseBermasalah(item) ? "Perlu Tindak Lanjut" : "Kedap / Lulus";
  if (kat === "p1")  return isP1Bermasalah(item) ? "Perlu Tindak Lanjut" : "Tidak Ada Temuan";
  return "-";
};

const isBermasalah = (kat, item) => {
  if (kat === "gps") return isGpsAbnormal(item);
  if (kat === "hse") return isHseBermasalah(item);
  if (kat === "p1")  return isP1Bermasalah(item);
  return false;
};

const sanitizeFilename = (s) => (s || "unknown").toString().replace(/[^a-zA-Z0-9]+/g, "_");

// ── Kop surat + judul, dipanggil di setiap halaman baru ─────────────────────────
// NOTE: logo masih placeholder kotak kosong. Kalau nanti ada file logo resmi
// Pertamina, tinggal ganti bagian doc.rect(...) di bawah dengan doc.addImage(...).
const drawKopSurat = (doc, pageWidth, margin, judul) => {
  let ky = margin;
  const logoSize = 52;

  doc.setDrawColor(0);
  doc.setLineWidth(1);
  doc.rect(margin, ky, logoSize, logoSize);
  doc.setFontSize(7); doc.setTextColor(160);
  doc.text("LOGO", margin + logoSize / 2 - 10, ky + logoSize / 2 + 3);
  doc.setTextColor(0);

  const textX = margin + logoSize + 14;
  let ty = ky + 12;
  doc.setFontSize(12); doc.setFont(undefined, "bold");
  doc.text("PT PERTAMINA (PERSERO)", textX, ty); ty += 14;
  doc.setFontSize(9); doc.setFont(undefined, "bold");
  doc.text("DEPOT — MONITOR & AUDIT GPS, CCTV, UJI KEDAP MT & CEK RANDOM P1", textX, ty); ty += 12;
  doc.setFontSize(8); doc.setFont(undefined, "normal"); doc.setTextColor(100);
  doc.text("Dokumen Internal — Tidak untuk disebarluaskan", textX, ty);
  doc.setTextColor(0);

  ky += logoSize + 8;
  doc.setLineWidth(1.4);
  doc.line(margin, ky, pageWidth - margin, ky);
  ky += 3;
  doc.setLineWidth(0.6);
  doc.line(margin, ky, pageWidth - margin, ky);
  ky += 18;

  doc.setFontSize(12); doc.setFont(undefined, "bold");
  const titleWidth = doc.getTextWidth(judul);
  doc.text(judul, (pageWidth - titleWidth) / 2, ky);
  ky += 16;

  doc.setFont(undefined, "normal");
  return ky;
};

// ── Halaman info & status (halaman pertama tiap laporan) ────────────────────────
const drawInfoPage = (doc, { kat, item }, pageWidth, margin, bottomLimit) => {
  let y = drawKopSurat(doc, pageWidth, margin, `LAPORAN INSPEKSI — ${KATEGORI_TITLE[kat].toUpperCase()}`);
  y += 6;

  doc.setFontSize(20); doc.setFont(undefined, "bold"); doc.setTextColor(0);
  doc.text(item.nomor_polisi || "-", margin, y); y += 24;

  doc.setFontSize(10); doc.setFont(undefined, "normal"); doc.setTextColor(90);
  doc.text(`Tanggal Pemeriksaan : ${formatDate(item.created_at)} ${formatTime(item.created_at) || ""}`, margin, y); y += 15;
  doc.text(`Transportir         : ${item.perusahaan_transportir || item.transportir || "-"}`, margin, y); y += 15;
  doc.text(`Diperiksa Oleh      : ${item._pemeriksa || "-"}`, margin, y); y += 15;
  if (item.kategori_mt) {
    doc.text(`Kategori MT         : ${item.kategori_mt === "merah_putih" ? "MT Merah Putih" : "MT Industri"}`, margin, y); y += 15;
  }
  if (item.kapasitas_mt) {
    doc.text(`Kapasitas           : ${item.kapasitas_mt} · ${item.jumlah_kompartemen ?? "-"} kompartemen`, margin, y); y += 15;
  }
  if (item.nama_armada) {
    doc.text(`Nama Armada         : ${item.nama_armada}`, margin, y); y += 15;
  }
  y += 8;
  doc.setTextColor(0);

  const bermasalah = isBermasalah(kat, item);
  doc.setFillColor(bermasalah ? 254 : 220, bermasalah ? 226 : 252, bermasalah ? 226 : 231);
  doc.roundedRect(margin, y - 12, 230, 24, 4, 4, "F");
  doc.setFontSize(11); doc.setFont(undefined, "bold");
  doc.setTextColor(bermasalah ? 190 : 21, bermasalah ? 30 : 128, bermasalah ? 45 : 61);
  doc.text(`Status: ${statusLabel(kat, item)}`, margin + 10, y + 4);
  doc.setTextColor(0); doc.setFont(undefined, "normal");
  y += 34;

  if (kat === "p1" && item.inspeksi_p1_temuan?.length > 0) {
    doc.setFontSize(11); doc.setFont(undefined, "bold");
    doc.text("Temuan:", margin, y); y += 15;
    doc.setFontSize(9); doc.setFont(undefined, "normal");
    for (const t of item.inspeksi_p1_temuan) {
      const line = `• ${t.judul}${t.keterangan ? " — " + t.keterangan : ""}`;
      const wrapped = doc.splitTextToSize(line, pageWidth - margin * 2 - 10);
      if (y + wrapped.length * 11 > bottomLimit) { doc.addPage(); y = margin; }
      doc.text(wrapped, margin + 6, y);
      y += wrapped.length * 11 + 3;
    }
    y += 10;
  }

  if (kat === "hse" && item._checkpoints?.length > 0) {
    doc.setFontSize(11); doc.setFont(undefined, "bold");
    doc.text("Checkpoint Uji Kedap:", margin, y); y += 15;
    doc.setFontSize(9); doc.setFont(undefined, "normal");
    for (const cp of item._checkpoints) {
      const line = `Menit ke-${cp.menit ?? "-"}: ${cp.status || "-"}`;
      if (y + 12 > bottomLimit) { doc.addPage(); y = margin; }
      doc.text(line, margin + 6, y);
      y += 12;
    }
  }
};

// ── Halaman dokumentasi foto — format tabel: foto besar | keterangan ────────────
// 3 baris per halaman, kop surat + judul di tiap halaman, mengikuti format
// dokumentasi resmi standar (kop instansi + tabel foto|keterangan bergaris).
const drawFotoPages = async (doc, { kat, item, fotoList }, pageWidth, pageHeight, margin) => {
  const ROWS_PER_PAGE = 3;

  for (let idx = 0; idx < fotoList.length; idx += ROWS_PER_PAGE) {
    doc.addPage();
    const tableTop = drawKopSurat(doc, pageWidth, margin, `DOKUMENTASI FOTO — ${item.nomor_polisi || "-"}`) + 4;
    const batch = fotoList.slice(idx, idx + ROWS_PER_PAGE);

    const tableLeft  = margin;
    const tableRight = pageWidth - margin;
    const tableWidth = tableRight - tableLeft;
    const photoColW  = tableWidth * 0.62;
    const rowHeight  = (pageHeight - margin - tableTop) / ROWS_PER_PAGE;
    const tableBottom = tableTop + rowHeight * batch.length;

    // Border luar tabel + garis vertikal pemisah foto|keterangan
    doc.setDrawColor(0); doc.setLineWidth(1);
    doc.rect(tableLeft, tableTop, tableWidth, tableBottom - tableTop);
    doc.line(tableLeft + photoColW, tableTop, tableLeft + photoColW, tableBottom);

    for (let r = 0; r < batch.length; r += 1) {
      const rowTop = tableTop + r * rowHeight;
      if (r > 0) doc.line(tableLeft, rowTop, tableRight, rowTop);

      const f = batch[r];
      const cellPad = 10;
      const boxX = tableLeft + cellPad;
      const boxY = rowTop + cellPad;
      const boxW = photoColW - cellPad * 2;
      const boxH = rowHeight - cellPad * 2;

      const base64 = await urlToBase64(f.url);
      if (base64) {
        const dims = await getImageDims(base64);
        let dW = boxW, dH = boxH;
        if (dims && dims.w > 0 && dims.h > 0) {
          const ratio = dims.w / dims.h;
          dW = boxW; dH = dW / ratio;
          if (dH > boxH) { dH = boxH; dW = dH * ratio; }
        }
        const offsetX = boxX + (boxW - dW) / 2;
        const offsetY = boxY + (boxH - dH) / 2;
        const fmt = base64.includes("image/png") ? "PNG" : "JPEG";
        try { doc.addImage(base64, fmt, offsetX, offsetY, dW, dH); }
        catch { /* lewati foto yang gagal diproses */ }
      } else {
        doc.setFontSize(8); doc.setTextColor(150);
        doc.text("Foto gagal dimuat", boxX + boxW / 2 - 32, boxY + boxH / 2);
        doc.setTextColor(0);
      }

      // Keterangan — center horizontal & vertikal di kolom kanan
      const descWidth = tableWidth - photoColW - 24;
      const descCenterX = tableLeft + photoColW + 12 + descWidth / 2;
      doc.setFontSize(9.5); doc.setFont(undefined, "normal"); doc.setTextColor(30);
      const capLines = doc.splitTextToSize(f.label || "-", descWidth);
      const textBlockH = capLines.length * 12;
      const textY = rowTop + (rowHeight - textBlockH) / 2 + 9;
      doc.text(capLines, descCenterX, textY, { align: "center" });
      doc.setTextColor(0);
    }
  }
};

// ── Bangun 1 dokumen PDF lengkap untuk 1 laporan (1 kendaraan, 1 pemeriksaan) ───
const buildSingleItemPdf = async ({ kat, item, sertakanFoto }) => {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth  = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 35;
  const bottomLimit = pageHeight - 50;

  drawInfoPage(doc, { kat, item }, pageWidth, margin, bottomLimit);

  const fotoList = sertakanFoto ? (item._foto || []) : [];
  if (fotoList.length > 0) {
    await drawFotoPages(doc, { kat, item, fotoList }, pageWidth, pageHeight, margin);
  }

  return doc;
};

// ── Generate 1 PDF per laporan, dibungkus jadi 1 file .zip untuk didownload ─────
export const generatePdfPerItem = async ({ data, kategori, sertakanFoto, onProgress }) => {
  const zip = new JSZip();
  const totalItems = kategori.reduce((sum, k) => sum + (data[k]?.length || 0), 0);
  let processed = 0;

  for (const kat of kategori) {
    const list = data[kat] || [];
    if (list.length === 0) continue;

    const folder = zip.folder(KATEGORI_TITLE[kat].replace(/[^a-zA-Z0-9]+/g, "_"));

    for (const item of list) {
      processed += 1;
      onProgress?.(processed, totalItems, KATEGORI_TITLE[kat]);

      const doc = await buildSingleItemPdf({ kat, item, sertakanFoto });
      const blob = doc.output("blob");
      const dateStr = (item.created_at || "").slice(0, 10);
      const filename = `${sanitizeFilename(item.nomor_polisi)}_${dateStr}_${item.id}.pdf`;
      folder.file(filename, blob);
    }
  }

  const zipBlob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(zipBlob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Laporan-Inspeksi-${new Date().toISOString().slice(0, 10)}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};