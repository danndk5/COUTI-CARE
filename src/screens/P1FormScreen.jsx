import { useState, useEffect, useRef, useCallback } from "react";
import Btn from "../components/Btn";
import Icon from "../components/Icon";
import Input from "../components/Input";
import SectionLabel from "../components/SectionLabel";
import theme from "../styles/theme";
import { supabase } from "../lib/supabase";
import { useCameraGPS } from "../hooks/useCameraGPS";
import { useBackableView, goBack } from "../hooks/useBackableView";

// ── Draft persistence (agar data tidak hilang kalau app ke-close / ke tombol home) ──
const DRAFT_KEY = "p1_form_draft_v1";
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

const emptyTemuan = () => ({ judul: "", keterangan: "", foto: null, errorJudul: false, errorKet: false, errorFoto: false });

// ── Overlay & upload helper (sama polanya dengan HSEFormScreen) ──────────────
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
  try {
    return new Date(dateStr).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  } catch { return dateStr; }
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
  const fileName = `p1-${kategori}-${Date.now()}.jpg`;
  const { data, error } = await supabase.storage
    .from("foto-inspeksi").upload(fileName, blob, { contentType: "image/jpeg" });
  if (error) throw new Error("Foto gagal diupload: " + error.message);
  const { data: pub } = supabase.storage.from("foto-inspeksi").getPublicUrl(data.path);
  return { name: fileName, url: pub.publicUrl, path: data.path };
};

// ── PhotoLightbox — preview foto full-screen sebelum dikirim ──────────────────
// Tombol back HP menutup lightbox ini (bukan langsung keluar ke Beranda) —
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

