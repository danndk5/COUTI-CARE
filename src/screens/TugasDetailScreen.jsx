import { useState, useEffect } from "react";
import Badge from "../components/Badge";
import Btn from "../components/Btn";
import Card from "../components/Card";
import Icon from "../components/Icon";
import SectionLabel from "../components/SectionLabel";
import theme from "../styles/theme";
import { supabase } from "../lib/supabase";

const PhotoUpload = ({ onPhotos }) => {
  const [photos, setPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setUploading(true);

    for (const file of files) {
      const timestamp = new Date().getTime();
      const fileName = `perbaikan-${timestamp}-${file.name}`;

      const { data, error } = await supabase.storage
        .from("foto-inspeksi")
        .upload(fileName, file);

      if (error) {
        console.error("Upload error:", error);
        continue;
      }

      const { data: publicData } = supabase.storage
        .from("foto-inspeksi")
        .getPublicUrl(data.path);

      setPhotos((prev) => [
        ...prev,
        { name: file.name, url: publicData.publicUrl, path: data.path },
      ]);
      onPhotos((prev) => [...prev, { url: publicData.publicUrl, path: data.path }]);
    }

    setUploading(false);
  };

  return (
    <div
      style={{
        border: `2px dashed ${theme.border}`,
        borderRadius: 12,
        padding: "18px 16px",
        textAlign: "center",
        marginBottom: 16,
      }}
    >
      <Icon name="photo" size={28} color={theme.textMuted} />
      <div style={{ fontSize: 13, color: theme.textMuted, marginTop: 8 }}>
        Foto hasil perbaikan
      </div>
      <div style={{ marginTop: 12 }}>
        <label style={{ display: "inline-block" }}>
          <input
            type="file"
            multiple
            accept="image/*"
            onChange={handleFileChange}
            disabled={uploading}
            style={{ display: "none" }}
          />
          <Btn
            as="span"
            onClick={(e) => e.currentTarget.parentElement?.querySelector("input")?.click()}
            variant="outline"
            style={{ padding: "9px", fontSize: 13, cursor: "pointer" }}
          >
            {uploading ? "Uploading..." : "Pilih Foto"}
          </Btn>
        </label>
      </div>

      {photos.length > 0 && (
        <div style={{ marginTop: 12 }}>
          {photos.map((photo) => (
            <div
              key={photo.path}
              style={{
                padding: "8px 12px",
                background: theme.primaryLight,
                borderRadius: 8,
                marginBottom: 8,
                fontSize: 12,
                color: theme.primary,
              }}
            >
              ✓ {photo.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const TugasDetailScreen = ({ tugasId, onBack }) => {
  const [tugas, setTugas] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [catatan, setCatatan] = useState("");
  const [photos, setPhotos] = useState([]);

  useEffect(() => {
    const loadTugas = async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from("tugas_perbaikan")
        .select("*, inspeksi:inspeksi_id(*)")
        .eq("id", tugasId)
        .single();

      if (error) {
        console.error("Error loading tugas:", error);
      }

      setTugas(data);
      setLoading(false);
    };

    if (tugasId) loadTugas();
  }, [tugasId]);

  const handleMulaiKerja = async () => {
    await supabase
      .from("tugas_perbaikan")
      .update({ status: "dikerjakan" })
      .eq("id", tugasId);

    setTugas((prev) => ({ ...prev, status: "dikerjakan" }));
  };

  const handleSelesai = async () => {
    if (!catatan) {
      alert("Mohon isi catatan perbaikan");
      return;
    }

    setSubmitting(true);

    try {
      // Simpan laporan perbaikan
      const { data: laporanData, error: laporanError } = await supabase
        .from("laporan_perbaikan")
        .insert([{ tugas_id: tugasId, catatan_perbaikan: catatan }])
        .select()
        .single();

      if (laporanError) throw laporanError;

      // Simpan foto perbaikan
      if (photos.length > 0) {
        const fotoData = photos.map((p) => ({
          laporan_id: laporanData.id,
          url: p.url,
        }));
        await supabase.from("foto_perbaikan").insert(fotoData);
      }

      // Update status tugas jadi selesai
      await supabase
        .from("tugas_perbaikan")
        .update({ status: "selesai" })
        .eq("id", tugasId);

      // Update status inspeksi jadi selesai juga
      await supabase
        .from("inspeksi")
        .update({ status: "selesai" })
        .eq("id", tugas.inspeksi_id);

      alert("✓ Laporan perbaikan berhasil disimpan!");
      onBack();
    } catch (err) {
      alert("Error: " + err.message);
    }

    setSubmitting(false);
  };

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: theme.bg,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <div style={{ color: theme.textMuted }}>Memuat tugas...</div>
      </div>
    );
  }

  if (!tugas) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: theme.bg,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          padding: 24,
        }}
      >
        <div style={{ color: theme.textMuted, marginBottom: 16 }}>
          Tugas tidak ditemukan
        </div>
        <div onClick={onBack} style={{ color: theme.primary, fontWeight: 700, cursor: "pointer" }}>
          ← Kembali
        </div>
      </div>
    );
  }

  const insp = tugas.inspeksi;

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
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginBottom: 14,
            cursor: "pointer",
            color: theme.textSub,
            fontSize: 13,
          }}
        >
          <Icon name="arrow" size={16} color={theme.textSub} /> Kembali
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18, color: theme.text }}>
              {insp?.nomor_polisi}
            </div>
            <div style={{ fontSize: 13, color: theme.textMuted, marginTop: 2 }}>
              {insp?.nama_armada}
            </div>
          </div>
          <Badge status={tugas.status === "selesai" ? "Normal" : "Abnormal"} />
        </div>
      </div>

      <div style={{ padding: "20px 16px" }}>
        {/* Catatan dari Pertamina */}
        {tugas.catatan_tugas && (
          <>
            <SectionLabel>Instruksi dari Pertamina</SectionLabel>
            <Card style={{ marginBottom: 20, padding: 14 }}>
              <div style={{ fontSize: 13, color: theme.text, fontStyle: "italic" }}>
                "{tugas.catatan_tugas}"
              </div>
            </Card>
          </>
        )}

        {/* Detail Temuan */}
        <SectionLabel>Detail Temuan</SectionLabel>
        <Card style={{ marginBottom: 20, padding: 16 }}>
          {insp?.segel_gps?.toLowerCase() === "abnormal" && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: theme.danger }}>
                Segel GPS: Abnormal
              </div>
              {insp.segel_gps_ket && (
                <div style={{ fontSize: 12, color: theme.textMuted }}>{insp.segel_gps_ket}</div>
              )}
            </div>
          )}
          {insp?.kabel_gps?.toLowerCase() === "abnormal" && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: theme.danger }}>
                Kabel GPS: Abnormal
              </div>
              {insp.kabel_gps_ket && (
                <div style={{ fontSize: 12, color: theme.textMuted }}>{insp.kabel_gps_ket}</div>
              )}
            </div>
          )}
          {insp?.segel_bricket_dashcam?.toLowerCase() === "abnormal" && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: theme.danger }}>
                CCTV Dashcam - Segel Bricket: Abnormal
              </div>
              {insp.segel_bricket_dashcam_ket && (
                <div style={{ fontSize: 12, color: theme.textMuted }}>{insp.segel_bricket_dashcam_ket}</div>
              )}
            </div>
          )}
          {/* Tambahkan kondisi lain sesuai kebutuhan, atau bisa diringkas */}
        </Card>

        {/* Status & Action */}
        {tugas.status === "menunggu" && (
          <Btn onClick={handleMulaiKerja} variant="primary" style={{ marginBottom: 20 }}>
            Mulai Kerjakan
          </Btn>
        )}

        {tugas.status === "dikerjakan" && (
          <>
            <SectionLabel>Laporan Perbaikan</SectionLabel>
            <div
              style={{
                background: theme.surface,
                borderRadius: 14,
                padding: 16,
                border: `1px solid ${theme.border}`,
                marginBottom: 16,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600, color: theme.text, marginBottom: 8 }}>
                Catatan Perbaikan
              </div>
              <textarea
                placeholder="Jelaskan apa yang sudah diperbaiki..."
                value={catatan}
                onChange={(e) => setCatatan(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: `1.5px solid ${theme.border}`,
                  fontSize: 13,
                  fontFamily: "'DM Sans', sans-serif",
                  resize: "none",
                  minHeight: 90,
                  boxSizing: "border-box",
                  outline: "none",
                }}
              />
            </div>

            <PhotoUpload onPhotos={setPhotos} />

            <Btn onClick={handleSelesai} variant="primary" icon="check" disabled={submitting}>
              {submitting ? "Menyimpan..." : "Selesai & Kirim Laporan"}
            </Btn>
          </>
        )}

        {tugas.status === "selesai" && (
          <Card style={{ padding: 20, textAlign: "center" }}>
            <Icon name="check" size={32} color={theme.success} />
            <div style={{ fontSize: 14, fontWeight: 700, color: theme.success, marginTop: 8 }}>
              Perbaikan Selesai
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default TugasDetailScreen;