import { useState, useEffect, useRef } from "react";
import BottomNav from "../components/BottomNav";
import Card from "../components/Card";
import Icon from "../components/Icon";
import Btn from "../components/Btn";
import SectionLabel from "../components/SectionLabel";
import theme from "../styles/theme";
import { supabase } from "../lib/supabase";

// ── CameraCaptureMini ─────────────────────────────────────────────────────────
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
      const fileName = `hse-tl-${kategori}-${Date.now()}.jpg`;
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

// ── TindakLanjutDetail HSE ────────────────────────────────────────────────────
const TindakLanjutDetail = ({ inspeksi, kompartemenList, onBack, onSelesai }) => {
  const tidakKedapList = kompartemenList.filter((k) => k.status === "tidak_kedap");
  const [catatanMap, setCatatanMap] = useState({});
  const [photosMap,  setPhotosMap]  = useState({});
  const [errors,     setErrors]     = useState({});
  const [submitting, setSubmitting] = useState(false);

  const setFieldPhotos = (field) => (updater) =>
    setPhotosMap((p) => ({ ...p, [field]: typeof updater === "function" ? updater(p[field] || []) : updater }));

  const handleSubmit = async () => {
    const e = {};
    tidakKedapList.forEach((k) => {
      if (!catatanMap[k.id]?.trim()) e[k.id] = true;
    });
    setErrors(e);
    if (Object.keys(e).length > 0) {
      alert("Semua kompartemen tidak kedap wajib diisi keterangan tindak lanjutnya.");
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Simpan tindak lanjut per kompartemen
      const rows = tidakKedapList.map((k) => ({
        inspeksi_hse_id: inspeksi.id,
        user_id:         user.id,
        kompartemen_no:  k.nomor,
        catatan:         catatanMap[k.id] || "",
        status:          "selesai",
      }));

      const { error: tlErr } = await supabase.from("tindaklanjut_hse").insert(rows);
      if (tlErr) throw tlErr;

      // Simpan foto
      const allPhotos = Object.values(photosMap).flat();
      if (allPhotos.length > 0) {
        // Simpan ke foto_inspeksi_hse dengan referensi inspeksi
        await supabase.from("foto_inspeksi_hse").insert(
          allPhotos.map((p) => ({
            inspeksi_hse_id: inspeksi.id,
            url:             p.url,
          }))
        );
      }

      // Update status inspeksi_hse jadi selesai
      await supabase.from("inspeksi_hse").update({ status: "selesai" }).eq("id", inspeksi.id);

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
        <div style={{ fontWeight: 800, fontSize: 18, color: theme.text }}>Tindak Lanjut Uji Kedap</div>
        <div style={{ fontSize: 13, color: theme.textMuted, marginTop: 2 }}>
          {inspeksi.nomor_polisi} · {inspeksi.transportir}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "20px 16px", paddingBottom: 100 }}>
        {/* Info kendaraan */}
        <div style={{ padding: "10px 14px", borderRadius: 10, background: theme.primaryLight, marginBottom: 20, fontSize: 12, color: theme.primary, fontWeight: 600 }}>
          📋 {inspeksi.kapasitas_mt} · {inspeksi.jumlah_kompartemen} kompartemen · {inspeksi.kategori_mt === "merah_putih" ? "MT Merah Putih" : "MT Industri"}
          {" · "}{new Date(inspeksi.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
        </div>

        <SectionLabel>Kompartemen Tidak Kedap ({tidakKedapList.length})</SectionLabel>

        {tidakKedapList.length === 0 ? (
          <Card style={{ padding: 20, textAlign: "center" }}>
            <div style={{ fontSize: 13, color: theme.textMuted }}>Semua kompartemen kedap ✅</div>
          </Card>
        ) : (
          tidakKedapList.map((k) => (
            <div key={k.id} style={{
              marginBottom: 16, padding: 14, borderRadius: 14,
              background: theme.surface, border: `1.5px solid ${theme.danger}`,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: theme.text }}>
                  Kompartemen {k.nomor}
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 20, background: theme.dangerLight, color: theme.danger }}>
                  Tidak Kedap
                </div>
              </div>

              {/* Keterangan dari pengecekan */}
              {k.keterangan && (
                <div style={{ fontSize: 12, color: theme.textSub, background: theme.surfaceAlt, padding: "8px 10px", borderRadius: 8, marginBottom: 10, fontStyle: "italic" }}>
                  Temuan: "{k.keterangan}"
                </div>
              )}

              {/* Input tindak lanjut */}
              <div style={{ fontSize: 12, fontWeight: 600, color: theme.text, marginBottom: 6 }}>
                Tindak Lanjut yang Dilakukan:
              </div>
              <textarea
                placeholder="Jelaskan tindakan yang sudah dilakukan..."
                value={catatanMap[k.id] || ""}
                onChange={(e) => setCatatanMap((p) => ({ ...p, [k.id]: e.target.value }))}
                style={{
                  width: "100%", padding: "10px 12px", borderRadius: 10,
                  border: `1.5px solid ${errors[k.id] ? theme.danger : theme.border}`,
                  background: errors[k.id] ? theme.dangerLight : theme.surfaceAlt,
                  color: theme.text, fontSize: 13,
                  fontFamily: "'DM Sans', sans-serif",
                  resize: "none", minHeight: 80, boxSizing: "border-box", outline: "none",
                }}
              />
              {errors[k.id] && (
                <div style={{ fontSize: 12, color: theme.danger, fontWeight: 600, marginTop: 4 }}>
                  ⚠️ Keterangan tindak lanjut wajib diisi.
                </div>
              )}

              <CameraCaptureMini
                kategori={`komp_${k.nomor}`}
                onPhotos={setFieldPhotos(k.id)}
              />
            </div>
          ))
        )}
      </div>

      <div style={{
        position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
        width: "100%", maxWidth: 430, padding: "12px 16px",
        background: theme.surface, borderTop: `1px solid ${theme.border}`,
      }}>
        <Btn onClick={handleSubmit} variant="primary" icon="check"
          disabled={submitting || tidakKedapList.length === 0}>
          {submitting ? "Menyimpan..." : "Simpan Tindak Lanjut"}
        </Btn>
      </div>
    </div>
  );
};

