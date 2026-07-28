import { useState, useEffect, useRef, useCallback } from "react";
import Btn from "../components/Btn";
import Icon from "../components/Icon";
import Input from "../components/Input";
import SectionLabel from "../components/SectionLabel";
import theme from "../styles/theme";
import { supabase } from "../lib/supabase";
import sop1 from "../assets/acuan/01.png";
import sop2 from "../assets/acuan/02.png";
import sop3 from "../assets/acuan/03.png";
import sop4 from "../assets/acuan/04.png";
import sop5 from "../assets/acuan/05.png";
import sop6 from "../assets/acuan/06.png";
import sop7 from "../assets/acuan/07.png";
import sop8 from "../assets/acuan/08.png";
import sop9 from "../assets/acuan/09.png";
import sop10 from "../assets/acuan/10.png";
import sop11 from "../assets/acuan/11.png";
import sop12 from "../assets/acuan/12.png";
import sop13 from "../assets/acuan/13.png";
import sop14 from "../assets/acuan/14.png";
import sop15 from "../assets/acuan/15.png";
import sop16 from "../assets/acuan/16.png";

const SOP_IMAGES = [sop1, sop2, sop3, sop4, sop5, sop6, sop7, sop8, sop9, sop10, sop11, sop12, sop13, sop14, sop15, sop16];

const CHECKPOINTS = [
  { menit: 0,  label: "Menit Awal (0 Menit)" },
  { menit: 5,  label: "5 Menit Pertama" },
  { menit: 10, label: "5 Menit Kedua (10 Menit)" },
  { menit: 15, label: "5 Menit Ketiga (15 Menit)" },
  { menit: 20, label: "5 Menit Keempat (20 Menit)" },
  { menit: 25, label: "5 Menit Kelima (25 Menit)" },
  { menit: 30, label: "5 Menit Keenam (30 Menit)" },
];

// ── Draft persistence (agar data tidak hilang kalau app ke-close / ke tombol home) ──
const DRAFT_KEY = "hse_form_draft_v1";

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

// ── Helpers timestamp & GPS ───────────────────────────────────────────────────
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

