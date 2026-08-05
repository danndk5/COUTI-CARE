import { useState, useEffect, useRef } from "react";
import Btn from "../components/Btn";
import Card from "../components/Card";
import Icon from "../components/Icon";
import SectionLabel from "../components/SectionLabel";
import theme from "../styles/theme";
import { supabase } from "../lib/supabase";
import { useCameraGPS } from "../hooks/useCameraGPS";
import { useBackableView, goBack } from "../hooks/useBackableView";

// ── Draft persistence ─────────────────────────────────────────────────────────
// Beda dari HSEFormScreen (form linear satu draft), di sini yang disimpan
// adalah progres tindak lanjut untuk SATU kendaraan yang sedang dibuka
// (selected + isian tl). Kalau app ke-close di tengah isi tindak lanjut,
// begitu dibuka lagi akan ditawarkan untuk melanjutkan kendaraan yang sama.
const DRAFT_KEY = "p1_tindaklanjut_draft_v1";
const DRAFT_EXPIRE_MS = 6 * 60 * 60 * 1000;

const saveDraft = (data) => {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(data)); } catch {}
};
const loadDraft = () => {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};
const clearDraft = () => {
  try { localStorage.removeItem(DRAFT_KEY); } catch {}
};

// ── Overlay & upload helper (pola sama dengan HSEFormScreen / P1FormScreen) ──
const decimalToDMS = (decimal, posDir, negDir) => {
  const dir = decimal >= 0 ? posDir : negDir;
  const abs = Math.abs(decimal);
  const deg = Math.floor(abs);
  const minFull = (abs - deg) * 60;
  const min = Math.floor(minFull);
  const sec = Math.round((minFull - min) * 60);
  return `${deg}\u00b0${min}'${sec}"${dir}`;
};
const formatDMS = (lat, lng) =>
  `${decimalToDMS(lat, "N", "S")} ${decimalToDMS(lng, "E", "W")}`;
const formatServerTime = (date) => {
  const hari  = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"][date.getDay()];
  const bulan = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"][date.getMonth()];
  const hh = String(date.getHours()).padStart(2,"0");
  const mm = String(date.getMinutes()).padStart(2,"0");
  const ss = String(date.getSeconds()).padStart(2,"0");
  return `${hari}, ${date.getDate()} ${bulan} ${date.getFullYear()} ${hh}:${mm}:${ss}`;
};

const applyOverlay = async (file, pos) => {
  let serverTime = new Date();
  try {
    const { data } = await supabase.rpc("get_server_time");
    if (data) serverTime = new Date(data);
  } catch {}

  const { latitude, longitude } = pos.coords;
  const dmsStr  = formatDMS(latitude, longitude);
  const timeStr = formatServerTime(serverTime);

  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    bitmap = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = URL.createObjectURL(file);
    });
  }

  const MAX_DIM = 1600;
  let targetW = bitmap.width, targetH = bitmap.height;
  if (Math.max(targetW, targetH) > MAX_DIM) {
    const scale = MAX_DIM / Math.max(targetW, targetH);
    targetW = Math.round(targetW * scale);
    targetH = Math.round(targetH * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width  = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0, targetW, targetH);
  if (bitmap.close) bitmap.close();

  const fontSize = Math.max(20, Math.round(targetW * 0.028));
  const pad      = fontSize * 0.7;
  const lineH    = fontSize * 1.6;
  ctx.font = `bold ${fontSize}px Arial, sans-serif`;
  const boxW = Math.max(ctx.measureText(timeStr).width, ctx.measureText(dmsStr).width) + pad * 2.5;
  const boxH = lineH * 2 + pad * 1.5;
  const x    = pad;
  const y    = canvas.height - boxH - pad;
  ctx.fillStyle = "rgba(0,0,0,0.60)";
  ctx.fillRect(x, y, boxW, boxH);
  ctx.font = `bold ${fontSize}px Arial, sans-serif`;
  ctx.fillStyle = "#ffffff";
  ctx.fillText(timeStr, x + pad, y + pad + fontSize);
  ctx.fillText(dmsStr,  x + pad, y + pad + fontSize + lineH);

  return new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.9));
};