// ── HSETindakLanjut — list inspeksi yang perlu ditindaklanjuti ────────────────
const HSETindakLanjut = ({ onBack, onNav }) => {
  const [view,     setView]     = useState("list");
  const [selected, setSelected] = useState(null);
  const [kompList, setKompList] = useState([]);
  const [list,     setList]     = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [role,     setRole]     = useState(null);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      setRole(profile?.role);

      // Ambil inspeksi HSE milik user yang belum selesai
      const { data: inspeksiData, error } = await supabase
        .from("inspeksi_hse")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_submitted", true)
        .neq("status", "selesai")
        .order("created_at", { ascending: false });

      if (error) console.error("Error load inspeksi_hse:", error);

      // Untuk setiap inspeksi, ambil kompartemen yang tidak kedap
      const enriched = await Promise.all(
        (inspeksiData || []).map(async (insp) => {
          const { data: kompData } = await supabase
            .from("inspeksi_hse_kompartemen")
            .select("*")
            .eq("inspeksi_hse_id", insp.id)
            .eq("status", "tidak_kedap");
          return { ...insp, _tidakKedapCount: (kompData || []).length };
        })
      );

      // Filter hanya yang punya kompartemen tidak kedap
      setList(enriched.filter((i) => i._tidakKedapCount > 0));
      setLoading(false);
    };

    loadData();
  }, []);

  const handlePilih = async (insp) => {
    // Load kompartemen tidak kedap
    const { data: kompData } = await supabase
      .from("inspeksi_hse_kompartemen")
      .select("*")
      .eq("inspeksi_hse_id", insp.id)
      .eq("status", "tidak_kedap")
      .order("nomor");

    setSelected(insp);
    setKompList(kompData || []);
    setView("detail");
  };

  const handleSelesai = () => {
    setView("list");
    setSelected(null);
    setKompList([]);
    setList((p) => p.filter((i) => i.id !== selected.id));
  };

  if (view === "detail" && selected) {
    return (
      <TindakLanjutDetail
        inspeksi={selected}
        kompartemenList={kompList}
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
        <div style={{ fontSize: 13, color: theme.textMuted, marginTop: 2 }}>Uji Kedap yang perlu ditindaklanjuti</div>
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
              Tidak ada kompartemen tidak kedap yang menunggu tindak lanjut
            </div>
          </Card>
        ) : (
          <>
            <SectionLabel>Perlu Ditindaklanjuti ({list.length})</SectionLabel>
            {list.map((insp) => (
              <Card
                key={insp.id}
                onClick={() => handlePilih(insp)}
                style={{ marginBottom: 12, padding: "14px 16px", cursor: "pointer" }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 12, background: theme.dangerLight,
                      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                    }}>
                      <Icon name="wrench" size={20} color={theme.danger} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15, color: theme.text }}>{insp.nomor_polisi}</div>
                      <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>{insp.transportir}</div>
                      <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 1 }}>
                        {insp.kapasitas_mt} · {insp.kategori_mt === "merah_putih" ? "Merah Putih" : "Industri"}
                      </div>
                      <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 1 }}>
                        {new Date(insp.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20, background: theme.dangerLight, color: theme.danger }}>
                      {insp._tidakKedapCount} tidak kedap
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

export default HSETindakLanjut;