// ── applyOverlay (shared) ─────────────────────────────────────────────────────
const applyOverlay = async (file) => {
  let serverTime = new Date();
  try {
    const { data } = await supabase.rpc("get_server_time");
    if (data) serverTime = new Date(data);
  } catch {}

  const pos = await new Promise((res, rej) =>
    navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 15000 })
  );
  const { latitude, longitude } = pos.coords;
  const dmsStr  = formatDMS(latitude, longitude);
  const timeStr = formatServerTime(serverTime);

  const img = await new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = URL.createObjectURL(file);
  });

  const canvas = document.createElement("canvas");
  canvas.width  = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);

  const fontSize = Math.max(20, Math.round(img.width * 0.028));
  const pad      = fontSize * 0.7;
  const lineH    = fontSize * 1.6;
  ctx.font = `bold ${fontSize}px Arial, sans-serif`;
  const boxW = Math.max(ctx.measureText(timeStr).width, ctx.measureText(dmsStr).width) + pad * 2.5;
  const boxH = lineH * 2 + pad * 1.5;
  const x    = pad;
  const y    = canvas.height - boxH - pad;
  ctx.fillStyle = "rgba(0,0,0,0.60)";
  ctx.fillRect(x, y, boxW, boxH);
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold ${fontSize}px Arial, sans-serif`;
  ctx.fillText(timeStr, x + pad, y + pad + fontSize);
  ctx.fillText(dmsStr,  x + pad, y + pad + fontSize + lineH);

  return new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.92));
};

// ── uploadFoto (shared) ───────────────────────────────────────────────────────
const uploadFoto = async (file, kategori) => {
  const blob     = await applyOverlay(file);
  const fileName = `hse-${kategori}-${Date.now()}.jpg`;
  const { data, error } = await supabase.storage
    .from("foto-inspeksi").upload(fileName, blob, { contentType: "image/jpeg" });
  if (error) throw new Error("Foto gagal diupload: " + error.message);
  const { data: pub } = supabase.storage.from("foto-inspeksi").getPublicUrl(data.path);
  return { name: fileName, url: pub.publicUrl, path: data.path };
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

// ── CameraCapture — 1 foto, wajib ────────────────────────────────────────────
const CameraCaptureSingle = ({ label, onFoto, foto, errorFoto, onPreview }) => {
  const [capState, setCapState] = useState("idle");
  const [permErr,  setPermErr]  = useState(null);
  const fileInputRef = useRef(null);

  const handleCaptureClick = async () => {
    setPermErr(null);
    setCapState("checking");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      stream.getTracks().forEach((t) => t.stop());
      await new Promise((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 10000 })
      );
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
      const result = await uploadFoto(file, label.replace(/\s+/g, "_").toLowerCase());
      onFoto(result);
    } catch (err) {
      alert("⚠️ " + err.message);
    } finally {
      setCapState("idle");
      e.target.value = "";
    }
  };

  const removeFoto = async () => {
    if (foto?.path) await supabase.storage.from("foto-inspeksi").remove([foto.path]).catch(() => {});
    onFoto(null);
  };

  const isWorking = capState !== "idle";

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{
        border: `2px dashed ${errorFoto ? theme.danger : theme.border}`, borderRadius: 10, padding: "12px 14px",
        background: errorFoto ? theme.dangerLight : "transparent",
      }}>
        <div style={{ fontSize: 11, color: errorFoto ? theme.danger : theme.textMuted, marginBottom: 8, textAlign: "center" }}>
          {label}
          <div style={{ marginTop: 2 }}>📷 Kamera belakang · ⏱ Timestamp · 📍 GPS</div>
        </div>
        {permErr && (
          <div style={{ marginBottom: 8, padding: "6px 10px", borderRadius: 8, background: theme.dangerLight, color: theme.danger, fontSize: 12, fontWeight: 600 }}>
            ⛔ {permErr}
          </div>
        )}
        <input ref={fileInputRef} type="file" accept="image/*" capture="environment"
          onChange={handleFileChange} style={{ display: "none" }} />
        {foto ? (
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "8px 10px", background: theme.primaryLight, borderRadius: 8,
          }}>
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
        ) : (
          <Btn onClick={handleCaptureClick} variant="outline"
            style={{ padding: "9px", fontSize: 13, width: "100%" }} disabled={isWorking}>
            {capState === "checking" ? "🔐 Cek izin..." : capState === "processing" ? "⏳ Memproses..." : "📷 Ambil Foto"}
          </Btn>
        )}
      </div>
      {errorFoto && (
        <div style={{ marginTop: 4, fontSize: 12, color: theme.danger, fontWeight: 600 }}>⚠️ Foto wajib diambil.</div>
      )}
    </div>
  );
};

// ── CameraCapture — multi foto dengan keterangan per foto ─────────────────────
const CameraCaptureMulti = ({ kategori, fotoList, onFotoList, onPreview }) => {
  const [capState, setCapState] = useState("idle");
  const [permErr,  setPermErr]  = useState(null);
  const fileInputRef = useRef(null);

  const handleCaptureClick = async () => {
    setPermErr(null);
    setCapState("checking");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      stream.getTracks().forEach((t) => t.stop());
      await new Promise((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 10000 })
      );
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
      const result = await uploadFoto(file, `${kategori}-${Date.now()}`);
      onFotoList((prev) => [...prev, { ...result, keterangan: "" }]);
    } catch (err) {
      alert("⚠️ " + err.message);
    } finally {
      setCapState("idle");
      e.target.value = "";
    }
  };

  const removeFoto = async (idx) => {
    const foto = fotoList[idx];
    if (foto?.path) await supabase.storage.from("foto-inspeksi").remove([foto.path]).catch(() => {});
    onFotoList((prev) => prev.filter((_, i) => i !== idx));
  };

  const setKeterangan = (idx, val) => {
    onFotoList((prev) => prev.map((f, i) => i === idx ? { ...f, keterangan: val } : f));
  };

  const isWorking = capState !== "idle";

  return (
    <div>
      {permErr && (
        <div style={{ marginBottom: 8, padding: "6px 10px", borderRadius: 8, background: theme.dangerLight, color: theme.danger, fontSize: 12, fontWeight: 600 }}>
          ⛔ {permErr}
        </div>
      )}
      <input ref={fileInputRef} type="file" accept="image/*" capture="environment"
        onChange={handleFileChange} style={{ display: "none" }} />

      {/* Daftar foto yang sudah diambil */}
      {fotoList.map((foto, idx) => (
        <div key={foto.path} style={{ marginBottom: 10, padding: 12, borderRadius: 10, background: theme.surfaceAlt, border: `1px solid ${theme.border}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              <img
                src={foto.url}
                alt={foto.name}
                onClick={() => onPreview?.(foto.url)}
                style={{ width: 42, height: 42, borderRadius: 6, objectFit: "cover", cursor: "pointer", border: `1px solid ${theme.primary}`, flexShrink: 0 }}
              />
              <div style={{ fontSize: 12, color: theme.primary, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                ✓ Foto {idx + 1}: {foto.name}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
              <div onClick={() => onPreview?.(foto.url)} style={{ cursor: "pointer", fontSize: 12, color: theme.primary, fontWeight: 700 }}>
                🔍 Lihat
              </div>
              <div onClick={() => removeFoto(idx)} style={{ cursor: "pointer", fontWeight: 700, color: theme.danger, fontSize: 13 }}>✕</div>
            </div>
          </div>
          <textarea
            placeholder="Keterangan foto ini (wajib)..."
            value={foto.keterangan}
            onChange={(e) => setKeterangan(idx, e.target.value)}
            style={{
              width: "100%", padding: "8px 10px", borderRadius: 8,
              border: `1.5px solid ${!foto.keterangan.trim() ? theme.danger : theme.border}`,
              background: !foto.keterangan.trim() ? theme.dangerLight : theme.surface,
              color: theme.text, fontSize: 13, fontFamily: "'DM Sans', sans-serif",
              resize: "none", minHeight: 60, boxSizing: "border-box", outline: "none",
            }}
          />
          {!foto.keterangan.trim() && (
            <div style={{ fontSize: 11, color: theme.danger, fontWeight: 600, marginTop: 3 }}>⚠️ Keterangan wajib diisi.</div>
          )}
        </div>
      ))}

      <Btn onClick={handleCaptureClick} variant="outline"
        style={{ padding: "9px", fontSize: 13, width: "100%" }} disabled={isWorking}>
        {capState === "checking" ? "🔐 Cek izin..." : capState === "processing" ? "⏳ Memproses..." : `📷 Tambah Foto Temuan`}
      </Btn>
    </div>
  );
};

