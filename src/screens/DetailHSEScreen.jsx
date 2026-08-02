import { useState, useEffect, useCallback } from "react";
import Card from "../components/Card";
import Icon from "../components/Icon";
import SectionLabel from "../components/SectionLabel";
import theme from "../styles/theme";
import { supabase } from "../lib/supabase";
import { formatDate, formatTime } from "../lib/dateHelper";

// ⚠️ PENTING — bug fix (Agustus 2026):
// Tabel `inspeksi_hse` menyimpan status hasil uji kedap sebagai
// "lulus" / "tidak_lulus" (lihat HSEFormScreen.jsx), BUKAN "selesai".
// Jangan cek data.status === "selesai" di sini — itu nilai yang tidak
// pernah ada di tabel ini, sehingga badge selalu tampil salah
// ("Perlu Tindak Lanjut") walaupun hasil uji kedap sudah lulus.
const HSE_LULUS = "lulus";

// ─── Sub-komponen ────────────────────────────────────────────────────────────

const InfoRow = ({ label, value }) => (
  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
    <span style={{ fontSize: 13, color: theme.textMuted }}>{label}</span>
    <span style={{ fontSize: 13, fontWeight: 600, color: theme.text, textAlign: "right" }}>
      {value || "-"}
    </span>
  </div>
);

const CheckpointRow = ({ checkpoint }) => {
  const isKedap = checkpoint.status?.toLowerCase() === "kedap";
  return (
    <div
      style={{
        padding: "12px 14px",
        borderRadius: 10,
        background: isKedap ? theme.successLight : theme.dangerLight,
        marginBottom: 8,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: theme.text }}>
          Menit ke-{checkpoint.menit ?? "-"}
        </div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            padding: "3px 10px",
            borderRadius: 20,
            background: isKedap ? theme.success : theme.danger,
            color: "#fff",
          }}
        >
          {isKedap ? "✓ Kedap" : "⚠️ Tidak Kedap"}
        </div>
      </div>

      {checkpoint.foto_url && (
        <a
          href={checkpoint.foto_url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: "block", marginTop: 10 }}
        >
          <img
            src={checkpoint.foto_url}
            alt={`Foto menit ke-${checkpoint.menit}`}
            style={{
              width: "100%",
              maxWidth: 200,
              height: 110,
              objectFit: "cover",
              borderRadius: 10,
              border: `1px solid ${theme.border}`,
            }}
          />
        </a>
      )}
    </div>
  );
};

const TemuanFotoCard = ({ foto }) => (
  <div
    style={{
      borderRadius: 10,
      background: theme.dangerLight,
      marginBottom: 8,
      overflow: "hidden",
    }}
  >
    <a href={foto.url} target="_blank" rel="noopener noreferrer" style={{ display: "block" }}>
      <img
        src={foto.url}
        alt="Foto temuan"
        style={{ width: "100%", height: 160, objectFit: "cover" }}
      />
    </a>
    {foto.keterangan && (
      <div style={{ padding: "10px 12px", fontSize: 12, color: theme.textSub }}>
        {foto.keterangan}
      </div>
    )}
  </div>
);

// ─── Main Screen ─────────────────────────────────────────────────────────────

const DetailHSEScreen = ({ hseId, onBack }) => {
  const [data, setData] = useState(null);
  const [checkpoints, setCheckpoints] = useState([]);
  const [temuanFoto, setTemuanFoto] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: hseData, error: hseError } = await supabase
        .from("inspeksi_hse")
        .select("*")
        .eq("id", hseId)
        .single();

      if (hseError) throw hseError;
      setData(hseData);

      const { data: checkpointData, error: checkpointError } = await supabase
        .from("inspeksi_hse_checkpoint")
        .select("*")
        .eq("inspeksi_hse_id", hseId)
        .order("menit", { ascending: true });

      if (checkpointError) throw checkpointError;
      setCheckpoints(checkpointData || []);

      const { data: temuanData, error: temuanError } = await supabase
        .from("foto_inspeksi_hse")
        .select("*")
        .eq("inspeksi_hse_id", hseId);

      if (temuanError) throw temuanError;
      setTemuanFoto(temuanData || []);
    } catch (err) {
      setError("Gagal memuat detail. Silakan coba lagi.");
      console.error("Error loading HSE detail:", err);
    } finally {
      setLoading(false);
    }
  }, [hseId]);

  useEffect(() => {
    if (hseId) loadDetail();
  }, [hseId, loadDetail]);

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

  // FIX: cek "lulus", bukan "selesai" — lihat catatan di atas
  const isLulus = data.status === HSE_LULUS;
  const tidakKedapCount = checkpoints.filter((c) => c.status?.toLowerCase() !== "kedap").length;
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
              background: isLulus ? theme.successLight : theme.dangerLight,
              color: isLulus ? theme.success : theme.danger,
            }}
          >
            {isLulus ? "✓ Kedap / Lulus" : "⚠️ Perlu Tindak Lanjut"}
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

        {/* Ringkasan Checkpoint */}
        <SectionLabel>Hasil Checkpoint Uji Kedap</SectionLabel>
        <Card style={{ marginBottom: 16, padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-around", textAlign: "center" }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: theme.primary }}>{checkpoints.length}</div>
              <div style={{ fontSize: 11, color: theme.textMuted, fontWeight: 600 }}>Total Checkpoint</div>
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: theme.danger }}>{tidakKedapCount}</div>
              <div style={{ fontSize: 11, color: theme.textMuted, fontWeight: 600 }}>Tidak Kedap</div>
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: theme.success }}>
                {checkpoints.length - tidakKedapCount}
              </div>
              <div style={{ fontSize: 11, color: theme.textMuted, fontWeight: 600 }}>Kedap</div>
            </div>
          </div>
        </Card>

        {checkpoints.length > 0 ? (
          checkpoints.map((cp) => <CheckpointRow key={cp.id} checkpoint={cp} />)
        ) : (
          <Card style={{ padding: "20px 16px", textAlign: "center" }}>
            <div style={{ fontSize: 13, color: theme.textMuted }}>Belum ada data checkpoint</div>
          </Card>
        )}

        {/* Foto Temuan (khusus checkpoint yang tidak kedap) */}
        {temuanFoto.length > 0 && (
          <>
            <SectionLabel style={{ marginTop: 20 }}>Foto Temuan ({temuanFoto.length})</SectionLabel>
            {temuanFoto.map((f) => (
              <TemuanFotoCard key={f.id} foto={f} />
            ))}
          </>
        )}
      </div>
    </div>
  );
};

export default DetailHSEScreen;