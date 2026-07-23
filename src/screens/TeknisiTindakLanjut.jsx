import { useState, useEffect, useRef } from "react";
import BottomNav from "../components/BottomNav";
import Card from "../components/Card";
import Icon from "../components/Icon";
import Btn from "../components/Btn";
import SectionLabel from "../components/SectionLabel";
import theme from "../styles/theme";
import { supabase } from "../lib/supabase";

// ── Label display per field abnormal ────────────────────────────────────────
const FIELD_LABELS = {
  status_gps:              "Status GPS",
  segel_gps:               "Segel GPS",
  kabel_gps:               "Kabel GPS",
  status_cctv_dashcam:     "Status CCTV Dashcam",
  segel_bricket_dashcam:   "Segel Bricket CCTV Dashcam",
  segel_kabel_dashcam:     "Segel Sambungan Kabel CCTV Dashcam",
  status_cctv_kanan:       "Status CCTV Kanan",
  segel_bricket_kanan:     "Segel Bricket CCTV Kanan",
  segel_kabel_kanan:       "Segel Sambungan Kabel CCTV Kanan",
  status_cctv_kiri:        "Status CCTV Kiri",
  segel_bricket_kiri:      "Segel Bricket CCTV Kiri",
  segel_kabel_kiri:        "Segel Sambungan Kabel CCTV Kiri",
  segel_kotak_sekring:     "Segel Kotak Sekring",
};

const KET_FIELDS = {
  segel_gps:             "segel_gps_ket",
  kabel_gps:             "kabel_gps_ket",
  segel_bricket_dashcam: "segel_bricket_dashcam_ket",
  segel_kabel_dashcam:   "segel_kabel_dashcam_ket",
  segel_bricket_kanan:   "segel_bricket_kanan_ket",
  segel_kabel_kanan:     "segel_kabel_kanan_ket",
  segel_bricket_kiri:    "segel_bricket_kiri_ket",
  segel_kabel_kiri:      "segel_kabel_kiri_ket",
};

// Ambil semua field yang abnormal/tidak aktif dari satu inspeksi
const getAbnormalItems = (insp) => {
  const items = [];
  const statusFields = [
    "status_gps", "status_cctv_dashcam", "status_cctv_kanan",
    "status_cctv_kiri", "segel_kotak_sekring",
  ];
  const normalAbnormalFields = [
    "segel_gps", "kabel_gps",
    "segel_bricket_dashcam", "segel_kabel_dashcam",
    "segel_bricket_kanan",   "segel_kabel_kanan",
    "segel_bricket_kiri",    "segel_kabel_kiri",
  ];

  statusFields.forEach((f) => {
    if (insp[f] === "Tidak Aktif") {
      items.push({ field: f, label: FIELD_LABELS[f], nilai: insp[f], ket: null });
    }
  });
  normalAbnormalFields.forEach((f) => {
    if (insp[f]?.toLowerCase() === "abnormal") {
      const ketField = KET_FIELDS[f];
      items.push({ field: f, label: FIELD_LABELS[f], nilai: insp[f], ket: ketField ? insp[ketField] : null });
    }
  });
  return items;
};