// ── HSEFormScreen ─────────────────────────────────────────────────────────────
const HSEFormScreen = ({ onBack, onNav }) => {
  const [step,        setStep]        = useState("sop");
  const [sopPage,     setSopPage]     = useState(0);
  const [currentUser, setCurrentUser] = useState(null);
  const [submitting,  setSubmitting]  = useState(false);

  // Auto-fill kendaraan
  const [lookupStatus, setLookupStatus] = useState("idle");
  const [isAutoFilled, setIsAutoFilled] = useState(false);
  const lookupTimer = useRef(null);

  // Data kendaraan
  const [kendaraan, setKendaraan] = useState({
    polisi: "", kapasitas: "", kompartemen: "", transportir: "",
  });
  const setK = (k) => (v) => setKendaraan((p) => ({ ...p, [k]: v }));

  // Kategori MT
  const [kategoriMT, setKategoriMT] = useState("");

  // State uji kedap — 7 checkpoint, masing-masing: { status, foto }
  // Kalau tidak kedap: fotoTemuan (array { name, url, path, keterangan })
  const initCheckpoints = () =>
    CHECKPOINTS.map((cp) => ({ menit: cp.menit, status: "", foto: null }));

  const [checkpoints,  setCheckpoints]  = useState(initCheckpoints);
  const [fotoTemuan,   setFotoTemuan]   = useState([]); // foto bebas saat tidak kedap

  // Preview foto (lightbox) — untuk cek foto blur/buram sebelum dikirim
  const [previewUrl, setPreviewUrl] = useState(null);

  // Draft/auto-save — supaya data tidak hilang kalau app ke-close tiba-tiba
  const [ready, setReady] = useState(false);
  const [showRestoreBanner, setShowRestoreBanner] = useState(false);

  // Errors
  const [errors, setErrors] = useState({});

  // Semua path foto untuk cleanup orphan
  const allFotoPaths = useRef([]);
  const submittedRef = useRef(false);

  useEffect(() => {
    const cpPaths   = checkpoints.map((cp) => cp.foto?.path).filter(Boolean);
    const temuanPaths = fotoTemuan.map((f) => f.path).filter(Boolean);
    allFotoPaths.current = [...cpPaths, ...temuanPaths];
  }, [checkpoints, fotoTemuan]);

  useEffect(() => {
    return () => {
      if (!submittedRef.current && allFotoPaths.current.length > 0) {
        supabase.storage.from("foto-inspeksi").remove(allFotoPaths.current).catch(console.error);
      }
    };
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUser(user.id);
    });
  }, []);

  // Pulihkan draft form dari localStorage (kalau ada) saat pertama kali dibuka
  useEffect(() => {
    const draft = loadDraft();
    if (draft) {
      setStep(draft.step || "sop");
      setSopPage(draft.sopPage || 0);
      setKendaraan(draft.kendaraan || { polisi: "", kapasitas: "", kompartemen: "", transportir: "" });
      setKategoriMT(draft.kategoriMT || "");
      setIsAutoFilled(!!draft.isAutoFilled);
      setLookupStatus(draft.isAutoFilled ? "found" : "idle");
      setCheckpoints(draft.checkpoints && draft.checkpoints.length ? draft.checkpoints : initCheckpoints());
      setFotoTemuan(draft.fotoTemuan || []);
      setShowRestoreBanner(true);
    }
    setReady(true);
  }, []);

  // Simpan draft form setiap ada perubahan (debounce ringan lewat effect)
  useEffect(() => {
    if (!ready) return;
    const hasProgress =
      step !== "sop" || sopPage > 0 || kendaraan.polisi.trim() || kategoriMT || fotoTemuan.length > 0;
    if (!hasProgress) { clearDraft(); return; }
    saveDraft({ step, sopPage, kendaraan, kategoriMT, isAutoFilled, checkpoints, fotoTemuan });
  }, [ready, step, sopPage, kendaraan, kategoriMT, isAutoFilled, checkpoints, fotoTemuan]);

  const resetSemua = () => {
    clearDraft();
    setStep("sop");
    setSopPage(0);
    setKendaraan({ polisi: "", kapasitas: "", kompartemen: "", transportir: "" });
    setKategoriMT("");
    setIsAutoFilled(false);
    setLookupStatus("idle");
    setCheckpoints(initCheckpoints());
    setFotoTemuan([]);
    setShowRestoreBanner(false);
  };

  const restoreBanner = showRestoreBanner && (
    <div style={{
      margin: "0 16px 12px", padding: "10px 14px", borderRadius: 10,
      background: "#FEF3C7", color: "#92400E", fontSize: 12, fontWeight: 600,
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
    }}>
      <span>♻️ Data pengisian sebelumnya berhasil dipulihkan.</span>
      <div style={{ display: "flex", gap: 12, flexShrink: 0 }}>
        <span
          onClick={() => {
            if (window.confirm("Hapus semua data yang sudah diisi dan mulai formulir baru?")) {
              resetSemua();
            }
          }}
          style={{ cursor: "pointer", textDecoration: "underline" }}
        >
          Mulai Baru
        </span>
        <span onClick={() => setShowRestoreBanner(false)} style={{ cursor: "pointer" }}>✕</span>
      </div>
    </div>
  );

  // Debounce lookup nopol
  const handlePolisiChange = useCallback((val) => {
    setKendaraan((p) => ({ ...p, polisi: val, kapasitas: "", kompartemen: "", transportir: "" }));
    setIsAutoFilled(false);
    setLookupStatus("idle");
    if (lookupTimer.current) clearTimeout(lookupTimer.current);
    if (!val.trim()) return;
    lookupTimer.current = setTimeout(async () => {
      setLookupStatus("loading");
      try {
        const { data } = await supabase
          .from("kendaraan").select("transportir, kapasitas_mt, jumlah_kompartemen, kategori_mt")
          .eq("nomor_polisi", val.trim().toUpperCase()).maybeSingle();
        if (data) {
          setKendaraan((p) => ({
            ...p,
            transportir: data.transportir        || "",
            kapasitas:   data.kapasitas_mt        || "",
            kompartemen: data.jumlah_kompartemen?.toString() || "",
          }));
          if (data.kategori_mt) setKategoriMT(data.kategori_mt);
          setIsAutoFilled(true);
          setLookupStatus("found");
        } else {
          setLookupStatus("new");
        }
      } catch { setLookupStatus("new"); }
    }, 600);
  }, []);

  // Helper: index checkpoint tidak kedap (-1 kalau semua kedap)
  const idxTidakKedap = checkpoints.findIndex((cp) => cp.status === "tidak_kedap");
  const statusAkhir   = idxTidakKedap >= 0 ? "tidak_kedap"
    : checkpoints.every((cp) => cp.status === "kedap") ? "kedap" : "";

  const setCheckpointStatus = (idx, status) => {
    setCheckpoints((prev) => {
      const next = prev.map((cp, i) => {
        if (i === idx) return { ...cp, status };
        // Kalau tidak kedap dipilih, reset checkpoint setelahnya
        if (status === "tidak_kedap" && i > idx) return { ...cp, status: "", foto: null };
        return cp;
      });
      return next;
    });
    // Reset foto temuan kalau kembali pilih kedap
    if (status === "kedap") setFotoTemuan([]);
  };

  const setCheckpointFoto = (idx, foto) => {
    setCheckpoints((prev) => prev.map((cp, i) => i === idx ? { ...cp, foto } : cp));
  };

  // ── Navigasi ──────────────────────────────────────────────────────────────
  const handleLanjutSOP = () => {
    if (sopPage < SOP_IMAGES.length - 1) { setSopPage((p) => p + 1); return; }
    setStep("kendaraan");
  };
  const handleSkipSOP = () => setStep("kendaraan");

  const handleLanjutKendaraan = () => {
    const e = {};
    if (!kendaraan.polisi.trim())      e.polisi      = true;
    if (!kendaraan.kapasitas.trim())   e.kapasitas   = true;
    if (!kendaraan.kompartemen.trim()) e.kompartemen = true;
    if (!kendaraan.transportir.trim()) e.transportir = true;
    setErrors(e);
    if (Object.keys(e).length > 0) { alert("Semua data kendaraan wajib diisi!"); return; }
    setStep("kategori");
  };

  const handleLanjutKategori = () => {
    if (!kategoriMT) { alert("Pilih kategori MT terlebih dahulu!"); return; }
    setCheckpoints(initCheckpoints());
    setFotoTemuan([]);
    setStep("ujikedap");
  };

  const handleSubmit = async () => {
    const e = {};
    if (!statusAkhir) { e.uji_incomplete = true; }
    else if (statusAkhir === "kedap") {
      checkpoints.forEach((cp, i) => {
        if (!cp.foto) e[`cp_${i}_foto`] = true;
      });
    } else {
      // tidak kedap: semua foto temuan wajib ada keterangan
      fotoTemuan.forEach((f, i) => {
        if (!f.keterangan.trim()) e[`temuan_${i}_ket`] = true;
      });
      if (fotoTemuan.length === 0) e.temuan_foto = true;
    }
    setErrors(e);
    if (Object.keys(e).length > 0) { alert("Lengkapi semua data uji kedap!"); return; }

    setSubmitting(true);
    try {
      const { data: inspData, error: inspErr } = await supabase
        .from("inspeksi_hse").insert([{
          user_id:            currentUser,
          nomor_polisi:       kendaraan.polisi.trim().toUpperCase(),
          kapasitas_mt:       kendaraan.kapasitas,
          jumlah_kompartemen: parseInt(kendaraan.kompartemen),
          transportir:        kendaraan.transportir,
          kategori_mt:        kategoriMT,
          is_submitted:       true,
          submitted_at:       new Date().toISOString(),
          status:             statusAkhir === "kedap" ? "lulus" : "tidak_lulus",
        }]).select().single();
      if (inspErr) throw inspErr;

      submittedRef.current = true;

      // Simpan checkpoint data
      const { error: cpErr } = await supabase.from("inspeksi_hse_checkpoint").insert(
        checkpoints
          .filter((cp) => cp.status !== "")
          .map((cp) => ({
            inspeksi_hse_id: inspData.id,
            menit:           cp.menit,
            status:          cp.status,
            foto_url:        cp.foto?.url || null,
          }))
      );
      if (cpErr) throw cpErr;

      // Simpan foto temuan (kalau tidak kedap)
      if (fotoTemuan.length > 0) {
        const { error: temuanErr } = await supabase.from("foto_inspeksi_hse").insert(
          fotoTemuan.map((f) => ({
            inspeksi_hse_id: inspData.id,
            url:             f.url,
            keterangan:      f.keterangan,
          }))
        );
        if (temuanErr) throw temuanErr;
      }

      // Upsert kendaraan
      await supabase.from("kendaraan").upsert(
        {
          nomor_polisi:       kendaraan.polisi.trim().toUpperCase(),
          transportir:        kendaraan.transportir.trim(),
          kapasitas_mt:       kendaraan.kapasitas.trim(),
          jumlah_kompartemen: parseInt(kendaraan.kompartemen),
          kategori_mt:        kategoriMT,
          updated_at:         new Date().toISOString(),
        },
        { onConflict: "nomor_polisi" }
      );

      // Data sudah tersimpan di server, draft lokal tidak diperlukan lagi
      clearDraft();

      alert(statusAkhir === "kedap"
        ? "✅ Kendaraan LULUS Uji Kedap! Data berhasil di Unggah."
        : "❌ Kendaraan TIDAK LULUS Uji Kedap. Data temuan berhasil dI Unggah.");
      onNav("dashboard");
    } catch (err) {
      alert("Gagal menyimpan: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ── STEP SOP ──────────────────────────────────────────────────────────────
  if (step === "sop") {
    return (
      <div style={{ minHeight: "100vh", background: "#000", display: "flex", flexDirection: "column" }}>
        <div style={{ background: theme.surface, padding: "48px 16px 16px", borderBottom: `1px solid ${theme.border}` }}>
          <div onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10, cursor: "pointer", color: theme.textSub, fontSize: 13 }}>
            <Icon name="arrow" size={16} color={theme.textSub} /> Kembali
          </div>
          <div style={{ fontWeight: 800, fontSize: 18, color: theme.text }}>Acuan SOP Uji Kedap</div>
          <div style={{ fontSize: 13, color: theme.textMuted, marginTop: 2 }}>
            Halaman {sopPage + 1} dari {SOP_IMAGES.length} — baca sebelum melanjutkan
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
            {SOP_IMAGES.map((_, i) => (
              <div key={i} style={{
                flex: 1, height: 4, borderRadius: 4,
                background: i <= sopPage ? theme.primary : theme.border,
                transition: "background 0.2s",
              }} />
            ))}
          </div>
        </div>

        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: theme.bg, padding: 16 }}>
          <img src={SOP_IMAGES[sopPage]} alt={`SOP halaman ${sopPage + 1}`}
            style={{ width: "100%", maxWidth: 500, borderRadius: 12, boxShadow: "0 4px 20px rgba(0,0,0,0.15)", objectFit: "contain" }} />
        </div>

        <div style={{ background: theme.surface, padding: "16px", borderTop: `1px solid ${theme.border}` }}>
          <div style={{ display: "flex", gap: 10 }}>
            {sopPage > 0 && (
              <Btn onClick={() => setSopPage((p) => p - 1)} variant="ghost" style={{ flex: 1 }}>
                ← Sebelumnya
              </Btn>
            )}
            <Btn onClick={handleLanjutSOP} variant="primary" style={{ flex: 2 }}>
              {sopPage < SOP_IMAGES.length - 1 ? "Halaman Berikutnya →" : "✅ Lanjutkan Pengecekan"}
            </Btn>
            {sopPage < SOP_IMAGES.length - 1 && (
              <Btn onClick={handleSkipSOP} variant="ghost" style={{ flex: 1 }}>
                Lewati ⏭
              </Btn>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── STEP KENDARAAN ────────────────────────────────────────────────────────
  if (step === "kendaraan") {
    return (
      <div style={{ minHeight: "100vh", background: theme.bg, display: "flex", flexDirection: "column" }}>
        <div style={{ background: theme.surface, padding: "48px 16px 16px", borderBottom: `1px solid ${theme.border}`, boxShadow: theme.shadow }}>
          <div onClick={() => setStep("sop")} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14, cursor: "pointer", color: theme.textSub, fontSize: 13 }}>
            <Icon name="arrow" size={16} color={theme.textSub} /> Kembali
          </div>
          <div style={{ fontWeight: 800, fontSize: 18, color: theme.text }}>Data Kendaraan</div>
          <div style={{ fontSize: 13, color: theme.textMuted, marginTop: 2 }}>Isi sekali, otomatis tersimpan</div>
        </div>

        {restoreBanner}

        <div style={{ flex: 1, overflowY: "auto", padding: "20px 16px", paddingBottom: 100 }}>
          <div style={{ background: theme.surface, borderRadius: 14, padding: 16, border: `1px solid ${theme.border}` }}>
            <Input label="Nomor Polisi" placeholder="Contoh: B 1234 XY"
              value={kendaraan.polisi} onChange={handlePolisiChange} />
            {lookupStatus === "loading" && <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 10 }}>🔍 Mencari data kendaraan...</div>}
            {lookupStatus === "found"   && <div style={{ fontSize: 12, color: theme.success, fontWeight: 600, marginBottom: 10 }}>✅ Data ditemukan — terisi otomatis</div>}
            {lookupStatus === "new"     && <div style={{ fontSize: 12, color: "#F59E0B", fontWeight: 600, marginBottom: 10 }}>🆕 Kendaraan baru — isi manual</div>}
            {errors.polisi && <div style={{ fontSize: 12, color: theme.danger, marginBottom: 8 }}>⚠️ Nomor Polisi wajib diisi.</div>}

            <Input label="Kapasitas MT (contoh: 10 KL)" placeholder="10 KL"
              value={kendaraan.kapasitas} onChange={isAutoFilled ? undefined : setK("kapasitas")} disabled={isAutoFilled} />
            {errors.kapasitas && <div style={{ fontSize: 12, color: theme.danger, marginBottom: 8 }}>⚠️ Kapasitas MT wajib diisi.</div>}

            <Input label="Jumlah Kompartemen" placeholder="1 / 2 / 3"
              value={kendaraan.kompartemen} onChange={isAutoFilled ? undefined : setK("kompartemen")} disabled={isAutoFilled} />
            {errors.kompartemen && <div style={{ fontSize: 12, color: theme.danger, marginBottom: 8 }}>⚠️ Jumlah kompartemen wajib diisi.</div>}

            <Input label="Transportir" placeholder="PT. ..."
              value={kendaraan.transportir} onChange={isAutoFilled ? undefined : setK("transportir")} disabled={isAutoFilled} />
            {errors.transportir && <div style={{ fontSize: 12, color: theme.danger, marginBottom: 8 }}>⚠️ Transportir wajib diisi.</div>}

            {isAutoFilled && (
              <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>
                Data terisi otomatis.{" "}
                <span onClick={() => { setIsAutoFilled(false); setLookupStatus("new"); }}
                  style={{ color: theme.primary, cursor: "pointer", textDecoration: "underline" }}>
                  Edit manual
                </span>
              </div>
            )}
          </div>
        </div>

        <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, padding: "12px 16px", background: theme.surface, borderTop: `1px solid ${theme.border}` }}>
          <Btn onClick={handleLanjutKendaraan} variant="primary">Lanjut →</Btn>
        </div>
      </div>
    );
  }

  // ── STEP KATEGORI MT ──────────────────────────────────────────────────────
  if (step === "kategori") {
    return (
      <div style={{ minHeight: "100vh", background: theme.bg, display: "flex", flexDirection: "column" }}>
        <div style={{ background: theme.surface, padding: "48px 16px 16px", borderBottom: `1px solid ${theme.border}`, boxShadow: theme.shadow }}>
          <div onClick={() => setStep("kendaraan")} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14, cursor: "pointer", color: theme.textSub, fontSize: 13 }}>
            <Icon name="arrow" size={16} color={theme.textSub} /> Kembali
          </div>
          <div style={{ fontWeight: 800, fontSize: 18, color: theme.text }}>Kategori MT</div>
          <div style={{ fontSize: 13, color: theme.textMuted, marginTop: 2 }}>Pilih jenis kendaraan MT</div>
        </div>

        {restoreBanner}

        <div style={{ flex: 1, padding: "24px 16px" }}>
          {[
            { value: "merah_putih", label: "MT Merah Putih", desc: "Untuk SPBU / distribusi BBM retail", icon: "🔴" },
            { value: "industri",    label: "MT Industri",    desc: "Untuk pabrik, tambang, industri", icon: "🏭" },
          ].map((opt) => (
            <div key={opt.value} onClick={() => setKategoriMT(opt.value)} style={{
              marginBottom: 14, padding: 20, borderRadius: 14, cursor: "pointer",
              border: `2px solid ${kategoriMT === opt.value ? theme.primary : theme.border}`,
              background: kategoriMT === opt.value ? theme.primaryLight : theme.surface,
              transition: "all 0.15s",
            }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>{opt.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 16, color: theme.text }}>{opt.label}</div>
              <div style={{ fontSize: 13, color: theme.textMuted, marginTop: 4 }}>{opt.desc}</div>
              {kategoriMT === opt.value && (
                <div style={{ marginTop: 8, fontSize: 12, fontWeight: 700, color: theme.primary }}>✓ Dipilih</div>
              )}
            </div>
          ))}
        </div>

        <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, padding: "12px 16px", background: theme.surface, borderTop: `1px solid ${theme.border}` }}>
          <Btn onClick={handleLanjutKategori} variant="primary" disabled={!kategoriMT}>Lanjut →</Btn>
        </div>
      </div>
    );
  }

  // ── STEP UJI KEDAP ────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: theme.bg, display: "flex", flexDirection: "column" }}>
      <div style={{ background: theme.surface, padding: "48px 16px 16px", borderBottom: `1px solid ${theme.border}`, boxShadow: theme.shadow }}>
        <div onClick={() => setStep("kategori")} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14, cursor: "pointer", color: theme.textSub, fontSize: 13 }}>
          <Icon name="arrow" size={16} color={theme.textSub} /> Kembali
        </div>
        <div style={{ fontWeight: 800, fontSize: 18, color: theme.text }}>Uji Kedap — 6 kPa</div>
        <div style={{ fontSize: 13, color: theme.textMuted, marginTop: 2 }}>
          {kendaraan.polisi} · {kendaraan.kapasitas} · {kendaraan.kompartemen} kompartemen
        </div>
        {/* Status akhir badge */}
        {statusAkhir === "kedap" && (
          <div style={{ marginTop: 10, padding: "6px 14px", borderRadius: 20, background: "#D1FAE5", color: theme.success, fontWeight: 700, fontSize: 13, display: "inline-block" }}>
            ✅ LULUS — Semua checkpoint kedap
          </div>
        )}
        {statusAkhir === "tidak_kedap" && (
          <div style={{ marginTop: 10, padding: "6px 14px", borderRadius: 20, background: theme.dangerLight, color: theme.danger, fontWeight: 700, fontSize: 13, display: "inline-block" }}>
            ❌ TIDAK LULUS — Ditemukan kebocoran
          </div>
        )}
      </div>

      {restoreBanner}

      <div style={{ flex: 1, overflowY: "auto", padding: "20px 16px", paddingBottom: 100 }}>
        {errors.uji_incomplete && (
          <div style={{ marginBottom: 12, padding: "10px 14px", borderRadius: 10, background: theme.dangerLight, color: theme.danger, fontSize: 13, fontWeight: 600 }}>
            ⚠️ Selesaikan semua checkpoint terlebih dahulu.
          </div>
        )}

        {CHECKPOINTS.map((cpDef, idx) => {
          const cp      = checkpoints[idx];
          const prevCp  = checkpoints[idx - 1];

          // Checkpoint 0 selalu tampil
          // Checkpoint N tampil hanya kalau N-1 sudah kedap + ada foto
          const visible = idx === 0 || (prevCp?.status === "kedap" && prevCp?.foto);
          // Sembunyikan kalau ada tidak kedap sebelumnya
          const blocked = checkpoints.slice(0, idx).some((c) => c.status === "tidak_kedap");

          if (!visible || blocked) return null;

          const isTidakKedap = cp.status === "tidak_kedap";
          const isKedap      = cp.status === "kedap";

          return (
            <div key={idx} style={{
              marginBottom: 14, padding: 14, borderRadius: 12, background: theme.surface,
              border: `1.5px solid ${isKedap ? theme.success : isTidakKedap ? theme.danger : theme.border}`,
            }}>
              {/* Label + tekanan */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: theme.text }}>▶ {cpDef.label}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: theme.primary, background: theme.primaryLight, padding: "3px 10px", borderRadius: 20 }}>
                  6 kPa
                </div>
              </div>

              {/* Toggle Kedap / Tidak Kedap */}
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                {["kedap", "tidak_kedap"].map((opt) => (
                  <div key={opt} onClick={() => setCheckpointStatus(idx, opt)} style={{
                    flex: 1, textAlign: "center", padding: "9px 0", borderRadius: 8,
                    fontSize: 13, fontWeight: 600, cursor: "pointer",
                    background: cp.status === opt
                      ? (opt === "kedap" ? theme.success : theme.danger)
                      : theme.surfaceAlt,
                    color: cp.status === opt ? "#fff" : theme.textMuted,
                    border: `1.5px solid ${cp.status === opt
                      ? (opt === "kedap" ? theme.success : theme.danger)
                      : theme.border}`,
                  }}>
                    {opt === "kedap" ? "✅ Kedap" : "❌ Tidak Kedap"}
                  </div>
                ))}
              </div>

              {/* Foto wajib kalau Kedap */}
              {isKedap && (
                <CameraCaptureSingle
                  label={`Foto alat ukur ${cpDef.label}`}
                  onFoto={(foto) => setCheckpointFoto(idx, foto)}
                  foto={cp.foto}
                  errorFoto={!!errors[`cp_${idx}_foto`]}
                  onPreview={setPreviewUrl}
                />
              )}

              {/* Kalau tidak kedap: tampil info STOP */}
              {isTidakKedap && (
                <div style={{ marginTop: 8, padding: "8px 12px", borderRadius: 8, background: theme.dangerLight, fontSize: 12, color: theme.danger, fontWeight: 600 }}>
                  🛑 Uji dihentikan — lanjut ke pencatatan temuan di bawah
                </div>
              )}
            </div>
          );
        })}

        {/* Section temuan — muncul kalau ada tidak kedap */}
        {idxTidakKedap >= 0 && (
          <div style={{ marginTop: 8, padding: 16, borderRadius: 14, background: theme.surface, border: `2px solid ${theme.danger}` }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: theme.danger, marginBottom: 4 }}>❌ Inspeksi Temuan</div>
            <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 14 }}>
              Upload foto temuan dan isi keterangan untuk setiap foto (wajib).
            </div>
            {errors.temuan_foto && (
              <div style={{ fontSize: 12, color: theme.danger, fontWeight: 600, marginBottom: 10 }}>⚠️ Minimal 1 foto temuan wajib diupload.</div>
            )}
            <CameraCaptureMulti
              kategori="temuan"
              fotoList={fotoTemuan}
              onFotoList={setFotoTemuan}
              onPreview={setPreviewUrl}
            />
          </div>
        )}
      </div>

      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, padding: "12px 16px", background: theme.surface, borderTop: `1px solid ${theme.border}` }}>
        <Btn onClick={handleSubmit} variant="primary" icon="check" disabled={submitting || !statusAkhir}>
          {submitting ? "Menyimpan..." : "Simpan & Unggah"}
        </Btn>
      </div>

      <PhotoLightbox url={previewUrl} onClose={() => setPreviewUrl(null)} />
    </div>
  );
};

export default HSEFormScreen;