import { useState, useEffect, useRef, useCallback } from "react";
import Btn from "../components/Btn";
import Icon from "../components/Icon";
import Input from "../components/Input";
import SectionLabel from "../components/SectionLabel";
import ToggleStatus from "../components/ToggleStatus";
import theme from "../styles/theme";
import { supabase } from "../lib/supabase";
import { useCameraGPS } from "../hooks/useCameraGPS";
import { useBackableView, goBack } from "../hooks/useBackableView";

// ── Draft persistence (agar data tidak hilang kalau app ke-close / tombol home) ──
const DRAFT_KEY = "draft_form_teknisi";
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

const initCctv = () => ({ status: "", segel_bricket: "", segel_kabel: "", ket_bricket: "", ket_kabel: "" });
const initGps  = () => ({ status: "", segel: { status: "", ket: "" }, kabel: { status: "", ket: "" } });

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
const formatTanggal = (dateStr) => {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
};

// ── applyOverlay — sekarang resize dulu ke maks 1600px sebelum overlay,
// supaya upload lebih ringan & cepat (sama seperti pola HSEFormScreen) ───────
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
  const fileName = `${kategori}-${Date.now()}.jpg`;
  const { data, error } = await supabase.storage
    .from("foto-inspeksi").upload(fileName, blob, { contentType: "image/jpeg" });
  if (error) throw new Error("Foto gagal diupload: " + error.message);
  const { data: pub } = supabase.storage.from("foto-inspeksi").getPublicUrl(data.path);
  return { name: fileName, url: pub.publicUrl, path: data.path };
};

