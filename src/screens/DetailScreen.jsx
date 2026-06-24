import { useState, useEffect, useCallback } from "react";
import Badge from "../components/Badge";
import Btn from "../components/Btn";
import Card from "../components/Card";
import Icon from "../components/Icon";
import SectionLabel from "../components/SectionLabel";
import HealthBadge from "../components/HealthBadge";
import theme from "../styles/theme";
import { supabase } from "../lib/supabase";
import { calculateHealthScore, getHealthStatus } from "../lib/healthScore";
import { formatDate, formatTime } from "../lib/dateHelper";
import { getStatusFromInspeksi } from "../lib/inspeksiHelper";

// ─── Sub-komponen ────────────────────────────────────────────────────────────

const StatusRow = ({ label, status, ket }) => {
  const isNormal = status?.toLowerCase() === "normal";
  return (
    <div
      style={{
        padding: "12px 14px",
        borderRadius: 10,
        background: isNormal ? theme.successLight : theme.dangerLight,
        marginBottom: 8,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: theme.text }}>{label}</div>
        <div
          style={{
            fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
            background: isNormal ? theme.success : theme.danger, color: "#fff",
          }}
        >
          {status || "-"}
        </div>
      </div>
      {ket && (
        <div style={{ fontSize: 12, color: theme.textSub, marginTop: 6, fontStyle: "italic" }}>
          "{ket}"
        </div>
      )}
    </div>
  );
};

const PhotoGrid = ({ photos, label }) => {
  if (!photos || photos.length === 0) return null;
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: theme.text, marginBottom: 8 }}>
        {label} ({photos.length} foto)
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
        {photos.map((photo, i) => (
          <a key={i} href={photo.url} target="_blank" rel="noopener noreferrer" style={{ display: "block" }}>
            <img
              src={photo.url} alt={`Foto ${i + 1}`}
              style={{ width: "100%", height: 90, objectFit: "cover", borderRadius: 10, border: `1px solid ${theme.border}` }}
            />
            <div style={{ fontSize: 10, color: theme.textMuted, marginTop: 4, textAlign: "center" }}>
              {new Date(photo.timestamp_foto).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
            </div>
          </a>
        ))}
      </div>
    </div>
  );
};

// ─── Modal Assign Mekanik ────────────────────────────────────────────────────