const uploadFoto = async (file, kategori, pos) => {
  const blob = await applyOverlay(file, pos);
  const fileName = `p1-tl-${kategori}-${Date.now()}.jpg`;
  const { data, error } = await supabase.storage
    .from("foto-inspeksi").upload(fileName, blob, { contentType: "image/jpeg" });
  if (error) throw new Error("Foto gagal diupload: " + error.message);
  const { data: pub } = supabase.storage.from("foto-inspeksi").getPublicUrl(data.path);
  return { name: fileName, url: pub.publicUrl, path: data.path };
};

// ── PhotoLightbox — preview foto full-screen sebelum dikirim ──────────────────
// Tombol back HP menutup lightbox ini (bukan langsung keluar dari layar) —
// lihat useBackableView di hooks/useBackableView.js.
const PhotoLightbox = ({ url, onClose }) => {
  useBackableView(!!url, onClose);

  if (!url) return null;
  return (
    <div
      onClick={() => goBack(onClose)}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", zIndex: 9999,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      }}
    >
      <div
        onClick={() => goBack(onClose)}
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

// ── CameraCaptureSingle — 1 foto wajib, kamera & GPS sudah "hangat" ──────────
const CameraCaptureSingle = ({ label, onFoto, foto, errorFoto, onPreview, requestAccess }) => {
  const [capState, setCapState] = useState("idle");
  const [permErr,  setPermErr]  = useState(null);
  const fileInputRef = useRef(null);
  const cachedPosRef  = useRef(null);

  const handleCaptureClick = async () => {
    setPermErr(null);
    setCapState("checking");
    try {
      cachedPosRef.current = await requestAccess();
      setCapState("idle");
      fileInputRef.current?.click();
    } catch {
      setCapState("idle");
      setPermErr("Izin kamera/lokasi diperlukan. Aktifkan di pengaturan browser.");
    }
  };

  const handleFileChange = async (e) => {
    const file = (e.target.files || [])[0];
    if (!file) return;
    setCapState("processing");
    try {
      const result = await uploadFoto(file, label.replace(/\s+/g, "_").toLowerCase(), cachedPosRef.current);
      onFoto(result);
    } catch (err) {
      alert("⚠️ " + err.message);
    } finally {
      setCapState("idle");
      cachedPosRef.current = null;
      e.target.value = "";
    }
  };

  const removeFoto = async () => {
    if (foto?.path) await supabase.storage.from("foto-inspeksi").remove([foto.path]).catch(() => {});
    onFoto(null);
  };

  const isWorking = capState !== "idle";

  return (
    <div>
      <div style={{
        border: `2px dashed ${errorFoto ? theme.danger : theme.border}`, borderRadius: 10, padding: "12px",
        background: errorFoto ? theme.dangerLight : "transparent",
      }}>
        {permErr && (
          <div style={{ marginBottom: 8, padding: "6px 10px", borderRadius: 8, background: theme.dangerLight, color: theme.danger, fontSize: 12, fontWeight: 600 }}>
            ⛔ {permErr}
          </div>
        )}
        <input ref={fileInputRef} type="file" accept="image/*" capture="environment"
          onChange={handleFileChange} style={{ display: "none" }} />
        {foto ? (
          <div style={{ padding: "8px 10px", background: theme.primaryLight, borderRadius: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <img
                src={foto.url}
                alt={foto.name}
                onClick={() => onPreview?.(foto.url)}
                style={{ width: 42, height: 42, borderRadius: 6, objectFit: "cover", cursor: "pointer", border: `1px solid ${theme.primary}`, flexShrink: 0 }}
              />
              <div style={{ flex: 1, fontSize: 12, color: theme.primary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                ✓ Foto tindak lanjut tersimpan
              </div>
              <div onClick={() => onPreview?.(foto.url)} style={{ cursor: "pointer", fontSize: 12, color: theme.primary, fontWeight: 700, flexShrink: 0 }}>
                🔍 Lihat
              </div>
              <div onClick={removeFoto} style={{ cursor: "pointer", fontWeight: 700, color: theme.danger, flexShrink: 0 }}>✕</div>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 8 }}>📷 Foto dokumentasi tindak lanjut</div>
            <Btn onClick={handleCaptureClick} variant="outline" style={{ padding: "7px 16px", fontSize: 12 }} disabled={isWorking}>
              {capState === "checking" ? "🔐 Cek izin..." : capState === "processing" ? "⏳ Memproses..." : "📷 Ambil Foto"}
            </Btn>
          </div>
        )}
      </div>
      {errorFoto && <div style={{ fontSize: 11, color: theme.danger, fontWeight: 600, marginTop: 4 }}>⚠️ Foto wajib diambil.</div>}
    </div>
  );
};

// ── Foto temuan ASLI dari P1FormScreen (bukan foto tindak lanjut) ────────────
// Sumber: tabel foto_inspeksi_p1, direlasikan via temuan_id → inspeksi_p1_temuan.id
// FIX BUG: sebelumnya foto ini sama sekali tidak diambil dari query maupun
// dirender di TindakLanjutItem, jadi P1 (dan siapa pun yang menindaklanjuti)
// tidak bisa melihat foto asli temuan yang dilaporkan.
const TemuanFotoGrid = ({ fotoList, onPreview }) => {
  if (!fotoList || fotoList.length === 0) return null;
  return (
    <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
      {fotoList.map((f) => (
        <img
          key={f.id}
          src={f.url}
          alt="Foto temuan"
          onClick={() => onPreview?.(f.url)}
          style={{ width: "100%", height: 80, objectFit: "cover", borderRadius: 8, cursor: "pointer", border: `1px solid ${theme.border}` }}
        />
      ))}
    </div>
  );
};

// ── Form Tindak Lanjut per temuan ─────────────────────────────────────────────
const TindakLanjutItem = ({ idx, temuan, tl, onChange, onPreview, requestAccess }) => {
  const set = (k) => (v) => onChange(temuan.id, k, v);
  const handleFile = (fd) => onChange(temuan.id, "foto", fd);

  return (
    <div style={{ background: theme.surface, border: `1.5px solid ${theme.border}`, borderRadius: 14, padding: 16, marginBottom: 14 }}>
      {/* Temuan asli — sekarang termasuk foto dokumentasi temuan (fix bug) */}
      <div style={{ marginBottom: 12, padding: "10px 12px", background: theme.dangerLight, borderRadius: 10 }}>
        <div style={{ fontSize: 11, color: theme.danger, fontWeight: 700, marginBottom: 2 }}>📌 TEMUAN #{idx + 1}</div>
        <div style={{ fontWeight: 700, fontSize: 14, color: theme.text }}>{temuan.judul}</div>
        <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 4 }}>{temuan.keterangan}</div>
        <TemuanFotoGrid fotoList={temuan.foto_inspeksi_p1} onPreview={onPreview} />
      </div>

      {/* Form tindak lanjut */}
      <div style={{ fontSize: 13, fontWeight: 600, color: theme.textSub, marginBottom: 6 }}>Tindakan yang Dilakukan</div>
      <textarea
        placeholder="Tuliskan tindak lanjut yang dilakukan untuk temuan ini..."
        value={tl.catatan || ""}
        onChange={(e) => set("catatan")(e.target.value)}
        style={{
          width: "100%", padding: "10px 12px", borderRadius: 10,
          border: `1.5px solid ${tl.errorCatatan ? theme.danger : theme.border}`,
          background: tl.errorCatatan ? theme.dangerLight : theme.surfaceAlt,
          color: theme.text, fontSize: 13, fontFamily: "'DM Sans',sans-serif",
          resize: "none", minHeight: 80, boxSizing: "border-box", outline: "none", marginBottom: 10,
        }}
      />
      {tl.errorCatatan && <div style={{ fontSize: 11, color: theme.danger, fontWeight: 600, marginBottom: 8 }}>⚠️ Tindakan wajib diisi.</div>}

      <div style={{ fontSize: 13, fontWeight: 600, color: theme.textSub, marginBottom: 6 }}>Foto Dokumentasi Tindak Lanjut (wajib)</div>
      <CameraCaptureSingle
        label={`Foto TL ${idx + 1}`}
        onFoto={handleFile}
        foto={tl.foto}
        errorFoto={tl.errorFoto || false}
        onPreview={onPreview}
        requestAccess={requestAccess}
      />

      {/* Tandai selesai */}
      <div onClick={() => set("selesai")(!tl.selesai)} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", marginTop: 12, padding: "10px 12px", borderRadius: 10, background: tl.selesai ? theme.successLight : theme.surfaceAlt, border: `1.5px solid ${tl.selesai ? theme.success : theme.border}` }}>
        <div style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${tl.selesai ? theme.success : theme.border}`, background: tl.selesai ? theme.success : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {tl.selesai && <Icon name="check" size={13} color="#fff" />}
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color: tl.selesai ? theme.success : theme.textMuted }}>
          {tl.selesai ? "✓ Ditandai selesai" : "Tandai selesai"}
        </span>
      </div>
    </div>
  );
};

// ── P1TindakLanjut ────────────────────────────────────────────────────────────
const P1TindakLanjut = ({ onBack, onNav }) => {
  const [inspeksiList, setInspeksiList] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [selected,     setSelected]     = useState(null);
  const [temuanList,   setTemuanList]   = useState([]);
  const [tl,           setTL]           = useState({});
  const [saving,       setSaving]       = useState(false);
  const [previewUrl,   setPreviewUrl]   = useState(null);

  // GPS/kamera di-"hangat"-kan sejak layar ini dibuka — sama seperti
  // HSEFormScreen / P1FormScreen, supaya foto tindak lanjut langsung instan.
  const { warmUp, coolDown, requestAccess } = useCameraGPS();
  useEffect(() => {
    warmUp();
    return () => coolDown();
  }, [warmUp, coolDown]);

  // ── Draft persistence — hanya 1 slot, untuk kendaraan yang terakhir dibuka ──
  const draftCreatedAtRef = useRef(null);
  const [restoreCandidate, setRestoreCandidate] = useState(null); // { insp, tl } kalau ada draft valid

  // ── Cleanup foto "orphan" — kalau layar ini di-unmount (user keluar
  // sepenuhnya dari layar Tindak Lanjut) tanpa sempat Simpan, foto yang
  // sudah terlanjur ke-upload untuk kendaraan yang sedang dikerjakan
  // dihapus lagi dari storage. submittedRef di-reset tiap buka kendaraan
  // baru (openDetail) supaya tidak salah menandai sesi yang belum disimpan.
  const allFotoPaths = useRef([]);
  const submittedRef = useRef(false);

  useEffect(() => {
    allFotoPaths.current = Object.values(tl).map((t) => t.foto?.path).filter(Boolean);
  }, [tl]);

  useEffect(() => {
    return () => {
      if (!submittedRef.current && allFotoPaths.current.length > 0) {
        supabase.storage.from("foto-inspeksi").remove(allFotoPaths.current).catch(console.error);
      }
    };
  }, []);

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (loading) return;
    const draft = loadDraft();
    if (!draft) return;
    const age = Date.now() - (draft.createdAt || 0);
    if (!draft.createdAt || age > DRAFT_EXPIRE_MS) { clearDraft(); return; }
    const insp = inspeksiList.find((i) => i.id === draft.inspId);
    if (insp) {
      setRestoreCandidate({ insp, tl: draft.tl || {}, createdAt: draft.createdAt });
    } else {
      clearDraft();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, inspeksiList]);

  // Auto-save progres tindak lanjut selama layar detail terbuka
  useEffect(() => {
    if (!selected) return;
    if (!draftCreatedAtRef.current) draftCreatedAtRef.current = Date.now();
    saveDraft({ createdAt: draftCreatedAtRef.current, inspId: selected.id, tl });
  }, [selected, tl]);

  const loadData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    // FIX BUG: query sebelumnya hanya select inspeksi_p1_temuan(*), tidak
    // pernah mengambil foto_inspeksi_p1 sama sekali. Sekarang di-nested
    // supaya foto dokumentasi temuan ikut terbawa dan bisa dirender di
    // TindakLanjutItem (lihat TemuanFotoGrid).
    const { data } = await supabase
      .from("inspeksi_p1")
      .select("*, inspeksi_p1_temuan(*, foto_inspeksi_p1(*))")
      .eq("user_id", user.id)
      .neq("status", "selesai")
      .order("created_at", { ascending: false });
    setInspeksiList((data || []).filter(i => i.inspeksi_p1_temuan?.length > 0));
    setLoading(false);
  };

  const openDetail = (insp, restoredTl, restoredCreatedAt) => {
    submittedRef.current = false;
    draftCreatedAtRef.current = restoredTl ? (restoredCreatedAt || Date.now()) : null;
    setRestoreCandidate(null);
    setSelected(insp);
    const list = insp.inspeksi_p1_temuan || [];
    setTemuanList(list);
    const init = {};
    list.forEach(t => {
      init[t.id] = restoredTl?.[t.id]
        ? { catatan: "", foto: null, selesai: false, errorCatatan: false, errorFoto: false, ...restoredTl[t.id] }
        : { catatan: "", foto: null, selesai: false, errorCatatan: false, errorFoto: false };
    });
    setTL(init);
  };

  const updateTL = (temuanId, key, val) =>
    setTL(prev => ({ ...prev, [temuanId]: { ...prev[temuanId], [key]: val } }));

  const handleSave = async () => {
    // Validasi — tindakan DAN foto wajib untuk setiap temuan
    let valid = true;
    const updated = { ...tl };
    Object.entries(tl).forEach(([id, t]) => {
      const eC = !t.catatan.trim();
      const eF = !t.foto;
      if (eC || eF) { updated[id] = { ...t, errorCatatan: eC, errorFoto: eF }; valid = false; }
    });
    if (!valid) { setTL(updated); alert("Lengkapi tindakan dan foto dokumentasi untuk setiap temuan!"); return; }

    setSaving(true);
    try {
      for (const [temuanId, t] of Object.entries(tl)) {
        // Insert tindak lanjut
        await supabase.from("tindaklanjut_p1").insert([{
          inspeksi_id: selected.id,
          temuan_id: temuanId,
          catatan: t.catatan,
          foto_url: t.foto?.url || null,
          status: t.selesai ? "selesai" : "dikerjakan",
        }]);
        // Update status temuan kalau ditandai selesai
        if (t.selesai) {
          await supabase.from("inspeksi_p1_temuan").update({ status: "selesai" }).eq("id", temuanId);
        }
      }

      // Cek apakah semua temuan selesai → update inspeksi
      const { data: allTemuan } = await supabase
        .from("inspeksi_p1_temuan").select("status").eq("inspeksi_id", selected.id);
      if (allTemuan?.every(t => t.status === "selesai")) {
        await supabase.from("inspeksi_p1").update({ status: "selesai" }).eq("id", selected.id);
      }

      clearDraft();
      draftCreatedAtRef.current = null;
      submittedRef.current = true;
      alert("✓ Tindak lanjut berhasil disimpan!");
      setSelected(null);
      loadData();
    } catch (err) {
      alert("Gagal menyimpan: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const restoreBanner = restoreCandidate && (
    <div style={{
      margin: "0 16px 12px", padding: "10px 14px", borderRadius: 10,
      background: "#FEF3C7", color: "#92400E", fontSize: 12, fontWeight: 600,
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap",
    }}>
      <span>♻️ Ada progres tindak lanjut <b>{restoreCandidate.insp.nomor_polisi}</b> yang belum tersimpan.</span>
      <div style={{ display: "flex", gap: 12, flexShrink: 0 }}>
        <span
          onClick={() => openDetail(restoreCandidate.insp, restoreCandidate.tl, restoreCandidate.createdAt)}
          style={{ cursor: "pointer", textDecoration: "underline" }}
        >
          Lanjutkan
        </span>
        <span
          onClick={() => { clearDraft(); setRestoreCandidate(null); }}
          style={{ cursor: "pointer" }}
        >
          ✕ Buang
        </span>
      </div>
    </div>
  );

  // ── Detail tindak lanjut ──────────────────────────────────────────────────
  if (selected) {
    return (
      <div style={{ minHeight: "100vh", background: theme.bg, display: "flex", flexDirection: "column" }}>
        <div style={{ background: theme.surface, padding: "48px 16px 16px", borderBottom: `1px solid ${theme.border}`, boxShadow: theme.shadow }}>
          <div onClick={() => setSelected(null)} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14, cursor: "pointer", color: theme.textSub, fontSize: 13 }}>
            <Icon name="arrow" size={16} color={theme.textSub} /> Kembali
          </div>
          <div style={{ fontWeight: 800, fontSize: 18, color: theme.text }}>Tindak Lanjut</div>
          <div style={{ fontSize: 13, color: theme.textMuted, marginTop: 2 }}>
            {selected.nomor_polisi} · {selected.transportir}
          </div>
          <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 2 }}>
            {selected.kapasitas_mt} · {selected.jumlah_kompartemen} kompartemen · {selected.kategori_mt === "merah_putih" ? "MT Merah Putih" : "MT Industri"}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "20px 16px", paddingBottom: 90 }}>
          <SectionLabel>Temuan yang Perlu Ditindaklanjuti</SectionLabel>
          <div style={{ fontSize: 13, color: theme.textMuted, marginBottom: 16 }}>
            Isi tindakan dan foto dokumentasi untuk setiap temuan (keduanya wajib). Centang <b>selesai</b> jika sudah tuntas ditangani.
          </div>
          {temuanList.map((t, i) => (
            <TindakLanjutItem
              key={t.id} idx={i} temuan={t} tl={tl[t.id] || {}}
              onChange={updateTL} onPreview={setPreviewUrl} requestAccess={requestAccess}
            />
          ))}
        </div>

        <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, padding: "12px 16px", background: theme.surface, borderTop: `1px solid ${theme.border}` }}>
          <Btn onClick={handleSave} variant="primary" icon="check" disabled={saving}>
            {saving ? "Menyimpan..." : "Simpan Tindak Lanjut"}
          </Btn>
        </div>

        <PhotoLightbox url={previewUrl} onClose={() => setPreviewUrl(null)} />
      </div>
    );
  }

  // ── Daftar inspeksi pending ───────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: theme.bg, paddingBottom: 40 }}>
      <div style={{ background: theme.surface, padding: "48px 16px 16px", borderBottom: `1px solid ${theme.border}`, boxShadow: theme.shadow }}>
        <div onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14, cursor: "pointer", color: theme.textSub, fontSize: 13 }}>
          <Icon name="arrow" size={16} color={theme.textSub} /> Kembali
        </div>
        <div style={{ fontWeight: 800, fontSize: 18, color: theme.text }}>Tindak Lanjut</div>
        <div style={{ fontSize: 13, color: theme.textMuted, marginTop: 2 }}>Kendaraan dengan temuan yang belum diselesaikan</div>
      </div>

      {restoreBanner}

      <div style={{ padding: "20px 16px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: theme.textMuted }}>Memuat data...</div>
        ) : inspeksiList.length === 0 ? (
          <Card style={{ padding: 40, textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>✅</div>
            <div style={{ fontWeight: 700, fontSize: 15, color: theme.text }}>Semua sudah beres!</div>
            <div style={{ fontSize: 13, color: theme.textMuted, marginTop: 6 }}>Tidak ada temuan yang perlu ditindaklanjuti saat ini.</div>
          </Card>
        ) : inspeksiList.map((insp) => (
          <Card key={insp.id} style={{ marginBottom: 12, padding: "14px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: theme.dangerLight, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon name="car" size={20} color={theme.danger} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: theme.text }}>{insp.nomor_polisi}</div>
                <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>{insp.transportir}</div>
                <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 2 }}>
                  {insp.kapasitas_mt} · {insp.kategori_mt === "merah_putih" ? "MT Merah Putih" : "MT Industri"}
                </div>
                <div style={{ fontSize: 11, color: theme.danger, fontWeight: 600, marginTop: 4 }}>
                  {insp.inspeksi_p1_temuan?.length || 0} temuan belum ditindaklanjuti
                </div>
              </div>
              <Btn onClick={() => openDetail(insp)} variant="primary" style={{ padding: "8px 14px", fontSize: 12, background: "#7C3AED", border: "none" }}>
                Tindak Lanjut
              </Btn>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default P1TindakLanjut;