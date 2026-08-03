import { useState } from "react";
import BottomNav from "../components/BottomNav";
import Card from "../components/Card";
import Icon from "../components/Icon";
import SectionLabel from "../components/SectionLabel";
import theme from "../styles/theme";
import { useBreakpoint } from "../hooks/useBreakpoint";
import { SIDEBAR_WIDTH } from "../styles/layout";
import { getDateRangeFromPeriode, fetchExportData, computeTopKerusakan, computeRingkasan } from "../lib/exportHelper";
import { generateExcel } from "../lib/exportExcel";
import { generatePdf } from "../lib/exportPdf";

// ── Opsi kategori data ────────────────────────────────────────────────────────
const KATEGORI_OPTIONS = [
  { key: "gps", label: "GPS & CCTV",    icon: "gps",    color: theme.primary, bg: theme.primaryLight },
  { key: "hse", label: "Uji Kedap MT",  icon: "shield", color: "#D97706",     bg: "#FEF3C7" },
  { key: "p1",  label: "Cek Random P1", icon: "p1",     color: "#7C3AED",     bg: "#EDE9FE" },
];

// ── Opsi rentang waktu ─────────────────────────────────────────────────────────
const PERIODE_OPTIONS = [
  { key: "minggu_ini", label: "Minggu Ini" },
  { key: "bulan_ini",  label: "Bulan Ini" },
  { key: "6_bulan",    label: "6 Bulan Terakhir" },
  { key: "custom",     label: "Custom" },
];

