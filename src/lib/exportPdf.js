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
// Kalau gagal fetch (network/CORS), return null — foto itu dilewati, tidak menghentikan proses.
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

// ── Bangun 1 dokumen PDF lengkap untuk 1 laporan (1 kendaraan, 1 pemeriksaan) ───
const buildSingleItemPdf = async ({ kat, item, sertakanFoto }) => {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth  = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const bottomLimit = pageHeight - 50;
  let y = margin;

  // ── Header ──
  doc.setFontSize(12); doc.setFont(undefined, "normal"); doc.setTextColor(120);
  doc.text(`Laporan ${KATEGORI_TITLE[kat]}`, margin, y); y += 20;

  doc.setFontSize(22); doc.setFont(undefined, "bold"); doc.setTextColor(0);
  doc.text(item.nomor_polisi || "-", margin, y); y += 26;

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
  doc.roundedRect(margin, y - 12, 220, 24, 4, 4, "F");
  doc.setFontSize(11); doc.setFont(undefined, "bold");
  doc.setTextColor(bermasalah ? 190 : 21, bermasalah ? 30 : 128, bermasalah ? 45 : 61);
  doc.text(`Status: ${statusLabel(kat, item)}`, margin + 10, y + 4);
  doc.setTextColor(0); doc.setFont(undefined, "normal");
  y += 32;

  // ── Detail temuan (khusus P1) ──
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

  // ── Ringkasan checkpoint (khusus HSE) ──
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
    y += 10;
  }

  // ── Foto dokumentasi ──
  const fotoList = sertakanFoto ? (item._foto || []) : [];
  if (fotoList.length > 0) {
    if (y + 20 > bottomLimit) { doc.addPage(); y = margin; }
    doc.setFontSize(11); doc.setFont(undefined, "bold");
    doc.text(`Foto Dokumentasi (${fotoList.length}):`, margin, y); y += 18;

    const imgSize = 115;
    const gap = 12;
    let x = margin;

    for (const f of fotoList) {
      if (x + imgSize > pageWidth - margin) { x = margin; y += imgSize + 22; }
      if (y + imgSize + 18 > bottomLimit) { doc.addPage(); y = margin; x = margin; }

      const base64 = await urlToBase64(f.url);
      if (base64) {
        const fmt = base64.includes("image/png") ? "PNG" : "JPEG";
        try { doc.addImage(base64, fmt, x, y, imgSize, imgSize); }
        catch { /* lewati foto yang gagal diproses */ }
      } else {
        doc.setDrawColor(220);
        doc.rect(x, y, imgSize, imgSize);
        doc.setFontSize(7); doc.setTextColor(150);
        doc.text("Gagal dimuat", x + 8, y + imgSize / 2);
        doc.setTextColor(0);
      }
      if (f.label) {
        doc.setFontSize(7.5); doc.setTextColor(100);
        const capLines = doc.splitTextToSize(f.label, imgSize);
        doc.text(capLines, x, y + imgSize + 11);
        doc.setTextColor(0);
      }
      x += imgSize + gap;
    }
  } else if (sertakanFoto) {
    doc.setFontSize(9); doc.setTextColor(140);
    doc.text("Tidak ada foto dokumentasi untuk laporan ini.", margin, y);
    doc.setTextColor(0);
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