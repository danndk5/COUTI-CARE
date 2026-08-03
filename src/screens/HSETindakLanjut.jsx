import { useState, useEffect, useRef } from "react";
import BottomNav from "../components/BottomNav";
import Card from "../components/Card";
import Icon from "../components/Icon";
import Btn from "../components/Btn";
import SectionLabel from "../components/SectionLabel";
import theme from "../styles/theme";
import { supabase } from "../lib/supabase";
import { useBreakpoint } from "../hooks/useBreakpoint";
import { SIDEBAR_WIDTH } from "../styles/layout";

// ── Draft persistence per inspeksi — agar data tidak hilang kalau app ke-close ──
const draftKey = (inspeksiId) => `hse_tl_draft_${inspeksiId}`;
const saveDraft = (inspeksiId, data) => {
  try { localStorage.setItem(draftKey(inspeksiId), JSON.stringify(data)); } catch {}
};
const loadDraft = (inspeksiId) => {
  try {
    const raw = localStorage.getItem(draftKey(inspeksiId));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};
const clearDraft = (inspeksiId) => {
  try { localStorage.removeItem(draftKey(inspeksiId)); } catch {}
};

// ── PhotoLightbox — preview foto full-screen sebelum dikirim ──────────────────
const PhotoLightbox = ({ url, onClose }) => {
  if (!url) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", zIndex: 9999,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      }}
    >
      <div
        onClick={onClose}
        style={{
          position: "absolute", top: 44, right: 20, color: "#fff", fontSize: 26,
          fontWeight: 700, cursor: "pointer", width: 36, height: 36, borderRadius: 18,
          background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        ✕
      </div>
      <div style={{ position: "absolute", top: 46, left: 20, color: "#fff", fontSize: 12, opacity: 0.8 }}>
        Ketuk di mana saja untuk menutup
      </div>
      <img
        src={url}
        alt="Preview foto"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: 10, objectFit: "contain" }}
      />
    </div>
  );
};