// ── CameraCapture mini untuk tindak lanjut ───────────────────────────────────
const CameraCaptureMini = ({ kategori, onPhotos }) => {
  const [photos,   setPhotos]   = useState([]);
  const [capState, setCapState] = useState("idle");
  const fileInputRef = useRef(null);

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setCapState("processing");
    try {
      const file     = files[0];
      const fileName = `tl-${kategori}-${Date.now()}.jpg`;
      const { data, error } = await supabase.storage
        .from("foto-inspeksi").upload(fileName, file, { contentType: file.type });
      if (error) { alert("⚠️ Foto gagal diupload: " + error.message); return; }
      const { data: pub } = supabase.storage.from("foto-inspeksi").getPublicUrl(data.path);
      const newPhoto = { name: fileName, url: pub.publicUrl, path: data.path };
      setPhotos((p) => [...p, newPhoto]);
      onPhotos((p) => [...p, { kategori, url: newPhoto.url, path: newPhoto.path }]);
    } catch (err) {
      alert("⚠️ Gagal upload foto: " + err.message);
    } finally {
      setCapState("idle");
      e.target.value = "";
    }
  };

  const removePhoto = async (path) => {
    await supabase.storage.from("foto-inspeksi").remove([path]);
    setPhotos((p) => p.filter((x) => x.path !== path));
    onPhotos((p) => p.filter((x) => x.path !== path));
  };

  return (
    <div style={{ marginTop: 10 }}>
      <input ref={fileInputRef} type="file" accept="image/*" capture="environment"
        onChange={handleFileChange} style={{ display: "none" }} />
      <Btn onClick={() => fileInputRef.current?.click()} variant="outline"
        style={{ fontSize: 12, padding: "7px 12px", width: "100%" }}
        disabled={capState !== "idle"}>
        {capState === "processing" ? "⏳ Upload..." : "📷 Foto Bukti Perbaikan"}
      </Btn>
      {photos.length > 0 && (
        <div style={{ marginTop: 8 }}>
          {photos.map((p) => (
            <div key={p.path} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "6px 10px", background: theme.primaryLight, borderRadius: 8,
              marginBottom: 6, fontSize: 11, color: theme.primary,
            }}>
              <span>✓ {p.name}</span>
              <div onClick={() => removePhoto(p.path)}
                style={{ cursor: "pointer", fontWeight: 700, color: theme.danger }}>✕</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── TindakLanjutDetail — form per inspeksi ───────────────────────────────────
const TindakLanjutDetail = ({ inspeksi, onBack, onSelesai }) => {
  const abnormalItems = getAbnormalItems(inspeksi);
  const [catatanMap, setCatatanMap]   = useState({}); // field → catatan
  const [photosMap,  setPhotosMap]    = useState({}); // field → [{url, path}]
  const [errors,     setErrors]       = useState({});
  const [submitting, setSubmitting]   = useState(false);

  const setFieldPhotos = (field) => (updater) =>
    setPhotosMap((p) => ({ ...p, [field]: typeof updater === "function" ? updater(p[field] || []) : updater }));

  const handleSubmit = async () => {
    // Validasi — semua item wajib ada catatan
    const e = {};
    abnormalItems.forEach(({ field }) => {
      if (!catatanMap[field]?.trim()) e[field] = true;
    });
    setErrors(e);
    if (Object.keys(e).length > 0) {
      alert("Semua item abnormal wajib diisi keterangan tindak lanjutnya.");
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Simpan tindak lanjut per item ke laporan_perbaikan
      // Gunakan tugas_perbaikan yang sudah ada atau buat baru
      let tugasId = inspeksi._tugasId;

      if (!tugasId) {
        // Buat tugas_perbaikan baru kalau belum ada
        const { data: tugasData, error: tugasErr } = await supabase
          .from("tugas_perbaikan")
          .insert([{
            inspeksi_id:      inspeksi.id,
            mekanik_id:       user.id,
            ditugaskan_oleh:  user.id,
            catatan_tugas:    "Tindak lanjut mandiri oleh teknisi",
            status:           "dikerjakan",
          }])
          .select().single();
        if (tugasErr) throw tugasErr;
        tugasId = tugasData.id;
      }

      // Simpan laporan perbaikan dengan catatan gabungan
      const catatanGabungan = abnormalItems
        .map(({ field, label }) => `${label}: ${catatanMap[field] || "-"}`)
        .join("\n");

      const { data: laporanData, error: laporanErr } = await supabase
        .from("laporan_perbaikan")
        .insert([{ tugas_id: tugasId, catatan_perbaikan: catatanGabungan }])
        .select().single();
      if (laporanErr) throw laporanErr;

      // Simpan semua foto
      const allPhotos = Object.values(photosMap).flat();
      if (allPhotos.length > 0) {
        await supabase.from("foto_perbaikan").insert(
          allPhotos.map((p) => ({ laporan_id: laporanData.id, url: p.url }))
        );
      }

      // Update status tugas & inspeksi jadi selesai
      await supabase.from("tugas_perbaikan").update({ status: "selesai" }).eq("id", tugasId);
      await supabase.from("inspeksi").update({ status: "selesai" }).eq("id", inspeksi.id);

      alert("✅ Tindak lanjut berhasil disimpan!");
      onSelesai();
    } catch (err) {
      alert("Gagal menyimpan: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: theme.bg, display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ background: theme.surface, padding: "48px 16px 16px", borderBottom: `1px solid ${theme.border}`, boxShadow: theme.shadow }}>
        <div onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14, cursor: "pointer", color: theme.textSub, fontSize: 13 }}>
          <Icon name="arrow" size={16} color={theme.textSub} /> Kembali
        </div>
        <div style={{ fontWeight: 800, fontSize: 18, color: theme.text }}>Tindak Lanjut</div>
        <div style={{ fontSize: 13, color: theme.textMuted, marginTop: 2 }}>
          {inspeksi.nomor_polisi} · {inspeksi.perusahaan_transportir}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "20px 16px", paddingBottom: 100 }}>
        {/* Info tanggal pengecekan */}
        <div style={{ padding: "10px 14px", borderRadius: 10, background: theme.primaryLight, marginBottom: 20, fontSize: 12, color: theme.primary, fontWeight: 600 }}>
          📋 Pengecekan: {new Date(inspeksi.created_at).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </div>

        <SectionLabel>Item yang Perlu Ditindaklanjuti ({abnormalItems.length})</SectionLabel>

        {abnormalItems.length === 0 ? (
          <Card style={{ padding: 20, textAlign: "center" }}>
            <div style={{ fontSize: 13, color: theme.textMuted }}>Semua item normal ✅</div>
          </Card>
        ) : (
          abnormalItems.map(({ field, label, nilai, ket }) => (
            <div key={field} style={{
              marginBottom: 16, padding: 14, borderRadius: 14,
              background: theme.surface, border: `1.5px solid ${theme.danger}`,
            }}>
              {/* Label & status */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: theme.text, flex: 1 }}>{label}</div>
                <div style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 20, background: theme.dangerLight, color: theme.danger, flexShrink: 0, marginLeft: 8 }}>
                  {nilai}
                </div>
              </div>

              {/* Keterangan dari form pengecekan */}
              {ket && (
                <div style={{ fontSize: 12, color: theme.textSub, background: theme.surfaceAlt, padding: "8px 10px", borderRadius: 8, marginBottom: 10, fontStyle: "italic" }}>
                  Temuan: "{ket}"
                </div>
              )}

              {/* Input tindak lanjut */}
              <div style={{ fontSize: 12, fontWeight: 600, color: theme.text, marginBottom: 6 }}>
                Tindak Lanjut yang Dilakukan:
              </div>
              <textarea
                placeholder="Jelaskan tindakan yang sudah dilakukan..."
                value={catatanMap[field] || ""}
                onChange={(e) => setCatatanMap((p) => ({ ...p, [field]: e.target.value }))}
                style={{
                  width: "100%", padding: "10px 12px", borderRadius: 10,
                  border: `1.5px solid ${errors[field] ? theme.danger : theme.border}`,
                  background: errors[field] ? theme.dangerLight : theme.surfaceAlt,
                  color: theme.text, fontSize: 13,
                  fontFamily: "'DM Sans', sans-serif",
                  resize: "none", minHeight: 80, boxSizing: "border-box", outline: "none",
                }}
              />
              {errors[field] && (
                <div style={{ fontSize: 12, color: theme.danger, fontWeight: 600, marginTop: 4 }}>
                  ⚠️ Keterangan tindak lanjut wajib diisi.
                </div>
              )}

              {/* Foto bukti */}
              <CameraCaptureMini
                kategori={`tl_${field}`}
                onPhotos={setFieldPhotos(field)}
              />
            </div>
          ))
        )}
      </div>

      {/* Bottom Action */}
      <div style={{
        position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
        width: "100%", maxWidth: 430, padding: "12px 16px",
        background: theme.surface, borderTop: `1px solid ${theme.border}`,
      }}>
        <Btn onClick={handleSubmit} variant="primary" icon="check" disabled={submitting || abnormalItems.length === 0}>
          {submitting ? "Menyimpan..." : "Simpan Tindak Lanjut"}
        </Btn>
      </div>
    </div>
  );
};