// ── Kartu pilihan dengan checkbox (dipakai untuk kategori & format) ─────────────
const SelectCard = ({ active, onClick, icon, iconColor, iconBg, label, sublabel, isDesktop }) => (
  <div
    onClick={onClick}
    style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: isDesktop ? "16px 16px" : "14px 14px",
      borderRadius: 14, cursor: "pointer",
      border: `1.5px solid ${active ? theme.primary : theme.border}`,
      background: active ? theme.primaryLight : theme.surface,
      transition: "border-color 0.15s, background 0.15s",
    }}
  >
    <div style={{
      width: 40, height: 40, borderRadius: 10, flexShrink: 0,
      background: iconBg, display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <Icon name={icon} size={18} color={iconColor} />
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 13.5, fontWeight: 700, color: theme.text }}>{label}</div>
      {sublabel && <div style={{ fontSize: 11.5, color: theme.textMuted, marginTop: 1 }}>{sublabel}</div>}
    </div>
    <div style={{
      width: 20, height: 20, borderRadius: 6, flexShrink: 0,
      border: `1.5px solid ${active ? theme.primary : theme.border}`,
      background: active ? theme.primary : "transparent",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      {active && <Icon name="check" size={12} color="#fff" />}
    </div>
  </div>
);

// ── Pill pilihan tunggal (dipakai untuk periode) ────────────────────────────────
const SelectPill = ({ active, onClick, label, isDesktop }) => (
  <div
    onClick={onClick}
    style={{
      padding: isDesktop ? "10px 18px" : "9px 14px",
      borderRadius: 20, fontSize: 12.5, fontWeight: 700, cursor: "pointer",
      whiteSpace: "nowrap",
      background: active ? theme.primary : theme.surfaceAlt,
      color: active ? "#fff" : theme.textMuted,
      boxShadow: active ? `0 2px 6px ${theme.primary}55` : "none",
      transition: "all 0.15s",
    }}
  >
    {label}
  </div>
);

// ── ExportScreen ────────────────────────────────────────────────────────────────
const ExportScreen = ({ onNav, onBack }) => {
  const isDesktop = useBreakpoint();

  const [kategori, setKategori] = useState(["gps", "hse", "p1"]); // default: semua dicentang
  const [periode, setPeriode]   = useState("bulan_ini");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo]     = useState("");
  const [sertakanFoto, setSertakanFoto] = useState(true);
  const [format, setFormat]     = useState("excel"); // "excel" | "pdf"
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(null); // { done, total, label } — khusus PDF+foto

  const toggleKategori = (key) => {
    setKategori((prev) => prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]);
  };

  const isValid = kategori.length > 0 && (periode !== "custom" || (customFrom && customTo));

  const handleGenerate = async () => {
    setGenerating(true);
    setProgress(null);
    try {
      const { fromISO, toISO } = getDateRangeFromPeriode(periode, customFrom, customTo);
      const exportData = await fetchExportData({ kategori, fromISO, toISO });

      const totalRows = kategori.reduce((sum, k) => sum + (exportData[k]?.length || 0), 0);
      if (totalRows === 0) {
        alert("Tidak ada data pada periode & kategori yang dipilih. Coba ubah filter.");
        return;
      }

      const topKerusakan = computeTopKerusakan(exportData);
      const ringkasan = computeRingkasan(exportData);
      const periodeObj = PERIODE_OPTIONS.find((p) => p.key === periode);
      const periodeLabel = periode === "custom"
        ? `${periodeObj?.label} (${customFrom} s/d ${customTo})`
        : periodeObj?.label;

      if (format === "excel") {
        generateExcel({ data: exportData, topKerusakan, ringkasan, periodeLabel, kategori });
      } else {
        await generatePdf({
          data: exportData,
          topKerusakan,
          ringkasan,
          periodeLabel,
          kategori,
          sertakanFoto,
          onProgress: (done, total, label) => setProgress({ done, total, label }),
        });
      }
    } catch (err) {
      console.error("Export error:", err);
      alert("Gagal membuat file: " + (err.message || "Terjadi kesalahan tak terduga."));
    } finally {
      setGenerating(false);
      setProgress(null);
    }
  };

  return (
    <div style={{
      minHeight: "100vh", background: theme.bg,
      paddingBottom: isDesktop ? 0 : 80,
      marginLeft: isDesktop ? SIDEBAR_WIDTH : 0,
    }}>
      {/* Header */}
      <div style={{
        background: theme.surface, padding: isDesktop ? "24px 32px 20px" : "48px 16px 16px",
        borderBottom: `1px solid ${theme.border}`, boxShadow: theme.shadow,
      }}>
        <div
          onClick={onBack ?? (() => onNav("dashboard"))}
          style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14, cursor: "pointer", color: theme.textSub, fontSize: 13 }}
        >
          <Icon name="arrow" size={16} color={theme.textSub} /> Kembali
        </div>
        <div style={{ fontWeight: 800, fontSize: isDesktop ? 22 : 19, color: theme.text }}>Export Data</div>
        <div style={{ fontSize: 13, color: theme.textMuted, marginTop: 2 }}>
          Unduh data inspeksi untuk keperluan audit, rekap, atau presentasi
        </div>
      </div>

      {/* Content */}
      <div style={{
        padding: isDesktop ? "24px 32px" : "20px 16px",
        maxWidth: isDesktop ? 760 : "none",
      }}>
        {/* Kategori data */}
        <SectionLabel style={{ marginBottom: 10 }}>1. Kategori Data</SectionLabel>
        <div style={{
          display: "grid",
          gridTemplateColumns: isDesktop ? "repeat(3, 1fr)" : "1fr",
          gap: 10, marginBottom: 24,
        }}>
          {KATEGORI_OPTIONS.map((k) => (
            <SelectCard
              key={k.key}
              active={kategori.includes(k.key)}
              onClick={() => toggleKategori(k.key)}
              icon={k.icon} iconColor={k.color} iconBg={k.bg}
              label={k.label}
              isDesktop={isDesktop}
            />
          ))}
        </div>
        {kategori.length === 0 && (
          <div style={{ fontSize: 12, color: theme.danger, fontWeight: 600, marginTop: -16, marginBottom: 20 }}>
            ⚠️ Pilih minimal 1 kategori data.
          </div>
        )}

        {/* Rentang waktu */}
        <SectionLabel style={{ marginBottom: 10 }}>2. Rentang Waktu</SectionLabel>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: periode === "custom" ? 14 : 24 }}>
          {PERIODE_OPTIONS.map((p) => (
            <SelectPill key={p.key} active={periode === p.key} onClick={() => setPeriode(p.key)} label={p.label} isDesktop={isDesktop} />
          ))}
        </div>

        {periode === "custom" && (
          <Card style={{ padding: 16, marginBottom: 24, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={{ flex: 1, minWidth: 140 }}>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: theme.textMuted, marginBottom: 6 }}>Dari tanggal</div>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                style={{
                  width: "100%", padding: "9px 10px", borderRadius: 8,
                  border: `1.5px solid ${theme.border}`, fontSize: 13,
                  fontFamily: "'DM Sans', sans-serif", color: theme.text,
                  boxSizing: "border-box", outline: "none",
                }}
              />
            </div>
            <div style={{ flex: 1, minWidth: 140 }}>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: theme.textMuted, marginBottom: 6 }}>Sampai tanggal</div>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                style={{
                  width: "100%", padding: "9px 10px", borderRadius: 8,
                  border: `1.5px solid ${theme.border}`, fontSize: 13,
                  fontFamily: "'DM Sans', sans-serif", color: theme.text,
                  boxSizing: "border-box", outline: "none",
                }}
              />
            </div>
          </Card>
        )}

        {/* Sertakan foto */}
        <SectionLabel style={{ marginBottom: 10 }}>3. Foto Dokumentasi</SectionLabel>
        <Card
          onClick={() => setSertakanFoto((v) => !v)}
          style={{
            padding: "14px 16px", marginBottom: 24, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 12,
          }}
        >
          <div style={{
            width: 40, height: 40, borderRadius: 10, flexShrink: 0,
            background: theme.surfaceAlt, display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Icon name="photo" size={18} color={theme.textMuted} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: theme.text }}>Sertakan foto dokumentasi</div>
            <div style={{ fontSize: 11.5, color: theme.textMuted, marginTop: 1 }}>
              {format === "excel"
                ? "Foto tidak disertakan di Excel — hanya tersedia untuk PDF"
                : sertakanFoto
                  ? "Foto akan disisipkan di tiap temuan (proses lebih lama)"
                  : "Hanya data teks & tabel, tanpa foto"}
            </div>
          </div>
          <div style={{
            width: 42, height: 24, borderRadius: 20, flexShrink: 0, position: "relative",
            background: (sertakanFoto && format === "pdf") ? theme.primary : theme.border,
            transition: "background 0.15s", opacity: format === "excel" ? 0.5 : 1,
          }}>
            <div style={{
              position: "absolute", top: 2, left: (sertakanFoto && format === "pdf") ? 20 : 2,
              width: 20, height: 20, borderRadius: "50%", background: "#fff",
              boxShadow: "0 1px 3px rgba(0,0,0,0.2)", transition: "left 0.15s",
            }} />
          </div>
        </Card>

        {/* Format */}
        <SectionLabel style={{ marginBottom: 10 }}>4. Format File</SectionLabel>
        <div style={{
          display: "grid", gridTemplateColumns: isDesktop ? "1fr 1fr" : "1fr",
          gap: 10, marginBottom: 28,
        }}>
          <SelectCard
            active={format === "excel"}
            onClick={() => setFormat("excel")}
            icon="file-excel" iconColor="#15803D" iconBg="#DCFCE7"
            label="Excel (.xlsx)"
            sublabel="Tabel data — cocok untuk olah angka & rekap"
            isDesktop={isDesktop}
          />
          <SelectCard
            active={format === "pdf"}
            onClick={() => setFormat("pdf")}
            icon="file-pdf" iconColor="#DC2626" iconBg="#FEE2E2"
            label="PDF"
            sublabel="Laporan siap-presentasi, bisa sertakan foto"
            isDesktop={isDesktop}
          />
        </div>

        {/* Ringkasan pilihan */}
        <Card style={{ padding: 16, marginBottom: 24, background: theme.surfaceAlt, border: "none" }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>
            Ringkasan
          </div>
          <div style={{ fontSize: 13, color: theme.text, lineHeight: 1.7 }}>
            Export <b>{kategori.length === 3 ? "semua kategori" : kategori.map((k) => KATEGORI_OPTIONS.find((o) => o.key === k)?.label).join(", ") || "—"}</b>
            {" "}untuk periode <b>{PERIODE_OPTIONS.find((p) => p.key === periode)?.label}</b>
            {periode === "custom" && customFrom && customTo && ` (${customFrom} s/d ${customTo})`}
            {", "}format <b>{format === "excel" ? "Excel" : "PDF"}</b>
            {format === "pdf" && (sertakanFoto ? " dengan foto dokumentasi" : " tanpa foto")}.
          </div>
        </Card>

        {/* Tombol generate */}
        <div
          onClick={isValid && !generating ? handleGenerate : undefined}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            padding: "14px", borderRadius: 12,
            background: isValid ? theme.primary : theme.border,
            color: "#fff", fontSize: 14, fontWeight: 700,
            cursor: isValid && !generating ? "pointer" : "not-allowed",
            opacity: generating ? 0.7 : 1,
            transition: "opacity 0.15s",
          }}
        >
          <Icon name="download" size={16} color="#fff" />
          {generating
            ? (progress ? `Memproses ${progress.label} ${progress.done}/${progress.total}...` : "Menyiapkan...")
            : "Generate & Download"}
        </div>

        {generating && progress && (
          <div style={{ marginTop: 10, fontSize: 11.5, color: theme.textMuted, textAlign: "center" }}>
            Sedang menyisipkan foto dokumentasi — mohon jangan tutup halaman ini.
          </div>
        )}
      </div>

      <BottomNav active="export" onNav={onNav} role="pertamina" userName="Pertamina" />
    </div>
  );
};

export default ExportScreen;