// ── RepairPhotoSlot — 1 foto bukti perbaikan, dipasangkan dengan 1 foto temuan ──
const RepairPhotoSlot = ({ label, kategori, foto, onFoto, onPreview, errorFoto }) => {
  const [capState, setCapState] = useState("idle");
  const fileInputRef = useRef(null);

  const handleFileChange = async (e) => {
    const file = (e.target.files || [])[0];
    if (!file) return;
    setCapState("processing");
    try {
      const fileName = `hse-tl-${kategori}-${Date.now()}.jpg`;
      const { data, error } = await supabase.storage
        .from("foto-inspeksi").upload(fileName, file, { contentType: file.type });
      if (error) { alert("⚠️ Foto gagal diupload: " + error.message); return; }
      const { data: pub } = supabase.storage.from("foto-inspeksi").getPublicUrl(data.path);
      onFoto({ name: fileName, url: pub.publicUrl, path: data.path });
    } catch (err) {
      alert("⚠️ Gagal upload foto: " + err.message);
    } finally {
      setCapState("idle");
      e.target.value = "";
    }
  };

  const removeFoto = async () => {
    if (foto?.path) await supabase.storage.from("foto-inspeksi").remove([foto.path]).catch(() => {});
    onFoto(null);
  };

  return (
    <div style={{
      border: `2px dashed ${errorFoto ? theme.danger : theme.border}`, borderRadius: 10, padding: "10px 12px",
      background: errorFoto ? theme.dangerLight : "transparent", marginTop: 8,
    }}>
      <div style={{ fontSize: 11, color: errorFoto ? theme.danger : theme.textMuted, marginBottom: 8, textAlign: "center" }}>
        {label}
      </div>
      <input ref={fileInputRef} type="file" accept="image/*" capture="environment"
        onChange={handleFileChange} style={{ display: "none" }} />
      {foto ? (
        <div style={{ padding: "8px 10px", background: theme.primaryLight, borderRadius: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img
              src={foto.url}
              alt={foto.name}
              onClick={() => onPreview?.(foto.url)}
              style={{ width: 46, height: 46, borderRadius: 6, objectFit: "cover", cursor: "pointer", border: `1px solid ${theme.primary}`, flexShrink: 0 }}
            />
            <div style={{ flex: 1, fontSize: 12, color: theme.primary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              ✓ {foto.name}
            </div>
            <div onClick={() => onPreview?.(foto.url)} style={{ cursor: "pointer", fontSize: 12, color: theme.primary, fontWeight: 700, flexShrink: 0 }}>
              🔍 Lihat
            </div>
            <div onClick={removeFoto} style={{ cursor: "pointer", fontWeight: 700, color: theme.danger, flexShrink: 0 }}>✕</div>
          </div>
        </div>
      ) : (
        <Btn onClick={() => fileInputRef.current?.click()} variant="outline"
          style={{ fontSize: 12, padding: "8px 12px", width: "100%" }} disabled={capState !== "idle"}>
          {capState === "processing" ? "⏳ Upload..." : "📷 Foto Bukti Perbaikan"}
        </Btn>
      )}
      {errorFoto && (
        <div style={{ marginTop: 6, fontSize: 11, color: theme.danger, fontWeight: 600 }}>⚠️ Foto bukti perbaikan wajib diambil.</div>
      )}
    </div>
  );
};

// ── TindakLanjutDetail HSE ────────────────────────────────────────────────────
// Tindak lanjut per KENDARAAN. Setiap foto temuan WAJIB dipasangkan 1 foto bukti perbaikan.
const TindakLanjutDetail = ({ inspeksi, fotoTemuan, onBack, onSelesai }) => {
  const [catatan,        setCatatan]        = useState("");
  const [buktiPerbaikan, setBuktiPerbaikan] = useState(() => fotoTemuan.map(() => null));
  const [previewUrl,     setPreviewUrl]     = useState(null);
  const [errors,         setErrors]         = useState({});
  const [submitting,     setSubmitting]     = useState(false);
  const [ready,          setReady]          = useState(false);

  // Pulihkan draft (catatan + foto bukti perbaikan) kalau app sempat ke-close
  useEffect(() => {
    const draft = loadDraft(inspeksi.id);
    if (draft) {
      setCatatan(draft.catatan || "");
      if (Array.isArray(draft.buktiPerbaikan) && draft.buktiPerbaikan.length === fotoTemuan.length) {
        setBuktiPerbaikan(draft.buktiPerbaikan);
      }
    }
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inspeksi.id]);

  // Auto-save draft setiap ada perubahan
  useEffect(() => {
    if (!ready) return;
    saveDraft(inspeksi.id, { catatan, buktiPerbaikan });
  }, [ready, catatan, buktiPerbaikan, inspeksi.id]);

  const setFotoAt = (idx) => (foto) => {
    setBuktiPerbaikan((prev) => prev.map((f, i) => i === idx ? foto : f));
  };

  const jumlahLengkap = buktiPerbaikan.filter(Boolean).length;
  const semuaLengkap  = fotoTemuan.length > 0 && jumlahLengkap === fotoTemuan.length;

  const handleSubmit = async () => {
    const e = {};
    if (!catatan.trim()) e.catatan = true;
    buktiPerbaikan.forEach((f, i) => {
      if (!f) e[`bukti_${i}`] = true;
    });
    setErrors(e);
    if (Object.keys(e).length > 0) {
      alert(`Semua foto bukti perbaikan wajib diunggah (${jumlahLengkap}/${fotoTemuan.length}) dan keterangan tindak lanjut wajib diisi.`);
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error: tlErr } = await supabase.from("tindaklanjut_hse").insert([{
        inspeksi_hse_id: inspeksi.id,
        user_id:         user.id,
        catatan:         catatan.trim(),
        status:          "selesai",
      }]);
      if (tlErr) throw tlErr;

      const { error: fotoErr } = await supabase.from("foto_inspeksi_hse").insert(
        buktiPerbaikan.map((f, i) => ({
          inspeksi_hse_id: inspeksi.id,
          url:             f.url,
          keterangan:      `Bukti perbaikan untuk temuan ${i + 1}`,
        }))
      );
      if (fotoErr) throw fotoErr;

      await supabase.from("inspeksi_hse").update({ status: "selesai" }).eq("id", inspeksi.id);

      clearDraft(inspeksi.id);

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

        <SectionLabel>Temuan Uji Kedap ({fotoTemuan.length} foto) — Bukti Perbaikan ({jumlahLengkap}/{fotoTemuan.length})</SectionLabel>

        {fotoTemuan.length === 0 ? (
          <Card style={{ padding: 20, textAlign: "center", marginBottom: 20 }}>
            <div style={{ fontSize: 13, color: theme.textMuted }}>Tidak ada foto temuan tercatat</div>
          </Card>
        ) : (
          <div style={{ marginBottom: 20 }}>
            {fotoTemuan.map((f, idx) => (
              <div key={f.id} style={{
                marginBottom: 14, padding: 12, borderRadius: 12,
                background: theme.surface, border: `1.5px solid ${theme.danger}`,
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: theme.danger, marginBottom: 8 }}>
                  Temuan {idx + 1}
                </div>
                <img
                  src={f.url}
                  alt="temuan"
                  onClick={() => setPreviewUrl(f.url)}
                  style={{ width: "100%", maxHeight: 200, objectFit: "cover", borderRadius: 8, marginBottom: 8, cursor: "pointer" }}
                />
                <div style={{ fontSize: 12, color: theme.textSub, background: theme.surfaceAlt, padding: "8px 10px", borderRadius: 8, fontStyle: "italic", marginBottom: 4 }}>
                  Temuan: "{f.keterangan}"
                </div>

                {/* Foto bukti perbaikan — wajib, dipasangkan dengan temuan ini */}
                <RepairPhotoSlot
                  label={`Foto bukti perbaikan untuk Temuan ${idx + 1} (wajib)`}
                  kategori={`${inspeksi.nomor_polisi}_${idx}`}
                  foto={buktiPerbaikan[idx]}
                  onFoto={setFotoAt(idx)}
                  onPreview={setPreviewUrl}
                  errorFoto={!!errors[`bukti_${idx}`]}
                />
              </div>
            ))}
          </div>
        )}

        {/* Input tindak lanjut */}
        <div style={{ padding: 14, borderRadius: 14, background: theme.surface, border: `1.5px solid ${theme.border}` }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: theme.text, marginBottom: 8 }}>
            Tindak Lanjut yang Dilakukan
          </div>
          <textarea
            placeholder="Jelaskan tindakan perbaikan yang sudah dilakukan..."
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
            style={{
              width: "100%", padding: "10px 12px", borderRadius: 10,
              border: `1.5px solid ${errors.catatan ? theme.danger : theme.border}`,
              background: errors.catatan ? theme.dangerLight : theme.surfaceAlt,
              color: theme.text, fontSize: 13,
              fontFamily: "'DM Sans', sans-serif",
              resize: "none", minHeight: 90, boxSizing: "border-box", outline: "none",
            }}
          />
          {errors.catatan && (
            <div style={{ fontSize: 12, color: theme.danger, fontWeight: 600, marginTop: 4 }}>
              ⚠️ Keterangan tindak lanjut wajib diisi.
            </div>
          )}
        </div>
      </div>

      <div style={{
        position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
        width: "100%", maxWidth: 430, padding: "12px 16px",
        background: theme.surface, borderTop: `1px solid ${theme.border}`,
      }}>
        <Btn onClick={handleSubmit} variant="primary" icon="check" disabled={submitting || !semuaLengkap}>
          {submitting ? "Menyimpan..." : `Simpan Tindak Lanjut (${jumlahLengkap}/${fotoTemuan.length} foto)`}
        </Btn>
      </div>

      <PhotoLightbox url={previewUrl} onClose={() => setPreviewUrl(null)} />
    </div>
  );
};

// ── HSETindakLanjut — list inspeksi yang perlu ditindaklanjuti ────────────────
const HSETindakLanjut = ({ onBack, onNav }) => {
  const isDesktop = useBreakpoint();
  const [view,       setView]       = useState("list");
  const [selected,   setSelected]   = useState(null);
  const [fotoTemuan, setFotoTemuan] = useState([]);
  const [list,       setList]       = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [role,       setRole]       = useState(null);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      setRole(profile?.role);

      // Kendaraan yang GAGAL uji kedap dan belum ditindaklanjuti.
      // Setelah tindak lanjut disimpan, status berubah jadi "selesai" sehingga
      // otomatis hilang dari daftar ini (query difilter status === "tidak_lulus").
      const { data: inspeksiData, error } = await supabase
        .from("inspeksi_hse")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_submitted", true)
        .eq("status", "tidak_lulus")
        .order("created_at", { ascending: false });

      if (error) console.error("Error load inspeksi_hse:", error);

      setList(inspeksiData || []);
      setLoading(false);
    };

    loadData();
  }, []);

  const handlePilih = async (insp) => {
    const { data: fotoData } = await supabase
      .from("foto_inspeksi_hse")
      .select("*")
      .eq("inspeksi_hse_id", insp.id)
      .not("keterangan", "like", "Bukti perbaikan%")
      .order("created_at", { ascending: true });

    setSelected(insp);
    setFotoTemuan(fotoData || []);
    setView("detail");
  };

  const handleSelesai = () => {
    setView("list");
    setList((p) => p.filter((i) => i.id !== selected.id));
    setSelected(null);
    setFotoTemuan([]);
  };

  if (view === "detail" && selected) {
    return (
      <TindakLanjutDetail
        inspeksi={selected}
        fotoTemuan={fotoTemuan}
        onBack={() => setView("list")}
        onSelesai={handleSelesai}
      />
    );
  }

  return (
    <div style={{
      minHeight: "100vh", background: theme.bg,
      paddingBottom: isDesktop ? 0 : 80,
      marginLeft: isDesktop ? SIDEBAR_WIDTH : 0,
    }}>
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
              Tidak ada kendaraan tidak lulus yang menunggu tindak lanjut
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
                      Tidak Lulus
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