const ModalAssign = ({ inspeksiId, onClose, onSuccess }) => {
  const [mekanikList, setMekanikList] = useState([]);
  const [selectedMekanik, setSelectedMekanik] = useState(null);
  const [catatan, setCatatan] = useState("");
  const [loadingMekanik, setLoadingMekanik] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Load daftar mekanik dari profiles
  useEffect(() => {
    const fetchMekanik = async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nama, perusahaan")
        .eq("role", "mekanik")
        .order("nama");

      if (error) {
        setError("Gagal memuat daftar mekanik.");
      } else {
        setMekanikList(data ?? []);
      }
      setLoadingMekanik(false);
    };
    fetchMekanik();
  }, []);

  const handleAssign = async () => {
    if (!selectedMekanik) {
      setError("Pilih mekanik terlebih dahulu.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Cek apakah tugas untuk inspeksi ini sudah ada
      const { data: existing } = await supabase
        .from("tugas_perbaikan")
        .select("id")
        .eq("inspeksi_id", inspeksiId)
        .maybeSingle();

      if (existing) {
        // Update tugas yang sudah ada
        const { error: updateError } = await supabase
          .from("tugas_perbaikan")
          .update({
            mekanik_id: selectedMekanik,
            catatan_pertamina: catatan.trim() || null,
            status: "ditugaskan",
            assigned_by: user.id,
            assigned_at: new Date().toISOString(),
          })
          .eq("id", existing.id);

        if (updateError) throw updateError;
      } else {
        // Buat tugas baru
        const { error: insertError } = await supabase
          .from("tugas_perbaikan")
          .insert({
            inspeksi_id: inspeksiId,
            mekanik_id: selectedMekanik,
            catatan_pertamina: catatan.trim() || null,
            status: "ditugaskan",
            assigned_by: user.id,
            assigned_at: new Date().toISOString(),
          });

        if (insertError) throw insertError;
      }

      // Update status inspeksi jadi 'ditugaskan'
      const { error: statusError } = await supabase
        .from("inspeksi")
        .update({ status: "ditugaskan" })
        .eq("id", inspeksiId);

      if (statusError) throw statusError;

      onSuccess();
    } catch (err) {
      setError("Gagal assign tugas. Silakan coba lagi.");
      console.error("Error assigning task:", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    // Backdrop
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(0,0,0,0.45)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
      }}
    >
      {/* Modal sheet */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 480,
          background: theme.surface,
          borderRadius: "20px 20px 0 0",
          padding: "24px 20px 40px",
          boxShadow: "0 -4px 24px rgba(0,0,0,0.15)",
        }}
      >
        {/* Handle bar */}
        <div style={{ width: 40, height: 4, borderRadius: 2, background: theme.border, margin: "0 auto 20px" }} />

        <div style={{ fontWeight: 800, fontSize: 17, color: theme.text, marginBottom: 4 }}>
          Tugaskan ke Mekanik
        </div>
        <div style={{ fontSize: 13, color: theme.textMuted, marginBottom: 20 }}>
          Pilih mekanik yang akan menangani perbaikan ini
        </div>

        {/* List mekanik */}
        {loadingMekanik ? (
          <div style={{ fontSize: 13, color: theme.textMuted, textAlign: "center", padding: "20px 0" }}>
            Memuat daftar mekanik...
          </div>
        ) : mekanikList.length === 0 ? (
          <div style={{ fontSize: 13, color: theme.textMuted, textAlign: "center", padding: "20px 0" }}>
            Belum ada akun mekanik terdaftar
          </div>
        ) : (
          <div style={{ marginBottom: 16 }}>
            {mekanikList.map((m) => {
              const isSelected = selectedMekanik === m.id;
              return (
                <div
                  key={m.id}
                  onClick={() => setSelectedMekanik(m.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "12px 14px", borderRadius: 12, marginBottom: 8,
                    border: `2px solid ${isSelected ? theme.primary : theme.border}`,
                    background: isSelected ? (theme.primaryLight ?? "#EEF2FF") : theme.surface,
                    cursor: "pointer", transition: "all 0.15s",
                  }}
                >
                  <div
                    style={{
                      width: 36, height: 36, borderRadius: 18,
                      background: isSelected ? theme.primary : theme.border,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 15, fontWeight: 700, color: isSelected ? "#fff" : theme.textMuted,
                      flexShrink: 0,
                    }}
                  >
                    {m.nama?.charAt(0)?.toUpperCase() ?? "?"}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: theme.text }}>{m.nama}</div>
                    <div style={{ fontSize: 12, color: theme.textMuted }}>{m.perusahaan ?? "-"}</div>
                  </div>
                  {isSelected && (
                    <div style={{ marginLeft: "auto", color: theme.primary, fontWeight: 800, fontSize: 18 }}>✓</div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Catatan opsional */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: theme.text, marginBottom: 6 }}>
            Catatan (opsional)
          </div>
          <textarea
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
            placeholder="Instruksi khusus untuk mekanik..."
            rows={3}
            style={{
              width: "100%", padding: "10px 12px", borderRadius: 10,
              border: `1.5px solid ${theme.border}`, background: theme.bg,
              color: theme.text, fontSize: 13,
              fontFamily: "'DM Sans', sans-serif",
              outline: "none", resize: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Error */}
        {error && (
          <div style={{ fontSize: 13, color: theme.danger ?? "#e53e3e", marginBottom: 12, textAlign: "center" }}>
            ⚠️ {error}
          </div>
        )}

        {/* Tombol */}
        <div style={{ display: "flex", gap: 10 }}>
          <Btn onClick={onClose} variant="ghost" style={{ flex: 1 }}>
            Batal
          </Btn>
          <Btn
            onClick={handleAssign}
            disabled={!selectedMekanik || submitting}
            style={{
              flex: 2,
              opacity: (!selectedMekanik || submitting) ? 0.6 : 1,
            }}
          >
            {submitting ? "Menugaskan..." : "Tugaskan"}
          </Btn>
        </div>
      </div>
    </div>
  );
};

// ─── Main Screen ─────────────────────────────────────────────────────────────

const DetailScreen = ({ inspeksiId, onBack, role }) => {
  const [data, setData] = useState(null);
  const [photos, setPhotos] = useState({ gps: [], cctv: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignedInfo, setAssignedInfo] = useState(null); // info tugas jika sudah pernah di-assign

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: inspeksiData, error: inspeksiError } = await supabase
        .from("inspeksi")
        .select("*")
        .eq("id", inspeksiId)
        .single();

      if (inspeksiError) throw inspeksiError;
      setData(inspeksiData);

      // Load foto
      const { data: fotoData } = await supabase
        .from("foto_inspeksi")
        .select("*")
        .eq("inspeksi_id", inspeksiId)
        .order("timestamp_foto", { ascending: true });

      if (fotoData) {
        setPhotos({
          gps: fotoData.filter((f) => f.kategori === "gps"),
          cctv: fotoData.filter((f) => f.kategori === "cctv"),
        });
      }

      // Load info tugas jika sudah di-assign (untuk tampilkan status di header)
      const { data: tugasData } = await supabase
        .from("tugas_perbaikan")
        .select("id, status, assigned_at, profiles(nama)")
        .eq("inspeksi_id", inspeksiId)
        .maybeSingle();

      if (tugasData) setAssignedInfo(tugasData);

    } catch (err) {
      setError("Gagal memuat detail. Silakan coba lagi.");
      console.error("Error loading detail:", err);
    } finally {
      setLoading(false);
    }
  }, [inspeksiId]);

  useEffect(() => {
    if (inspeksiId) loadDetail();
  }, [inspeksiId, loadDetail]);

  // ── Loading state
  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: theme.bg, display: "flex", justifyContent: "center", alignItems: "center" }}>
        <div style={{ color: theme.textMuted }}>Memuat detail...</div>
      </div>
    );
  }

  // ── Error state
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

  const health = calculateHealthScore(data);
  const overallStatusInfo = getHealthStatus(health.overall);
  const inspeksiStatus = getStatusFromInspeksi(data); // "Normal" | "Abnormal"
  const isAbnormal = inspeksiStatus === "Abnormal";
  const isPertamina = role === "pertamina";

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
            <div style={{ fontSize: 13, color: theme.textMuted, marginTop: 2 }}>{data.nama_armada}</div>
          </div>
          <div
            style={{
              fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: 20,
              background: overallStatusInfo.bg, color: overallStatusInfo.color,
            }}
          >
            {overallStatusInfo.emoji} {overallStatusInfo.label}
          </div>
        </div>

        {/* Info status tugas jika sudah di-assign */}
        {assignedInfo && (
          <div
            style={{
              marginTop: 12, padding: "8px 12px", borderRadius: 10,
              background: theme.primaryLight ?? "#EEF2FF",
              fontSize: 12, color: theme.primary, fontWeight: 600,
            }}
          >
            🔧 Sudah ditugaskan ke {assignedInfo.profiles?.nama ?? "mekanik"} ·{" "}
            <span style={{ textTransform: "capitalize" }}>{assignedInfo.status}</span>
          </div>
        )}
      </div>

      <div style={{ padding: "20px 16px" }}>
        {/* Tombol Assign — hanya untuk Pertamina & status Abnormal */}
        {isPertamina && isAbnormal && (
          <div style={{ marginBottom: 20 }}>
            <Btn
              onClick={() => setShowAssignModal(true)}
              icon="wrench"
              style={{ width: "100%" }}
            >
              {assignedInfo ? "Tugaskan Ulang ke Mekanik" : "Tugaskan ke Mekanik"}
            </Btn>
          </div>
        )}

        {/* Health Score Section */}
        <SectionLabel>Status Kesehatan Perangkat</SectionLabel>
        <Card style={{ marginBottom: 20, padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-around", alignItems: "center" }}>
            <HealthBadge score={health.gps} label="GPS" />
            <HealthBadge score={health.cctv} label="CCTV" />
            <HealthBadge score={health.overall} label="Overall" />
          </div>
        </Card>

        {/* Info Pengecekan */}
        <SectionLabel>Informasi Pengecekan</SectionLabel>
        <Card style={{ marginBottom: 20, padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ fontSize: 13, color: theme.textMuted }}>Pemeriksa</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: theme.text }}>{data.nama_pemeriksa}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ fontSize: 13, color: theme.textMuted }}>Perusahaan</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: theme.text }}>{data.perusahaan_transportir}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, color: theme.textMuted }}>Tanggal & Jam</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: theme.text }}>
              {formatDate(data.created_at)} · {formatTime(data.created_at)}
            </span>
          </div>
        </Card>

        {/* GPS Status */}
        <SectionLabel>Kondisi GPS</SectionLabel>
        <div style={{ marginBottom: 8 }}>
          <StatusRow label="Segel GPS" status={data.segel_gps} ket={data.segel_gps_ket} />
          <StatusRow label="Kabel GPS" status={data.kabel_gps} ket={data.kabel_gps_ket} />
        </div>
        <PhotoGrid photos={photos.gps} label="Foto GPS" />

        {/* CCTV Dashcam */}
        <SectionLabel>CCTV Dashcam</SectionLabel>
        <div style={{ marginBottom: 8 }}>
          <StatusRow label="Segel Bricket" status={data.segel_bricket_dashcam} ket={data.segel_bricket_dashcam_ket} />
          <StatusRow label="Segel Sambungan Kabel" status={data.segel_kabel_dashcam} ket={data.segel_kabel_dashcam_ket} />
        </div>

        {/* CCTV Kanan */}
        <SectionLabel>CCTV Kanan</SectionLabel>
        <div style={{ marginBottom: 8 }}>
          <StatusRow label="Segel Bricket" status={data.segel_bricket_kanan} ket={data.segel_bricket_kanan_ket} />
          <StatusRow label="Segel Sambungan Kabel" status={data.segel_kabel_kanan} ket={data.segel_kabel_kanan_ket} />
        </div>

        {/* CCTV Kiri */}
        <SectionLabel>CCTV Kiri</SectionLabel>
        <div style={{ marginBottom: 8 }}>
          <StatusRow label="Segel Bricket" status={data.segel_bricket_kiri} ket={data.segel_bricket_kiri_ket} />
          <StatusRow label="Segel Sambungan Kabel" status={data.segel_kabel_kiri} ket={data.segel_kabel_kiri_ket} />
        </div>
        <PhotoGrid photos={photos.cctv} label="Foto CCTV" />
      </div>

      {/* Modal Assign */}
      {showAssignModal && (
        <ModalAssign
          inspeksiId={inspeksiId}
          onClose={() => setShowAssignModal(false)}
          onSuccess={() => {
            setShowAssignModal(false);
            loadDetail(); // refresh data termasuk assignedInfo
          }}
        />
      )}
    </div>
  );
};

export default DetailScreen;