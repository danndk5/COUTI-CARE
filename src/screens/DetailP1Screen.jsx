import { useState, useEffect, useCallback } from "react";
import Card from "../components/Card";
import Icon from "../components/Icon";
import SectionLabel from "../components/SectionLabel";
import theme from "../styles/theme";
import { supabase } from "../lib/supabase";
import { formatDate, formatTime } from "../lib/dateHelper";

// ─── Sub-komponen ────────────────────────────────────────────────────────────

const InfoRow = ({ label, value }) => (
  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
    <span style={{ fontSize: 13, color: theme.textMuted }}>{label}</span>
    <span style={{ fontSize: 13, fontWeight: 600, color: theme.text, textAlign: "right" }}>
      {value || "-"}
    </span>
  </div>
);

const TemuanRow = ({ temuan }) => (
  <div
    style={{
      padding: "12px 14px",
      borderRadius: 10,
      background: theme.dangerLight,
      marginBottom: 8,
    }}
  >
    <div style={{ fontSize: 13, fontWeight: 700, color: theme.text }}>
      ⚠️ {temuan.judul}
    </div>
    {temuan.keterangan && (
      <div style={{ fontSize: 12, color: theme.textSub, marginTop: 6 }}>
        {temuan.keterangan}
      </div>
    )}
  </div>
);

// ─── Main Screen ─────────────────────────────────────────────────────────────

const DetailP1Screen = ({ p1Id, onBack }) => {
  const [data, setData] = useState(null);
  const [temuanList, setTemuanList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: p1Data, error: p1Error } = await supabase
        .from("inspeksi_p1")
        .select("*, inspeksi_p1_temuan(id, judul, keterangan)")
        .eq("id", p1Id)
        .single();

      if (p1Error) throw p1Error;
      setData(p1Data);
      setTemuanList(p1Data.inspeksi_p1_temuan || []);
    } catch (err) {
      setError("Gagal memuat detail. Silakan coba lagi.");
      console.error("Error loading P1 detail:", err);
    } finally {
      setLoading(false);
    }
  }, [p1Id]);

  useEffect(() => {
    if (p1Id) loadDetail();
  }, [p1Id, loadDetail]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: theme.bg, display: "flex", justifyContent: "center", alignItems: "center" }}>
        <div style={{ color: theme.textMuted }}>Memuat detail...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ minHeight: "100vh", background: theme.bg, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: 24 }}>
        <div style={{ color: theme.textMuted, marginBottom: 8 }}>
          {error ?? "Data tidak ditemukan"}
        </div>
        {error && (
          <div onClick={loadDetail} style={{ color: theme.primary, fontWeight: 700, cursor: "pointer", marginBottom: 12 }}>
            Coba Lagi
          </div>
        )}
        <div onClick={onBack} style={{ color: theme.primary, fontWeight: 700, cursor: "pointer" }}>
          ← Kembali
        </div>
      </div>
    );
  }

  // ⚠️ PENTING — bug fix (Agustus 2026):
  // Sebelumnya badge cek data.status === "selesai", tapi nilai kolom
  // `status` di tabel inspeksi_p1 tidak konsisten/tidak jelas asalnya
  // (tidak ada P1FormScreen.jsx yang bisa dipastikan nilainya). Akibatnya
  // laporan yang temuannya kosong pun tetap tampil "Perlu Tindak Lanjut".
  //
  // Sumber kebenaran yang lebih dapat diandalkan adalah data temuan itu
  // sendiri: kalau tidak ada temuan sama sekali (temuanList kosong),
  // berarti tidak ada yang perlu ditindaklanjuti — apapun nilai
  // data.status. Kalau nanti P1FormScreen.jsx sudah pasti menyimpan
  // status yang benar (misalnya "selesai" setelah ditindaklanjuti),
  // logika ini bisa disesuaikan lagi supaya tetap menghormati status
  // "sudah ditindaklanjuti" secara manual oleh P1, bukan cuma jumlah
  // temuan mentah.
  const belumAdaTemuan = temuanList.length === 0;
  const isSelesai = belumAdaTemuan || data.status === "selesai";
  const kategoriLabel = data.kategori_mt === "merah_putih" ? "MT Merah Putih" : "MT Industri";

  return (
    <div style={{ minHeight: "100vh", background: theme.bg, paddingBottom: 40 }}>
      {/* Header */}
      <div
        style={{
          background: theme.surface,
          padding: "48px 16px 16px",
          borderBottom: `1px solid ${theme.border}`,
          boxShadow: theme.shadow,
        }}
      >
        <div
          onClick={onBack}
          style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14, cursor: "pointer", color: theme.textSub, fontSize: 13 }}
        >
          <Icon name="arrow" size={16} color={theme.textSub} /> Kembali
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18, color: theme.text }}>{data.nomor_polisi}</div>
            <div style={{ fontSize: 13, color: theme.textMuted, marginTop: 2 }}>{data.transportir}</div>
          </div>
          <div
            style={{
              fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: 20,
              background: isSelesai ? theme.successLight : theme.dangerLight,
              color: isSelesai ? theme.success : theme.danger,
            }}
          >
            {isSelesai ? "✓ Tidak Ada Temuan" : "⚠️ Perlu Tindak Lanjut"}
          </div>
        </div>
      </div>

      <div style={{ padding: "20px 16px" }}>
        {/* Info Kendaraan */}
        <SectionLabel>Informasi Kendaraan</SectionLabel>
        <Card style={{ marginBottom: 20, padding: 16 }}>
          <InfoRow label="Transportir" value={data.transportir} />
          <InfoRow label="Kapasitas MT" value={data.kapasitas_mt} />
          <InfoRow label="Jumlah Kompartemen" value={data.jumlah_kompartemen} />
          <InfoRow label="Kategori MT" value={kategoriLabel} />
          <InfoRow
            label="Tanggal & Jam"
            value={`${formatDate(data.created_at)} · ${formatTime(data.created_at)}`}
          />
        </Card>

        {/* Temuan */}
        <SectionLabel>Temuan ({temuanList.length})</SectionLabel>
        {temuanList.length > 0 ? (
          temuanList.map((t) => <TemuanRow key={t.id} temuan={t} />)
        ) : (
          <Card style={{ padding: "20px 16px", textAlign: "center" }}>
            <div style={{ fontSize: 13, color: theme.textMuted }}>✓ Tidak ada temuan</div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default DetailP1Screen;