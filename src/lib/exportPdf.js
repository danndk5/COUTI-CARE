import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatDate, formatTime } from "./dateHelper";
import { isGpsAbnormal, isHseBermasalah, isP1Bermasalah } from "./exportHelper";

const KATEGORI_TITLE = {
  gps: "GPS & CCTV",
  hse: "Uji Kedap MT",
  p1:  "Cek Random P1",
};

// Convert URL foto (Supabase Storage, public) jadi base64 supaya bisa ditempel ke PDF.
// Kalau gagal fetch (network/CORS), return null — foto itu dilewati saja, tidak menghentikan proses.
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

export const generatePdf = async ({ data, topKerusakan, ringkasan, periodeLabel, kategori, sertakanFoto, onProgress }) => {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth  = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const bottomLimit = pageHeight - 50;
  let y = margin;

  // ── Cover / Header laporan ──────────────────────────────────────────────
  doc.setFontSize(18); doc.setFont(undefined, "bold");
  doc.text("Laporan Inspeksi — GPS & CCTV Checker", margin, y); y += 22;
  doc.setFontSize(10); doc.setFont(undefined, "normal"); doc.setTextColor(100);
  doc.text(`Periode: ${periodeLabel}`, margin, y); y += 14;
  doc.text(`Digenerate: ${new Date().toLocaleString("id-ID")}`, margin, y); y += 26;
  doc.setTextColor(0);

  // ── Ringkasan ────────────────────────────────────────────────────────────
  doc.setFontSize(13); doc.setFont(undefined, "bold");
  doc.text("Ringkasan", margin, y); y += 8;
  const ringkasanBody = [];
  if (kategori.includes("gps")) ringkasanBody.push([KATEGORI_TITLE.gps, ringkasan.gps.total, ringkasan.gps.bermasalah]);
  if (kategori.includes("hse")) ringkasanBody.push([KATEGORI_TITLE.hse, ringkasan.hse.total, ringkasan.hse.bermasalah]);
  if (kategori.includes("p1"))  ringkasanBody.push([KATEGORI_TITLE.p1,  ringkasan.p1.total,  ringkasan.p1.bermasalah]);
  autoTable(doc, {
    startY: y,
    head: [["Kategori", "Total Diperiksa", "Perlu Tindak Lanjut"]],
    body: ringkasanBody,
    margin: { left: margin, right: margin },
    styles: { fontSize: 9, cellPadding: 6 },
    headStyles: { fillColor: [30, 58, 138] },
  });
  y = doc.lastAutoTable.finalY + 26;

  // ── Kendaraan paling sering bermasalah ────────────────────────────────────
  if (topKerusakan.length > 0) {
    if (y > bottomLimit - 100) { doc.addPage(); y = margin; }
    doc.setFontSize(13); doc.setFont(undefined, "bold");
    doc.text("Kendaraan Paling Sering Bermasalah", margin, y); y += 8;
    autoTable(doc, {
      startY: y,
      head: [["Nomor Polisi", "Transportir", "GPS & CCTV", "Uji Kedap MT", "Cek Random P1", "Total"]],
      body: topKerusakan.map((k) => [k.nomor_polisi, k.transportir, k.gps, k.hse, k.p1, k.total]),
      margin: { left: margin, right: margin },
      styles: { fontSize: 9, cellPadding: 6 },
      headStyles: { fillColor: [30, 58, 138] },
    });
    y = doc.lastAutoTable.finalY + 10;
  }

  // ── Hitung total item untuk progress bar (kalau sertakan foto) ───────────
  const totalItems = kategori.reduce((sum, k) => sum + (data[k]?.length || 0), 0);
  let processed = 0;

  // ── Detail per kategori ────────────────────────────────────────────────
  for (const kat of kategori) {
    const list = data[kat] || [];
    if (list.length === 0) continue;

    doc.addPage();
    y = margin;
    doc.setFontSize(15); doc.setFont(undefined, "bold"); doc.setTextColor(0);
    doc.text(`Detail — ${KATEGORI_TITLE[kat]} (${list.length} laporan)`, margin, y);
    y += 24;

    for (const item of list) {
      processed += 1;
      onProgress?.(processed, totalItems, KATEGORI_TITLE[kat]);

      if (y > bottomLimit - 60) { doc.addPage(); y = margin; }

      doc.setFontSize(11); doc.setFont(undefined, "bold"); doc.setTextColor(0);
      doc.text(item.nomor_polisi || "-", margin, y); y += 14;

      doc.setFontSize(9); doc.setFont(undefined, "normal"); doc.setTextColor(90);
      const subInfo = `${formatDate(item.created_at)} ${formatTime(item.created_at) || ""} · ${item.perusahaan_transportir || item.transportir || "-"}`;
      doc.text(subInfo, margin, y); y += 13;

      const bermasalah = isBermasalah(kat, item);
      doc.setFont(undefined, "bold");
      doc.setTextColor(bermasalah ? 200 : 20, bermasalah ? 40 : 130, bermasalah ? 40 : 60);
      doc.text(statusLabel(kat, item), margin, y);
      doc.setTextColor(0); doc.setFont(undefined, "normal");
      y += 14;

      // Detail temuan teks (khusus P1)
      if (kat === "p1" && item.inspeksi_p1_temuan?.length > 0) {
        doc.setFontSize(9);
        for (const t of item.inspeksi_p1_temuan) {
          if (y > bottomLimit - 20) { doc.addPage(); y = margin; }
          const line = `• ${t.judul}${t.keterangan ? " — " + t.keterangan : ""}`;
          const wrapped = doc.splitTextToSize(line, pageWidth - margin * 2 - 10);
          doc.text(wrapped, margin + 6, y);
          y += wrapped.length * 11 + 2;
        }
        y += 4;
      }

      // Foto dokumentasi
      const fotoList = item._foto || [];
      if (sertakanFoto && fotoList.length > 0) {
        const imgSize = 85;
        const gap = 8;
        let x = margin;

        for (const f of fotoList) {
          if (x + imgSize > pageWidth - margin) { x = margin; y += imgSize + gap; }
          if (y + imgSize > bottomLimit) { doc.addPage(); y = margin; x = margin; }

          const base64 = await urlToBase64(f.url);
          if (base64) {
            const fmt = base64.includes("image/png") ? "PNG" : "JPEG";
            try {
              doc.addImage(base64, fmt, x, y, imgSize, imgSize);
            } catch {
              // lewati foto yang gagal diproses, jangan hentikan seluruh laporan
            }
          } else {
            doc.setDrawColor(220);
            doc.rect(x, y, imgSize, imgSize);
            doc.setFontSize(7); doc.setTextColor(150);
            doc.text("Foto gagal dimuat", x + 6, y + imgSize / 2);
            doc.setTextColor(0);
          }
          x += imgSize + gap;
        }
        y += imgSize + gap + 8;
      }

      y += 6;
      doc.setDrawColor(225);
      doc.line(margin, y, pageWidth - margin, y);
      y += 16;
    }
  }

  const filename = `Laporan-Inspeksi-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
};