// ── InfoRow — tampilan data kendaraan readonly ───────────────────────────────
const InfoRow = ({ label, value, highlight }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${theme.border}` }}>
    <div style={{ fontSize: 12, color: theme.textMuted }}>{label}</div>
    <div style={{ fontSize: 13, fontWeight: 600, color: highlight ? theme.danger : theme.text, textAlign: "right", maxWidth: "60%" }}>{value || "-"}</div>
  </div>
);

// ── CameraCaptureSingle — 1 foto wajib, kamera & GPS sudah "hangat" ──────────
// requestAccess() dari useCameraGPS (di-warm-up sejak layar ini mount) —
// kalau kamera & GPS sudah siap, ini langsung buka file input tanpa nunggu.
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
                ✓ Foto dokumentasi tersimpan
              </div>
              <div onClick={() => onPreview?.(foto.url)} style={{ cursor: "pointer", fontSize: 12, color: theme.primary, fontWeight: 700, flexShrink: 0 }}>
                🔍 Lihat
              </div>
              <div onClick={removeFoto} style={{ cursor: "pointer", fontWeight: 700, color: theme.danger, flexShrink: 0 }}>✕</div>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 8 }}>📷 Kamera belakang · ⏱ Timestamp · 📍 GPS</div>
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

// ── Satu item temuan ──────────────────────────────────────────────────────────
const TemuanItem = ({ idx, item, onChange, onRemove, showRemove, onPreview, requestAccess }) => {
  const set = (k) => (v) => onChange(idx, k, v);
  const handleFile = (fd) => onChange(idx, "foto", fd);

  return (
    <div style={{ background: theme.surface, border: `1.5px solid ${theme.border}`, borderRadius: 14, padding: 16, marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: "#EDE9FE", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "#7C3AED" }}>
            {idx + 1}
          </div>
          <div style={{ fontWeight: 700, fontSize: 14, color: theme.text }}>Temuan</div>
        </div>
        {showRemove && (
          <div onClick={() => onRemove(idx)} style={{ fontSize: 12, color: theme.danger, fontWeight: 600, cursor: "pointer", padding: "4px 10px", borderRadius: 8, background: theme.dangerLight }}>
            Hapus
          </div>
        )}
      </div>

      <Input
        label="Judul / Objek yang Diperiksa"
        placeholder="Contoh: Ban, Lampu, Kopling, Angin..."
        value={item.judul}
        onChange={set("judul")}
      />
      {item.errorJudul && <div style={{ fontSize: 11, color: theme.danger, fontWeight: 600, marginTop: -8, marginBottom: 10 }}>⚠️ Judul wajib diisi.</div>}

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: theme.textSub, marginBottom: 6 }}>Keterangan Temuan</div>
        <textarea
          placeholder="Tuliskan detail temuan yang ditemukan..."
          value={item.keterangan}
          onChange={(e) => set("keterangan")(e.target.value)}
          style={{
            width: "100%", padding: "10px 12px", borderRadius: 10,
            border: `1.5px solid ${item.errorKet ? theme.danger : theme.border}`,
            background: item.errorKet ? theme.dangerLight : theme.surfaceAlt,
            color: theme.text, fontSize: 13, fontFamily: "'DM Sans',sans-serif",
            resize: "none", minHeight: 80, boxSizing: "border-box", outline: "none",
          }}
        />
        {item.errorKet && <div style={{ fontSize: 11, color: theme.danger, fontWeight: 600, marginTop: 4 }}>⚠️ Keterangan wajib diisi.</div>}
      </div>

      <div style={{ fontSize: 13, fontWeight: 600, color: theme.textSub, marginBottom: 6 }}>Foto Dokumentasi (wajib)</div>
      <CameraCaptureSingle
        label={`Foto Temuan ${idx + 1}`}
        onFoto={handleFile}
        foto={item.foto}
        errorFoto={item.errorFoto || false}
        onPreview={onPreview}
        requestAccess={requestAccess}
      />
    </div>
  );
};

// ── P1FormScreen ──────────────────────────────────────────────────────────────
const P1FormScreen = ({ onBack, onNav }) => {
  const [step,        setStep]        = useState(1); // 1=Kendaraan, 2=Temuan
  const [currentUser, setCurrentUser] = useState(null);
  const [submitting,  setSubmitting]  = useState(false);

  // GPS/kamera di-"hangat"-kan sejak layar formulir ini dibuka — supaya saat
  // user sampai di step foto, izin & posisi GPS sudah siap dan foto langsung
  // terasa instan, bukan menunggu fix GPS baru tiap kali (sama seperti HSEFormScreen).
  const { warmUp, coolDown, requestAccess } = useCameraGPS();
  useEffect(() => {
    warmUp();
    return () => coolDown();
  }, [warmUp, coolDown]);

  const [previewUrl, setPreviewUrl] = useState(null);

  // Data kendaraan — SEMUA dari database, tidak ada input manual lagi
  const [nopol,         setNopol]         = useState("");
  const [kendaraanData, setKendaraanData] = useState(null); // hasil lookup lengkap
  const [lookupStatus,  setLookupStatus]  = useState("idle"); // idle|loading|found|notfound
  const lookupTimer = useRef(null);

  // Temuan (dinamis)
  const [temuan, setTemuan] = useState([emptyTemuan()]);

  // ── Cleanup foto "orphan" — kalau layar ini di-unmount (user keluar form)
  // tanpa submit, foto yang sudah terlanjur ke-upload dihapus lagi dari storage
  // supaya tidak nyangkut nyampah. Draft di localStorage tetap tersimpan terpisah;
  // kalau user sempat submit, submittedRef mencegah cleanup ini berjalan.
  const allFotoPaths = useRef([]);
  const submittedRef = useRef(false);

  useEffect(() => {
    allFotoPaths.current = temuan.map((t) => t.foto?.path).filter(Boolean);
  }, [temuan]);

  useEffect(() => {
    return () => {
      if (!submittedRef.current && allFotoPaths.current.length > 0) {
        supabase.storage.from("foto-inspeksi").remove(allFotoPaths.current).catch(console.error);
      }
    };
  }, []);

  // ── Draft persistence ───────────────────────────────────────────────────
  const [ready, setReady] = useState(false);
  const [showRestoreBanner, setShowRestoreBanner] = useState(false);
  const [draftExpiredNotice, setDraftExpiredNotice] = useState(false);
  const draftCreatedAtRef = useRef(null);

  useEffect(() => {
    const draft = loadDraft();
    if (draft) {
      const age = Date.now() - (draft.createdAt || 0);
      if (draft.createdAt && age > DRAFT_EXPIRE_MS) {
        clearDraft();
        setDraftExpiredNotice(true);
      } else {
        setStep(draft.step || 1);
        setNopol(draft.nopol || "");
        setKendaraanData(draft.kendaraanData || null);
        setLookupStatus(draft.lookupStatus || "idle");
        setTemuan(draft.temuan && draft.temuan.length ? draft.temuan : [emptyTemuan()]);
        draftCreatedAtRef.current = draft.createdAt || Date.now();
        setShowRestoreBanner(true);
      }
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const hasProgress =
      step > 1 || nopol.trim() || temuan.some((t) => t.judul.trim() || t.keterangan.trim() || t.foto);
    if (!hasProgress) { clearDraft(); draftCreatedAtRef.current = null; return; }
    if (!draftCreatedAtRef.current) draftCreatedAtRef.current = Date.now();
    saveDraft({ createdAt: draftCreatedAtRef.current, step, nopol, kendaraanData, lookupStatus, temuan });
  }, [ready, step, nopol, kendaraanData, lookupStatus, temuan]);

  const resetSemua = () => {
    clearDraft();
    draftCreatedAtRef.current = null;
    setStep(1);
    setNopol("");
    setKendaraanData(null);
    setLookupStatus("idle");
    setTemuan([emptyTemuan()]);
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

  const expiredNotice = draftExpiredNotice && (
    <div style={{
      margin: "0 16px 12px", padding: "10px 14px", borderRadius: 10,
      background: theme.surfaceAlt, color: theme.textMuted, fontSize: 12, fontWeight: 600,
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
    }}>
      <span>🗑️ Draft pengisian sebelumnya (lebih dari 6 jam) sudah dihapus otomatis.</span>
      <span onClick={() => setDraftExpiredNotice(false)} style={{ cursor: "pointer" }}>✕</span>
    </div>
  );

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => { if (user) setCurrentUser(user.id); });
  }, []);

  // Auto-fill dari nomor polisi — lookup lengkap termasuk kategori_mt
  const handleNopolChange = useCallback((val) => {
    setNopol(val.toUpperCase());
    setKendaraanData(null);
    setLookupStatus("idle");
    if (lookupTimer.current) clearTimeout(lookupTimer.current);
    if (!val.trim()) return;
    lookupTimer.current = setTimeout(async () => {
      setLookupStatus("loading");
      try {
        const { data } = await supabase.from("kendaraan")
          .select("nomor_polisi, transportir, kapasitas_mt, jumlah_kompartemen, kategori_mt, masa_berlaku_head_truck, masa_berlaku_tangki")
          .eq("nomor_polisi", val.trim().toUpperCase()).maybeSingle();
        if (data) {
          setKendaraanData(data);
          setLookupStatus("found");
        } else {
          setLookupStatus("notfound");
        }
      } catch { setLookupStatus("notfound"); }
    }, 600);
  }, []);

  // Temuan handlers
  const updateTemuan = (idx, key, val) =>
    setTemuan(prev => prev.map((t, i) => i === idx ? { ...t, [key]: val } : t));

  const addTemuan = () =>
    setTemuan(prev => [...prev, emptyTemuan()]);

  const removeTemuan = async (idx) => {
    if (temuan[idx].foto?.path) await supabase.storage.from("foto-inspeksi").remove([temuan[idx].foto.path]).catch(() => {});
    setTemuan(prev => prev.filter((_, i) => i !== idx));
  };

  const handleNextStep1 = () => {
    if (!nopol.trim()) { alert("Nomor Polisi wajib diisi!"); return; }
    if (lookupStatus === "loading") { alert("Sedang mencari data kendaraan, tunggu sebentar..."); return; }
    if (lookupStatus === "notfound" || !kendaraanData) {
      alert("Nomor Polisi tidak ditemukan di database. Hubungi admin Depot untuk mendaftarkan kendaraan ini.");
      return;
    }
    setStep(2);
  };

  const validateTemuan = () => {
    let valid = true;
    const updated = temuan.map(t => {
      const eJ = !t.judul.trim();
      const eK = !t.keterangan.trim();
      const eF = !t.foto;
      if (eJ || eK || eF) valid = false;
      return { ...t, errorJudul: eJ, errorKet: eK, errorFoto: eF };
    });
    setTemuan(updated);
    if (!valid) alert("Lengkapi semua temuan — judul, keterangan, dan foto wajib diisi!");
    return valid;
  };

  // Submit — dipertahankan pola atomicity manual yang sama dengan HSEFormScreen:
  // kalau insert temuan/foto gagal SETELAH baris inspeksi_p1 terlanjur terbuat,
  // baris itu langsung dihapus lagi (rollback manual, bukan transaksi database
  // asli). submittedRef baru diset true setelah SEMUA insert berhasil, supaya
  // cleanup foto orphan (efek unmount) tetap jalan kalau submit gagal.
  const handleSubmit = async () => {
    if (!validateTemuan()) return;
    setSubmitting(true);
    let inspData = null;
    try {
      // Insert inspeksi_p1 — semua data kendaraan dari database (kendaraanData)
      const { data: insp, error: inspErr } = await supabase.from("inspeksi_p1").insert([{
        user_id: currentUser,
        nomor_polisi: nopol.trim().toUpperCase(),
        kapasitas_mt: kendaraanData.kapasitas_mt,
        jumlah_kompartemen: kendaraanData.jumlah_kompartemen,
        transportir: kendaraanData.transportir,
        kategori_mt: kendaraanData.kategori_mt,
        is_submitted: true,
        submitted_at: new Date().toISOString(),
        status: "baru",
      }]).select().single();
      if (inspErr) throw inspErr;
      inspData = insp;

      // Insert setiap temuan + foto
      for (const t of temuan) {
        const { data: tv, error: tvErr } = await supabase.from("inspeksi_p1_temuan").insert([{
          inspeksi_p1_id: inspData.id,
          judul: t.judul,
          keterangan: t.keterangan,
        }]).select().single();
        if (tvErr) throw tvErr;
        if (t.foto?.url) {
          const { error: fotoErr } = await supabase.from("foto_inspeksi_p1").insert([{
            temuan_id: tv.id,
            url: t.foto.url,
          }]);
          if (fotoErr) throw fotoErr;
        }
      }

      // Semua insert berhasil — baru sekarang dianggap benar-benar tersimpan.
      submittedRef.current = true;
      clearDraft();
      alert("✓ Laporan cek random berhasil dikirim!");
      onNav("dashboard");
    } catch (err) {
      // Rollback manual: kalau baris inspeksi_p1 sempat terbuat tapi data
      // turunannya (temuan/foto) gagal, hapus lagi baris itu.
      if (inspData?.id) {
        await supabase.from("inspeksi_p1").delete().eq("id", inspData.id).catch(() => {});
      }
      alert("Gagal menyimpan: " + err.message + "\n\nData belum tersimpan. Silakan coba kirim ulang.");
    } finally {
      setSubmitting(false);
    }
  };

  const STEPS = ["Kendaraan", "Temuan"];

  return (
    <div style={{ minHeight: "100vh", background: theme.bg, display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ background: theme.surface, padding: "48px 16px 16px", borderBottom: `1px solid ${theme.border}`, boxShadow: theme.shadow }}>
        <div onClick={() => { if (step > 1) setStep(1); else onBack(); }} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14, cursor: "pointer", color: theme.textSub, fontSize: 13 }}>
          <Icon name="arrow" size={16} color={theme.textSub} /> Kembali
        </div>
        <div style={{ fontWeight: 800, fontSize: 18, color: theme.text, marginBottom: 16 }}>Pengecekan / Temuan</div>
        {/* Step indicator */}
        <div style={{ display: "flex", alignItems: "center" }}>
          {STEPS.map((s, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", flex: i < STEPS.length - 1 ? 1 : 0 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: step > i + 1 ? theme.success : step === i + 1 ? "#7C3AED" : theme.surfaceAlt, fontSize: 12, fontWeight: 700, color: step >= i + 1 ? "#fff" : theme.textMuted }}>
                  {step > i + 1 ? <Icon name="check" size={13} color="#fff" /> : i + 1}
                </div>
                <div style={{ fontSize: 10, marginTop: 4, color: step === i + 1 ? "#7C3AED" : theme.textMuted, fontWeight: step === i + 1 ? 700 : 400 }}>{s}</div>
              </div>
              {i < STEPS.length - 1 && <div style={{ flex: 1, height: 2, background: step > i + 1 ? theme.success : theme.border, margin: "0 6px", marginBottom: 14 }} />}
            </div>
          ))}
        </div>
      </div>

      {restoreBanner}
      {expiredNotice}

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 16px", paddingBottom: 90 }}>

        {/* Step 1 — Data Kendaraan (readonly, auto-fill dari database) */}
        {step === 1 && (
          <>
            <SectionLabel>Data Kendaraan</SectionLabel>
            <div style={{ background: theme.surface, borderRadius: 14, padding: 16, border: `1px solid ${theme.border}` }}>
              <Input label="Nomor Polisi" placeholder="B 1234 XY" value={nopol} onChange={handleNopolChange} />

              {lookupStatus === "loading" && (
                <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 10 }}>🔍 Mencari data kendaraan...</div>
              )}
              {lookupStatus === "notfound" && (
                <div style={{ fontSize: 12, color: theme.danger, fontWeight: 600, marginBottom: 12, padding: "8px 12px", background: theme.dangerLight, borderRadius: 8 }}>
                  ⚠️ Nomor Polisi tidak ditemukan. Hubungi admin Depot untuk mendaftarkan kendaraan ini.
                </div>
              )}

              {lookupStatus === "found" && kendaraanData && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 11, color: theme.success, fontWeight: 700, marginBottom: 10 }}>
                    ✅ Data kendaraan ditemukan
                  </div>
                  <InfoRow label="Transportir" value={kendaraanData.transportir} />
                  <InfoRow label="Kapasitas MT" value={kendaraanData.kapasitas_mt} />
                  <InfoRow label="Jumlah Kompartemen" value={kendaraanData.jumlah_kompartemen ? `${kendaraanData.jumlah_kompartemen} kompartemen` : null} />
                  <InfoRow label="Kategori MT" value={kendaraanData.kategori_mt === "merah_putih" ? "MT Merah Putih" : kendaraanData.kategori_mt === "industri" ? "MT Industri" : kendaraanData.kategori_mt} />
                  <InfoRow label="Masa Berlaku Head Truck" value={formatTanggal(kendaraanData.masa_berlaku_head_truck)} />
                  <InfoRow label="Masa Berlaku Tangki" value={formatTanggal(kendaraanData.masa_berlaku_tangki)} />
                </div>
              )}
            </div>
          </>
        )}

        {/* Step 2 — Form Temuan */}
        {step === 2 && (
          <>
            <SectionLabel>Form Temuan</SectionLabel>
            <div style={{ fontSize: 13, color: theme.textMuted, marginBottom: 16 }}>
              Isi setiap temuan yang ditemukan. Tiap temuan wajib ada <b>judul</b>, <b>keterangan</b>, dan <b>foto</b>.
            </div>

            {temuan.map((t, i) => (
              <TemuanItem
                key={i} idx={i} item={t}
                onChange={updateTemuan}
                onRemove={removeTemuan}
                showRemove={temuan.length > 1}
                onPreview={setPreviewUrl}
                requestAccess={requestAccess}
              />
            ))}

            {/* Tombol Tambah Pengecekan */}
            <div onClick={addTemuan} style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              padding: "14px", borderRadius: 12, border: `2px dashed #7C3AED`,
              color: "#7C3AED", fontWeight: 700, fontSize: 13, cursor: "pointer",
              background: "#EDE9FE", marginBottom: 8,
            }}>
              <Icon name="plus" size={16} color="#7C3AED" /> Tambah Pengecekan
            </div>
            <div style={{ fontSize: 11, color: theme.textMuted, textAlign: "center", marginBottom: 16 }}>
              Klik tombol di atas kalau ada lebih dari satu temuan
            </div>
          </>
        )}
      </div>

      {/* Bottom Action */}
      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, padding: "12px 16px", background: theme.surface, borderTop: `1px solid ${theme.border}`, display: "flex", gap: 10 }}>
        {step > 1 && (
          <Btn onClick={() => setStep(s => s - 1)} variant="ghost" style={{ flex: 0.5, padding: "12px", fontSize: 13 }} disabled={submitting}>
            ← Kembali
          </Btn>
        )}
        {step === 1 && <Btn onClick={handleNextStep1} variant="primary" disabled={submitting || lookupStatus === "loading"}>Lanjut →</Btn>}
        {step === 2 && (
          <Btn onClick={handleSubmit} variant="primary" icon="check" disabled={submitting}>
            {submitting ? "Menyimpan..." : "Simpan & Kirim"}
          </Btn>
        )}
      </div>

      <PhotoLightbox url={previewUrl} onClose={() => setPreviewUrl(null)} />
    </div>
  );
};

export default P1FormScreen;