const InfoRow = ({ label, value, highlight }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${theme.border}` }}>
    <div style={{ fontSize: 12, color: theme.textMuted }}>{label}</div>
    <div style={{ fontSize: 13, fontWeight: 600, color: highlight ? theme.danger : theme.text, textAlign: "right", maxWidth: "60%" }}>{value || "-"}</div>
  </div>
);

const ToggleAktif = ({ value, onChange }) => (
  <div style={{ display: "flex", gap: 8, marginTop: 10, marginBottom: 4 }}>
    {["Aktif", "Tidak Aktif"].map((opt) => (
      <div key={opt} onClick={() => onChange(opt)} style={{
        flex: 1, textAlign: "center", padding: "9px 0", borderRadius: 10,
        fontSize: 13, fontWeight: 600, cursor: "pointer",
        background: value === opt ? (opt === "Aktif" ? theme.success : theme.danger) : theme.surfaceAlt,
        color: value === opt ? "#fff" : theme.textMuted,
        border: `1.5px solid ${value === opt ? (opt === "Aktif" ? theme.success : theme.danger) : theme.border}`,
        transition: "all 0.15s",
      }}>
        {opt === "Aktif" ? "✅ Aktif" : "❌ Tidak Aktif"}
      </div>
    ))}
  </div>
);

// ── PhotoLightbox — preview full-screen. Tombol back HP menutup lightbox ini
// dulu (bukan langsung keluar dari form) — sama seperti pola HSEFormScreen. ──
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

// ── CameraCapture ────────────────────────────────────────────────────────────
// requestAccess() dari useCameraGPS (di-warm-up sejak layar ini mount) supaya
// kamera & GPS sudah "hangat" — foto langsung terasa instan. Sumber daftar
// foto murni dari `allPhotos` (state induk) difilter per kategori.
const CameraCapture = ({ label, kategori, onPhotos, allPhotos, errorFoto, onPreview, requestAccess }) => {
  const photos = allPhotos.filter((p) => p.kategori === kategori);
  const [capState, setCapState] = useState("idle");
  const [permErr, setPermErr] = useState(null);
  const fileInputRef = useRef(null);
  const cachedPosRef = useRef(null);

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
      const result = await uploadFoto(file, kategori, cachedPosRef.current);
      onPhotos((p) => [...p, { ...result, kategori, timestamp: new Date() }]);
    } catch (err) {
      alert("⚠️ " + err.message);
    } finally {
      setCapState("idle");
      cachedPosRef.current = null;
      e.target.value = "";
    }
  };

  const removePhoto = async (path) => {
    await supabase.storage.from("foto-inspeksi").remove([path]).catch(() => {});
    onPhotos((p) => p.filter((x) => x.path !== path));
  };

  const isWorking = capState !== "idle";

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ border: `2px dashed ${errorFoto ? theme.danger : theme.border}`, borderRadius: 12, padding: "14px 16px", background: errorFoto ? theme.dangerLight : "transparent" }}>
        <div style={{ fontSize: 12, color: errorFoto ? theme.danger : theme.textMuted, marginBottom: 10, textAlign: "center" }}>
          {label}
          <div style={{ fontSize: 11, marginTop: 2 }}>📷 Kamera belakang · ⏱ Timestamp server · 📍 GPS</div>
        </div>
        {permErr && <div style={{ marginBottom: 10, padding: "8px 12px", borderRadius: 8, background: theme.dangerLight, color: theme.danger, fontSize: 12, fontWeight: 600 }}>⛔ {permErr}</div>}
        <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileChange} style={{ display: "none" }} />
        <Btn onClick={handleCaptureClick} variant="outline" style={{ padding: "9px", fontSize: 13, width: "100%" }} disabled={isWorking}>
          {capState === "checking" ? "🔐 Cek izin..." : capState === "processing" ? "⏳ Memproses..." : "📷 Ambil Foto"}
        </Btn>
        {photos.length > 0 && (
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
            {photos.map((p) => (
              <div key={p.path} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 8px", background: theme.primaryLight, borderRadius: 8 }}>
                <img
                  src={p.url}
                  alt={p.name}
                  onClick={() => onPreview?.(p.url)}
                  style={{ width: 44, height: 44, borderRadius: 6, objectFit: "cover", cursor: "pointer", flexShrink: 0, border: `1px solid ${theme.border}` }}
                />
                <div onClick={() => onPreview?.(p.url)} style={{ flex: 1, minWidth: 0, cursor: "pointer" }}>
                  <div style={{ fontSize: 12, color: theme.primary, fontWeight: 600 }}>✓ Tersimpan</div>
                  <div style={{ fontSize: 10.5, color: theme.textMuted }}>Ketuk untuk lihat penuh (cek blur)</div>
                </div>
                <div onClick={() => removePhoto(p.path)} style={{ cursor: "pointer", fontWeight: 700, color: theme.danger, padding: "4px 8px", flexShrink: 0 }}>✕</div>
              </div>
            ))}
          </div>
        )}
      </div>
      {errorFoto && <div style={{ marginTop: 6, fontSize: 12, color: theme.danger, fontWeight: 600 }}>⚠️ Foto dokumentasi wajib diambil.</div>}
    </div>
  );
};

const CheckItemWithFoto = ({ label, status, onStatus, ket, onKet, errorKet, kategori, onPhotos, allPhotos, errorFoto, onPreview, requestAccess }) => (
  <div style={{ marginBottom: 14, padding: 14, borderRadius: 12, background: theme.surfaceAlt, border: `1px solid ${theme.border}` }}>
    <div style={{ fontWeight: 600, fontSize: 14, color: theme.text, marginBottom: 6 }}>{label}</div>
    <ToggleStatus value={status} onChange={onStatus} />
    {status === "Abnormal" && (
      <>
        <textarea placeholder="Tuliskan keterangan temuan..." value={ket} onChange={(e) => onKet(e.target.value)} style={{ marginTop: 10, width: "100%", padding: "10px 12px", borderRadius: 10, border: `1.5px solid ${errorKet ? theme.danger : theme.border}`, background: errorKet ? theme.dangerLight : theme.surface, color: theme.text, fontSize: 13, fontFamily: "'DM Sans', sans-serif", resize: "none", minHeight: 70, boxSizing: "border-box", outline: "none" }} />
        {errorKet && <div style={{ marginTop: 5, fontSize: 12, color: theme.danger, fontWeight: 600 }}>⚠️ Keterangan wajib diisi saat kondisi Abnormal.</div>}
      </>
    )}
    <div style={{ marginTop: 10 }}>
      <CameraCapture label="Foto dokumentasi" kategori={kategori} onPhotos={onPhotos} allPhotos={allPhotos} errorFoto={errorFoto} onPreview={onPreview} requestAccess={requestAccess} />
    </div>
  </div>
);

const StatusAktifWithFoto = ({ label, status, onStatus, kategori, onPhotos, allPhotos, errorFoto, onPreview, requestAccess }) => (
  <div style={{ marginBottom: 14, padding: 14, borderRadius: 12, background: theme.surfaceAlt, border: `1px solid ${theme.border}` }}>
    <div style={{ fontWeight: 600, fontSize: 14, color: theme.text, marginBottom: 2 }}>{label}</div>
    <ToggleAktif value={status} onChange={onStatus} />
    <div style={{ marginTop: 10 }}>
      <CameraCapture label="Foto dokumentasi" kategori={kategori} onPhotos={onPhotos} allPhotos={allPhotos} errorFoto={errorFoto} onPreview={onPreview} requestAccess={requestAccess} />
    </div>
  </div>
);

const FormScreen = ({ onBack, onNav }) => {
  const [step, setStep] = useState(1);
  const [currentUser, setCurrentUser] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [lookupStatus, setLookupStatus] = useState("idle");
  const [kendaraanData, setKendaraanData] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const lookupTimer = useRef(null);
  const submittedRef = useRef(false);

  // Kamera/GPS di-"hangat"-kan sejak layar ini dibuka — sama seperti HSEFormScreen
  const { warmUp, coolDown, requestAccess } = useCameraGPS();
  useEffect(() => {
    warmUp();
    return () => coolDown();
  }, [warmUp, coolDown]);

  const [polisi, setPolisi] = useState("");
  const [pemeriksa, setPemeriksa] = useState("");
  const [gps, setGps] = useState(initGps());
  const [cctv, setCctv] = useState({ dashcam: initCctv(), kanan: initCctv(), kiri: initCctv() });
  const [segelKotakSekring, setSegelKotakSekring] = useState("");
  const [errors, setErrors] = useState({});

  const [ready, setReady] = useState(false);
  const [showRestoreBanner, setShowRestoreBanner] = useState(false);
  const [draftExpiredNotice, setDraftExpiredNotice] = useState(false);
  const draftCreatedAtRef = useRef(null);

  const photosRef = useRef(photos);
  useEffect(() => { photosRef.current = photos; }, [photos]);

  useEffect(() => {
    if (step === 1) window.history.replaceState({ screen: "form", step: 1 }, "");
    else window.history.pushState({ screen: "form", step }, "");
  }, [step]);

  useEffect(() => {
    const handlePopState = (e) => {
      const state = e.state;
      if (state?.screen === "form" && state?.step && state.step < step) setStep(state.step);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [step]);

  // Cleanup: layar ditinggalkan tanpa submit → foto yang sudah keburu
  // diupload dihapus lagi dari storage. Draft TIDAK dihapus di sini (sama
  // seperti HSEFormScreen) — biar tetap bisa dipulihkan kalau user balik lagi.
  useEffect(() => {
    return () => {
      if (!submittedRef.current && photosRef.current.length > 0) {
        const paths = photosRef.current.map((p) => p.path).filter(Boolean);
        if (paths.length) supabase.storage.from("foto-inspeksi").remove(paths).catch(console.error);
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      setCurrentUser(user.id);
      supabase.from("profiles").select("nama").eq("id", user.id).single()
        .then(({ data: profile }) => { if (profile?.nama) setPemeriksa(profile.nama); });
    });
  }, []);

  // ── Restore draft di awal (sekali) ─────────────────────────────────────
  useEffect(() => {
    const draft = loadDraft();
    if (draft) {
      const age = Date.now() - (draft.createdAt || 0);
      if (draft.createdAt && age > DRAFT_EXPIRE_MS) {
        clearDraft();
        setDraftExpiredNotice(true);
      } else {
        setStep(draft.step || 1);
        setPolisi(draft.polisi || "");
        setKendaraanData(draft.kendaraanData || null);
        setLookupStatus(draft.kendaraanData ? "found" : "idle");
        setGps(draft.gps || initGps());
        setCctv(draft.cctv || { dashcam: initCctv(), kanan: initCctv(), kiri: initCctv() });
        setSegelKotakSekring(draft.segelKotakSekring || "");
        setPhotos(draft.photos || []);
        draftCreatedAtRef.current = draft.createdAt || Date.now();
        setShowRestoreBanner(true);
      }
    }
    setReady(true);
  }, []);

  // ── Simpan draft — hanya kalau ada progress beneran, dan expire timestamp
  // hanya di-set sekali di awal progress (sama seperti HSEFormScreen) ──────
  useEffect(() => {
    if (!ready) return;
    const hasProgress = step > 1 || polisi.trim() || photos.length > 0;
    if (!hasProgress) { clearDraft(); draftCreatedAtRef.current = null; return; }
    if (!draftCreatedAtRef.current) draftCreatedAtRef.current = Date.now();
    saveDraft({ createdAt: draftCreatedAtRef.current, step, polisi, kendaraanData, gps, cctv, segelKotakSekring, photos });
  }, [ready, step, polisi, kendaraanData, gps, cctv, segelKotakSekring, photos]);

  const resetSemua = () => {
    clearDraft();
    draftCreatedAtRef.current = null;
    setStep(1);
    setPolisi("");
    setKendaraanData(null);
    setLookupStatus("idle");
    setGps(initGps());
    setCctv({ dashcam: initCctv(), kanan: initCctv(), kiri: initCctv() });
    setSegelKotakSekring("");
    setPhotos([]);
    setShowRestoreBanner(false);
  };

  const restoreBanner = showRestoreBanner && (
    <div style={{
      margin: "0 0 16px", padding: "10px 14px", borderRadius: 10,
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

  const expiredNotice = draftExpiredNotice && (
    <div style={{
      margin: "0 0 16px", padding: "10px 14px", borderRadius: 10,
      background: theme.surfaceAlt, color: theme.textMuted, fontSize: 12, fontWeight: 600,
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
    }}>
      <span>🗑️ Draft pengisian sebelumnya (lebih dari 6 jam) sudah dihapus otomatis.</span>
      <span onClick={() => setDraftExpiredNotice(false)} style={{ cursor: "pointer" }}>✕</span>
    </div>
  );

  const handlePolisiChange = useCallback((val) => {
    setPolisi(val.toUpperCase());
    setKendaraanData(null);
    setLookupStatus("idle");
    if (lookupTimer.current) clearTimeout(lookupTimer.current);
    if (!val.trim()) return;
    lookupTimer.current = setTimeout(async () => {
      setLookupStatus("loading");
      try {
        const { data } = await supabase
          .from("kendaraan")
          .select("nomor_polisi, transportir, kapasitas_mt, jumlah_kompartemen, kategori_mt, masa_berlaku_head_truck, masa_berlaku_tangki")
          .eq("nomor_polisi", val.trim().toUpperCase())
          .maybeSingle();
        if (data) { setKendaraanData(data); setLookupStatus("found"); }
        else setLookupStatus("notfound");
      } catch { setLookupStatus("notfound"); }
    }, 600);
  }, []);

  const cekMasaBerlaku = (dateStr) => {
    if (!dateStr) return null;
    const hari = Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24));
    if (hari < 0) return "expired";
    if (hari <= 30) return "warning";
    return "ok";
  };
  const statusHeadTruck = cekMasaBerlaku(kendaraanData?.masa_berlaku_head_truck);
  const statusTangki    = cekMasaBerlaku(kendaraanData?.masa_berlaku_tangki);

  const setGpsField = (field, key) => (val) => setGps((p) => ({ ...p, [field]: { ...p[field], [key]: val } }));
  const setCctvField = (cam, field) => (val) => setCctv((p) => ({ ...p, [cam]: { ...p[cam], [field]: val } }));
  const hasPhoto = (kat) => photos.some((p) => p.kategori === kat);

  const validateStep2 = () => {
    const e = {};
    if (!gps.status) e.gps_status = true;
    if (!hasPhoto("gps_status")) e.gps_status_foto = true;
    if (!gps.segel.status) e.gps_segel = true;
    if (gps.segel.status === "Abnormal" && !gps.segel.ket.trim()) e.gps_segel_ket = true;
    if (!hasPhoto("gps_segel")) e.gps_segel_foto = true;
    if (!gps.kabel.status) e.gps_kabel = true;
    if (gps.kabel.status === "Abnormal" && !gps.kabel.ket.trim()) e.gps_kabel_ket = true;
    if (!hasPhoto("gps_kabel")) e.gps_kabel_foto = true;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateStep3 = () => {
    const e = {};
    ["dashcam", "kanan", "kiri"].forEach((cam) => {
      if (!cctv[cam].status) e[`${cam}_status`] = true;
      if (!hasPhoto(`cctv_${cam}_status`)) e[`${cam}_status_foto`] = true;
      if (!cctv[cam].segel_bricket) e[`${cam}_bricket`] = true;
      if (cctv[cam].segel_bricket === "Abnormal" && !cctv[cam].ket_bricket.trim()) e[`${cam}_bricket_ket`] = true;
      if (!hasPhoto(`cctv_${cam}_bricket`)) e[`${cam}_bricket_foto`] = true;
      if (!cctv[cam].segel_kabel) e[`${cam}_kabel`] = true;
      if (cctv[cam].segel_kabel === "Abnormal" && !cctv[cam].ket_kabel.trim()) e[`${cam}_kabel_ket`] = true;
      if (!hasPhoto(`cctv_${cam}_kabel`)) e[`${cam}_kabel_foto`] = true;
    });
    if (!segelKotakSekring) e.segel_kotak = true;
    if (!hasPhoto("segel_kotak_sekring")) e.segel_kotak_foto = true;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNextStep1 = () => {
    if (!polisi.trim()) { alert("Nomor Polisi wajib diisi!"); return; }
    if (lookupStatus === "loading") { alert("Sedang mencari data kendaraan, tunggu sebentar..."); return; }
    if (lookupStatus === "notfound" || !kendaraanData) { alert("Nomor Polisi tidak ditemukan di database. Hubungi admin Depot untuk mendaftarkan kendaraan ini."); return; }
    setStep(2);
  };

  const handleSubmit = async () => {
    if (!validateStep3()) { alert("Lengkapi semua data CCTV dan foto dokumentasi!"); return; }
    setSubmitting(true);
    try {
      const { data: inspData, error: inspErr } = await supabase.from("inspeksi").insert([{
        user_id: currentUser,
        nomor_polisi: polisi.trim().toUpperCase(),
        nama_pemeriksa: pemeriksa,
        perusahaan_transportir: kendaraanData?.transportir || "",
        status_gps: gps.status,
        segel_gps: gps.segel.status, segel_gps_ket: gps.segel.ket,
        kabel_gps: gps.kabel.status, kabel_gps_ket: gps.kabel.ket,
        status_cctv_dashcam: cctv.dashcam.status,
        segel_bricket_dashcam: cctv.dashcam.segel_bricket, segel_bricket_dashcam_ket: cctv.dashcam.ket_bricket,
        segel_kabel_dashcam: cctv.dashcam.segel_kabel, segel_kabel_dashcam_ket: cctv.dashcam.ket_kabel,
        status_cctv_kanan: cctv.kanan.status,
        segel_bricket_kanan: cctv.kanan.segel_bricket, segel_bricket_kanan_ket: cctv.kanan.ket_bricket,
        segel_kabel_kanan: cctv.kanan.segel_kabel, segel_kabel_kanan_ket: cctv.kanan.ket_kabel,
        status_cctv_kiri: cctv.kiri.status,
        segel_bricket_kiri: cctv.kiri.segel_bricket, segel_bricket_kiri_ket: cctv.kiri.ket_bricket,
        segel_kabel_kiri: cctv.kiri.segel_kabel, segel_kabel_kiri_ket: cctv.kiri.ket_kabel,
        segel_kotak_sekring: segelKotakSekring,
        is_submitted: true, submitted_at: new Date().toISOString(), status: "baru",
      }]).select().single();
      if (inspErr) throw inspErr;
      submittedRef.current = true;
      if (photos.length > 0) {
        const { error: fotoErr } = await supabase.from("foto_inspeksi").insert(
          photos.map((p) => ({ inspeksi_id: inspData.id, url: p.url, kategori: p.kategori, timestamp_foto: p.timestamp }))
        );
        if (fotoErr) { alert("Laporan tersimpan, tapi foto gagal: " + fotoErr.message); clearDraft(); onNav("dashboard"); return; }
      }
      clearDraft();
      alert("✅ Data berhasil disimpan & dikirim ke Depot!");
      onNav("dashboard");
    } catch (err) {
      const paths = photos.map((p) => p.path).filter(Boolean);
      if (paths.length) await supabase.storage.from("foto-inspeksi").remove(paths).catch(console.error);
      alert("Gagal menyimpan: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const steps = ["Kendaraan", "GPS", "CCTV"];

  return (
    <div style={{ minHeight: "100vh", background: theme.bg, display: "flex", flexDirection: "column" }}>
      <div style={{ background: theme.surface, padding: "48px 16px 16px", borderBottom: `1px solid ${theme.border}`, boxShadow: theme.shadow }}>
        <div onClick={() => { if (step > 1) window.history.back(); else onBack(); }} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14, cursor: "pointer", color: theme.textSub, fontSize: 13 }}>
          <Icon name="arrow" size={16} color={theme.textSub} /> Kembali
        </div>
        <div style={{ fontWeight: 800, fontSize: 18, color: theme.text, marginBottom: 16 }}>Form Pengecekan</div>
        <div style={{ display: "flex", alignItems: "center" }}>
          {steps.map((s, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", flex: i < steps.length - 1 ? 1 : 0 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: step > i+1 ? theme.success : step === i+1 ? theme.primary : theme.surfaceAlt, fontSize: 12, fontWeight: 700, color: step >= i+1 ? "#fff" : theme.textMuted }}>
                  {step > i+1 ? <Icon name="check" size={13} color="#fff" /> : i+1}
                </div>
                <div style={{ fontSize: 10, marginTop: 4, color: step === i+1 ? theme.primary : theme.textMuted, fontWeight: step === i+1 ? 700 : 400 }}>{s}</div>
              </div>
              {i < steps.length - 1 && <div style={{ flex: 1, height: 2, background: step > i+1 ? theme.success : theme.border, margin: "0 6px", marginBottom: 14 }} />}
            </div>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "20px 16px", paddingBottom: 100 }}>
        {restoreBanner}
        {expiredNotice}

        {step === 1 && (
          <>
            <SectionLabel>Data Kendaraan</SectionLabel>
            <div style={{ background: theme.surface, borderRadius: 14, padding: 16, border: `1px solid ${theme.border}` }}>
              <Input label="Nomor Polisi" placeholder="Contoh: B 1234 XY" value={polisi} onChange={handlePolisiChange} />
              {lookupStatus === "loading" && <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 12 }}>🔍 Mencari data kendaraan...</div>}
              {lookupStatus === "notfound" && (
                <div style={{ fontSize: 12, color: theme.danger, fontWeight: 600, marginBottom: 12, padding: "8px 12px", background: theme.dangerLight, borderRadius: 8 }}>
                  ⚠️ Nomor Polisi tidak ditemukan. Hubungi admin Depot untuk mendaftarkan kendaraan ini.
                </div>
              )}
              {lookupStatus === "found" && kendaraanData && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: theme.success, fontWeight: 700, marginBottom: 10 }}>✅ Data kendaraan ditemukan</div>
                  <InfoRow label="Transportir" value={kendaraanData.transportir} />
                  <InfoRow label="Kapasitas MT" value={kendaraanData.kapasitas_mt} />
                  <InfoRow label="Jumlah Kompartemen" value={kendaraanData.jumlah_kompartemen ? `${kendaraanData.jumlah_kompartemen} kompartemen` : null} />
                  <InfoRow label="Kategori MT" value={kendaraanData.kategori_mt === "merah_putih" ? "MT Merah Putih" : kendaraanData.kategori_mt === "industri" ? "MT Industri" : kendaraanData.kategori_mt} />
                  <InfoRow
                    label="Masa Berlaku Head Truck"
                    value={statusHeadTruck === "expired" ? `❌ KADALUARSA — ${formatTanggal(kendaraanData.masa_berlaku_head_truck)}` : statusHeadTruck === "warning" ? `⚠️ Segera habis — ${formatTanggal(kendaraanData.masa_berlaku_head_truck)}` : formatTanggal(kendaraanData.masa_berlaku_head_truck)}
                    highlight={statusHeadTruck === "expired" || statusHeadTruck === "warning"}
                  />
                  <InfoRow
                    label="Masa Berlaku Tangki"
                    value={statusTangki === "expired" ? `❌ KADALUARSA — ${formatTanggal(kendaraanData.masa_berlaku_tangki)}` : statusTangki === "warning" ? `⚠️ Segera habis — ${formatTanggal(kendaraanData.masa_berlaku_tangki)}` : formatTanggal(kendaraanData.masa_berlaku_tangki)}
                    highlight={statusTangki === "expired" || statusTangki === "warning"}
                  />
                </div>
              )}
              <div style={{ padding: "10px 12px", borderRadius: 10, background: theme.surfaceAlt, border: `1px solid ${theme.border}`, marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 2 }}>Nama Pemeriksa</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>{pemeriksa || "Memuat..."}</div>
                <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 2 }}>Otomatis dari akun login</div>
              </div>
              <div style={{ fontSize: 12, color: theme.textMuted }}>
                📅 {new Date().toLocaleDateString("id-ID")} · 🕐 {new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <SectionLabel>Kondisi GPS</SectionLabel>
            <StatusAktifWithFoto label="Status GPS" status={gps.status} onStatus={(v) => setGps((p) => ({ ...p, status: v }))} kategori="gps_status" onPhotos={setPhotos} allPhotos={photos} errorFoto={errors.gps_status_foto} onPreview={setPreviewUrl} requestAccess={requestAccess} />
            {errors.gps_status && <div style={{ fontSize: 12, color: theme.danger, fontWeight: 600, marginTop: -8, marginBottom: 10 }}>⚠️ Status GPS wajib dipilih.</div>}
            <CheckItemWithFoto label="Segel GPS" status={gps.segel.status} onStatus={setGpsField("segel", "status")} ket={gps.segel.ket} onKet={setGpsField("segel", "ket")} errorKet={errors.gps_segel_ket} kategori="gps_segel" onPhotos={setPhotos} allPhotos={photos} errorFoto={errors.gps_segel_foto} onPreview={setPreviewUrl} requestAccess={requestAccess} />
            <CheckItemWithFoto label="Kabel GPS" status={gps.kabel.status} onStatus={setGpsField("kabel", "status")} ket={gps.kabel.ket} onKet={setGpsField("kabel", "ket")} errorKet={errors.gps_kabel_ket} kategori="gps_kabel" onPhotos={setPhotos} allPhotos={photos} errorFoto={errors.gps_kabel_foto} onPreview={setPreviewUrl} requestAccess={requestAccess} />
          </>
        )}

        {step === 3 && (
          <>
            <SectionLabel>CCTV Dashcam</SectionLabel>
            <StatusAktifWithFoto label="Status CCTV Dashcam" status={cctv.dashcam.status} onStatus={setCctvField("dashcam", "status")} kategori="cctv_dashcam_status" onPhotos={setPhotos} allPhotos={photos} errorFoto={errors.dashcam_status_foto} onPreview={setPreviewUrl} requestAccess={requestAccess} />
            <CheckItemWithFoto label="Segel Bricket" status={cctv.dashcam.segel_bricket} onStatus={setCctvField("dashcam", "segel_bricket")} ket={cctv.dashcam.ket_bricket} onKet={setCctvField("dashcam", "ket_bricket")} errorKet={errors.dashcam_bricket_ket} kategori="cctv_dashcam_bricket" onPhotos={setPhotos} allPhotos={photos} errorFoto={errors.dashcam_bricket_foto} onPreview={setPreviewUrl} requestAccess={requestAccess} />
            <CheckItemWithFoto label="Segel Sambungan Kabel" status={cctv.dashcam.segel_kabel} onStatus={setCctvField("dashcam", "segel_kabel")} ket={cctv.dashcam.ket_kabel} onKet={setCctvField("dashcam", "ket_kabel")} errorKet={errors.dashcam_kabel_ket} kategori="cctv_dashcam_kabel" onPhotos={setPhotos} allPhotos={photos} errorFoto={errors.dashcam_kabel_foto} onPreview={setPreviewUrl} requestAccess={requestAccess} />
            <SectionLabel style={{ marginTop: 8 }}>CCTV Kanan</SectionLabel>
            <StatusAktifWithFoto label="Status CCTV Kanan" status={cctv.kanan.status} onStatus={setCctvField("kanan", "status")} kategori="cctv_kanan_status" onPhotos={setPhotos} allPhotos={photos} errorFoto={errors.kanan_status_foto} onPreview={setPreviewUrl} requestAccess={requestAccess} />
            <CheckItemWithFoto label="Segel Bricket" status={cctv.kanan.segel_bricket} onStatus={setCctvField("kanan", "segel_bricket")} ket={cctv.kanan.ket_bricket} onKet={setCctvField("kanan", "ket_bricket")} errorKet={errors.kanan_bricket_ket} kategori="cctv_kanan_bricket" onPhotos={setPhotos} allPhotos={photos} errorFoto={errors.kanan_bricket_foto} onPreview={setPreviewUrl} requestAccess={requestAccess} />
            <CheckItemWithFoto label="Segel Sambungan Kabel" status={cctv.kanan.segel_kabel} onStatus={setCctvField("kanan", "segel_kabel")} ket={cctv.kanan.ket_kabel} onKet={setCctvField("kanan", "ket_kabel")} errorKet={errors.kanan_kabel_ket} kategori="cctv_kanan_kabel" onPhotos={setPhotos} allPhotos={photos} errorFoto={errors.kanan_kabel_foto} onPreview={setPreviewUrl} requestAccess={requestAccess} />
            <SectionLabel style={{ marginTop: 8 }}>CCTV Kiri</SectionLabel>
            <StatusAktifWithFoto label="Status CCTV Kiri" status={cctv.kiri.status} onStatus={setCctvField("kiri", "status")} kategori="cctv_kiri_status" onPhotos={setPhotos} allPhotos={photos} errorFoto={errors.kiri_status_foto} onPreview={setPreviewUrl} requestAccess={requestAccess} />
            <CheckItemWithFoto label="Segel Bricket" status={cctv.kiri.segel_bricket} onStatus={setCctvField("kiri", "segel_bricket")} ket={cctv.kiri.ket_bricket} onKet={setCctvField("kiri", "ket_bricket")} errorKet={errors.kiri_bricket_ket} kategori="cctv_kiri_bricket" onPhotos={setPhotos} allPhotos={photos} errorFoto={errors.kiri_bricket_foto} onPreview={setPreviewUrl} requestAccess={requestAccess} />
            <CheckItemWithFoto label="Segel Sambungan Kabel" status={cctv.kiri.segel_kabel} onStatus={setCctvField("kiri", "segel_kabel")} ket={cctv.kiri.ket_kabel} onKet={setCctvField("kiri", "ket_kabel")} errorKet={errors.kiri_kabel_ket} kategori="cctv_kiri_kabel" onPhotos={setPhotos} allPhotos={photos} errorFoto={errors.kiri_kabel_foto} onPreview={setPreviewUrl} requestAccess={requestAccess} />
            <SectionLabel style={{ marginTop: 8 }}>Segel Kotak Sekring</SectionLabel>
            <StatusAktifWithFoto label="Status Segel Kotak Sekring" status={segelKotakSekring} onStatus={setSegelKotakSekring} kategori="segel_kotak_sekring" onPhotos={setPhotos} allPhotos={photos} errorFoto={errors.segel_kotak_foto} onPreview={setPreviewUrl} requestAccess={requestAccess} />
            {errors.segel_kotak && <div style={{ fontSize: 12, color: theme.danger, fontWeight: 600, marginTop: -8, marginBottom: 10 }}>⚠️ Status Segel Kotak Sekring wajib dipilih.</div>}
          </>
        )}
      </div>

      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, padding: "12px 16px", background: theme.surface, borderTop: `1px solid ${theme.border}`, display: "flex", gap: 10 }}>
        {step > 1 && <Btn onClick={() => window.history.back()} variant="ghost" style={{ flex: 0.5, padding: "12px", fontSize: 13 }} disabled={submitting}>← Kembali</Btn>}
        {step === 1 && <Btn onClick={handleNextStep1} variant="primary" disabled={submitting || lookupStatus === "loading"}>Lanjut →</Btn>}
        {step === 2 && <Btn onClick={() => { if (!validateStep2()) { alert("Lengkapi semua data GPS dan foto dokumentasi!"); return; } setStep(3); }} variant="primary" disabled={submitting}>Lanjut →</Btn>}
        {step === 3 && <Btn onClick={handleSubmit} variant="primary" icon="check" disabled={submitting}>{submitting ? "Menyimpan..." : "Simpan & Kirim ke Depot"}</Btn>}
      </div>

      <PhotoLightbox url={previewUrl} onClose={() => setPreviewUrl(null)} />
    </div>
  );
};

export default FormScreen;