// ── TeknisiTindakLanjut — list inspeksi yang perlu ditindaklanjuti ────────────
const TeknisiTindakLanjut = ({ onBack, onNav }) => {
  const [view,      setView]      = useState("list"); // "list" | "detail"
  const [selected,  setSelected]  = useState(null);
  const [list,      setList]      = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [role,      setRole]      = useState(null);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      // Ambil role
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      setRole(profile?.role);

      // Ambil inspeksi milik user yang:
      // 1. Sudah di-submit (is_submitted = true)
      // 2. Status bukan "selesai"
      const { data: inspeksiData, error } = await supabase
        .from("inspeksi")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_submitted", true)
        .neq("status", "selesai")
        .order("created_at", { ascending: false });

      if (error) console.error("Error load inspeksi:", error);

      // Filter hanya yang punya item abnormal
      const withAbnormal = (inspeksiData || []).map((insp) => {
        const items = getAbnormalItems(insp);
        return { ...insp, _abnormalCount: items.length };
      }).filter((insp) => insp._abnormalCount > 0);

      // Cek apakah sudah ada tugas_perbaikan untuk masing-masing
      const inspIds = withAbnormal.map((i) => i.id);
      let tugasMap = {};
      if (inspIds.length > 0) {
        const { data: tugasData } = await supabase
          .from("tugas_perbaikan")
          .select("id, inspeksi_id, status")
          .in("inspeksi_id", inspIds)
          .eq("mekanik_id", user.id);
        (tugasData || []).forEach((t) => { tugasMap[t.inspeksi_id] = t; });
      }

      const enriched = withAbnormal.map((insp) => ({
        ...insp,
        _tugasId:     tugasMap[insp.id]?.id     || null,
        _tugasStatus: tugasMap[insp.id]?.status || null,
      }));

      setList(enriched);
      setLoading(false);
    };

    loadData();
  }, []);

  const handleSelesai = () => {
    // Refresh list setelah selesai
    setView("list");
    setSelected(null);
    setList((p) => p.filter((i) => i.id !== selected.id));
  };

  if (view === "detail" && selected) {
    return (
      <TindakLanjutDetail
        inspeksi={selected}
        onBack={() => setView("list")}
        onSelesai={handleSelesai}
      />
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: theme.bg, paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ background: theme.surface, padding: "48px 16px 16px", borderBottom: `1px solid ${theme.border}`, boxShadow: theme.shadow }}>
        <div onClick={() => onNav("dashboard")} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14, cursor: "pointer", color: theme.textSub, fontSize: 13 }}>
        <Icon name="arrow" size={16} color={theme.textSub} /> Kembali
        </div>
        <div style={{ fontWeight: 800, fontSize: 18, color: theme.text }}>Tindak Lanjut</div>
        <div style={{ fontSize: 13, color: theme.textMuted, marginTop: 2 }}>
          Inspeksi yang perlu ditindaklanjuti
        </div>
      </div>

      <div style={{ padding: "20px 16px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: theme.textMuted }}>Memuat data...</div>
        ) : list.length === 0 ? (
          <Card style={{ padding: 32, textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>✅</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: theme.text, marginBottom: 6 }}>
              Semua sudah ditindaklanjuti
            </div>
            <div style={{ fontSize: 13, color: theme.textMuted }}>
              Tidak ada item abnormal yang menunggu tindak lanjut
            </div>
          </Card>
        ) : (
          <>
            <SectionLabel>Perlu Ditindaklanjuti ({list.length})</SectionLabel>
            {list.map((insp) => (
              <Card
                key={insp.id}
                onClick={() => { setSelected(insp); setView("detail"); }}
                style={{ marginBottom: 12, padding: "14px 16px", cursor: "pointer" }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 12,
                      background: theme.dangerLight,
                      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                    }}>
                      <Icon name="wrench" size={20} color={theme.danger} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15, color: theme.text }}>
                        {insp.nomor_polisi}
                      </div>
                      <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>
                        {insp.perusahaan_transportir}
                      </div>
                      <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 1 }}>
                        {new Date(insp.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                    <div style={{
                      fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20,
                      background: theme.dangerLight, color: theme.danger,
                    }}>
                      {insp._abnormalCount} item
                    </div>
                    <Icon name="chevron" size={14} color={theme.textMuted} />
                  </div>
                </div>
              </Card>
            ))}
          </>
        )}
      </div>

      <BottomNav active="tindak-lanjut" onNav={onNav} role={role} />
    </div>
  );
};

export default TeknisiTindakLanjut;