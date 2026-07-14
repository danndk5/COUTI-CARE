import { useState, useEffect, useRef, useCallback } from "react";
import Btn from "../components/Btn";
import Icon from "../components/Icon";
import Input from "../components/Input";
import SectionLabel from "../components/SectionLabel";
import ToggleStatus from "../components/ToggleStatus";
import theme from "../styles/theme";
import { supabase } from "../lib/supabase";

// ─────────────────────────────────────────────────────────────────────────────
// SETUP SUPABASE — jalankan SQL ini di Supabase SQL Editor:
//
// 1. Tabel auto-fill kendaraan:
//    CREATE TABLE kendaraan (
//      id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
//      nomor_lambung text UNIQUE NOT NULL,
//      nomor_polisi  text NOT NULL,
//      transportir   text NOT NULL,
//      created_at    timestamptz DEFAULT now(),
//      updated_at    timestamptz DEFAULT now()
//    );
//    ALTER TABLE kendaraan ENABLE ROW LEVEL SECURITY;
//    CREATE POLICY "auth baca" ON kendaraan FOR SELECT USING (auth.role()='authenticated');
//    CREATE POLICY "auth insert" ON kendaraan FOR INSERT WITH CHECK (auth.role()='authenticated');
//    CREATE POLICY "auth update" ON kendaraan FOR UPDATE USING (auth.role()='authenticated');
//
// 2. RPC server time (timestamp anti-manipulasi jam HP):
//    CREATE OR REPLACE FUNCTION get_server_time()
//    RETURNS timestamptz LANGUAGE sql SECURITY DEFINER AS $$ SELECT now(); $$;
// ─────────────────────────────────────────────────────────────────────────────

// ── Konversi desimal ke format DMS ──────────────────────────────────────────
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

// ── Format tanggal Indonesia dari Date object ────────────────────────────────
const formatServerTime = (date) => {
  const hari  = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"][date.getDay()];
  const bulan = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"][date.getMonth()];
  const hh = String(date.getHours()).padStart(2,"0");
  const mm = String(date.getMinutes()).padStart(2,"0");
  const ss = String(date.getSeconds()).padStart(2,"0");
  return `${hari}, ${date.getDate()} ${bulan} ${date.getFullYear()} ${hh}:${mm}:${ss}`;
};

// ── CheckItem ─────────────────────────────────────────────────────────────────
const CheckItem = ({ label, status, onStatus, ket, onKet, errorKet }) => (
  <div style={{ marginBottom: 14, padding: 14, borderRadius: 12, background: theme.surfaceAlt, border: `1px solid ${theme.border}` }}>
    <div style={{ fontWeight: 600, fontSize: 14, color: theme.text }}>{label}</div>
    <ToggleStatus value={status} onChange={onStatus} />
    {status === "Abnormal" && (
      <>
        <textarea
          placeholder="Tuliskan keterangan temuan..."
          value={ket}
          onChange={(e) => onKet(e.target.value)}
          style={{
            marginTop: 10, width: "100%", padding: "10px 12px", borderRadius: 10,
            border: `1.5px solid ${theme.danger}`, background: theme.dangerLight,
            color: theme.text, fontSize: 13, fontFamily: "'DM Sans', sans-serif",
            resize: "none", minHeight: 70, boxSizing: "border-box", outline: "none",
          }}
        />
        {errorKet && (
          <div style={{ marginTop: 5, fontSize: 12, color: theme.danger, fontWeight: 600 }}>
            ⚠️ Keterangan wajib diisi saat kondisi Abnormal.
          </div>
        )}
      </>
    )}
  </div>
);

// ── CameraCapture — kamera belakang + overlay timestamp server + GPS ──────────
// Menggantikan PhotoUpload. Menggunakan capture="environment" untuk buka
// kamera belakang langsung. Timestamp dari server Supabase (anti-manipulasi HP).
// CATATAN: fake GPS di web tidak bisa dideteksi 100% (keterbatasan browser API).
const CameraCapture = ({ label, kategori, onPhotos, hasPhoto, errorFoto }) => {
  const [photos,   setPhotos]   = useState([]);
  const [capState, setCapState] = useState("idle"); // "idle"|"checking"|"processing"
  const [permErr,  setPermErr]  = useState(null);
  const fileInputRef = useRef(null);

  // Cek izin kamera & GPS sebelum buka picker
  const checkPerms = async () => {
    // Kamera
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      stream.getTracks().forEach((t) => t.stop());
    } catch {
      throw new Error("camera");
    }
    // GPS
    await new Promise((res, rej) =>
      navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 10000 })
    );
  };

  const handleCaptureClick = async () => {
    setPermErr(null);
    setCapState("checking");
    try {
      await checkPerms();
      setCapState("idle");
      fileInputRef.current?.click();
    } catch (err) {
      setCapState("idle");
      setPermErr(
        err.message === "camera"
          ? "Izin kamera diperlukan. Aktifkan di pengaturan browser lalu coba lagi."
          : "Izin lokasi (GPS) diperlukan. Aktifkan di pengaturan browser lalu coba lagi."
      );
    }
  };

  // Gambar overlay timestamp + GPS ke canvas, return Blob JPEG
  const applyOverlay = async (file) => {
    // 1. Server time (anti-manipulasi jam HP)
    let serverTime = new Date();
    try {
      const { data } = await supabase.rpc("get_server_time");
      if (data) serverTime = new Date(data);
    } catch {
      // Fallback device time — muncul hanya jika RPC belum dibuat di Supabase
      console.warn("get_server_time belum tersedia, gunakan device time sebagai fallback");
    }

    // 2. Koordinat GPS saat foto diambil
    const pos = await new Promise((res, rej) =>
      navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 15000 })
    );
    const { latitude, longitude } = pos.coords;
    const dmsStr  = formatDMS(latitude, longitude);
    const timeStr = formatServerTime(serverTime);

    // 3. Load gambar ke canvas
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

    // 4. Overlay pojok kiri bawah
    const fontSize   = Math.max(20, Math.round(img.width * 0.028));
    const pad        = fontSize * 0.7;
    const lineH      = fontSize * 1.6;

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

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setCapState("processing");
    try {
      const blob     = await applyOverlay(files[0]);
      const fileName = `${kategori}-${Date.now()}.jpg`;

      const { data, error } = await supabase.storage
        .from("foto-inspeksi")
        .upload(fileName, blob, { contentType: "image/jpeg" });

      if (error) { alert("⚠️ Foto gagal diupload: " + error.message); return; }

      const { data: pub } = supabase.storage.from("foto-inspeksi").getPublicUrl(data.path);
      const newPhoto = { name: fileName, url: pub.publicUrl, path: data.path, timestamp: new Date() };

      setPhotos((p) => [...p, newPhoto]);
      onPhotos((p) => [...p, { kategori, url: newPhoto.url, path: newPhoto.path, timestamp: newPhoto.timestamp }]);
    } catch (err) {
      alert("⚠️ Gagal memproses foto: " + err.message);
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

  const isWorking = capState !== "idle";
  const borderColor = errorFoto ? theme.danger : theme.border;

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        border: `2px dashed ${borderColor}`, borderRadius: 12, padding: "18px 16px",
        textAlign: "center", background: errorFoto ? theme.dangerLight : "transparent",
      }}>
        <Icon name="photo" size={28} color={errorFoto ? theme.danger : theme.textMuted} />
        <div style={{ fontSize: 13, color: errorFoto ? theme.danger : theme.textMuted, marginTop: 8 }}>{label}</div>
        <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>
          📷 Kamera belakang · ⏱ Timestamp server · 📍 GPS
        </div>

        {permErr && (
          <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 8, background: theme.dangerLight, color: theme.danger, fontSize: 12, fontWeight: 600 }}>
            ⛔ {permErr}
          </div>
        )}

        <div style={{ marginTop: 12 }}>
          {/* capture="environment" = kamera belakang otomatis di mobile */}
          <input ref={fileInputRef} type="file" accept="image/*" capture="environment"
            onChange={handleFileChange} style={{ display: "none" }} />
          <Btn onClick={handleCaptureClick} variant="outline" style={{ padding: "9px", fontSize: 13 }} disabled={isWorking}>
            {capState === "checking"   && "🔐 Cek izin..."}
            {capState === "processing" && "⏳ Memproses..."}
            {capState === "idle"       && "📷 Ambil Foto"}
          </Btn>
        </div>

        {photos.length > 0 && (
          <div style={{ marginTop: 12 }}>
            {photos.map((p) => (
              <div key={p.path} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "8px 12px", background: theme.primaryLight, borderRadius: 8, marginBottom: 8,
                fontSize: 12, color: theme.primary,
              }}>
                <span>✓ {p.name}</span>
                <div onClick={() => removePhoto(p.path)} style={{ cursor: "pointer", fontWeight: 700, color: theme.danger }}>✕</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {errorFoto && (
        <div style={{ marginTop: 6, fontSize: 12, color: theme.danger, fontWeight: 600 }}>
          ⚠️ Foto dokumentasi wajib diambil sebelum melanjutkan.
        </div>
      )}
    </div>
  );
};

// ── CamSection ────────────────────────────────────────────────────────────────
const CamSection = ({ title, cam, cctv, setCctvField, errorsKet }) => (
  <div style={{ marginBottom: 20 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
      <div style={{ width: 30, height: 30, borderRadius: 9, background: theme.primaryLight, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon name="camera" size={15} color={theme.primary} />
      </div>
      <div style={{ fontWeight: 700, fontSize: 14, color: theme.text }}>CCTV {title}</div>
    </div>
    <CheckItem
      label="Segel Bricket"
      status={cctv[cam].segel_bricket} onStatus={setCctvField(cam, "segel_bricket")}
      ket={cctv[cam].ket_bricket}      onKet={setCctvField(cam, "ket_bricket")}
      errorKet={errorsKet?.[cam]?.ket_bricket || false}
    />
    <CheckItem
      label="Segel Sambungan Kabel"
      status={cctv[cam].segel_kabel} onStatus={setCctvField(cam, "segel_kabel")}
      ket={cctv[cam].ket_kabel}      onKet={setCctvField(cam, "ket_kabel")}
      errorKet={errorsKet?.[cam]?.ket_kabel || false}
    />
  </div>
);

// ── FormScreen ────────────────────────────────────────────────────────────────
const FormScreen = ({ onBack, onNav }) => {
  const [step,       setStep]       = useState(1);
  const [currentUser,setCurrentUser]= useState(null);
  const stepRef = useRef(1); // ref untuk step — dibaca di capture listener (hindari stale closure)
  useEffect(() => { stepRef.current = step; }, [step]);
  const [submitting, setSubmitting] = useState(false);
  const [photos,     setPhotos]     = useState([]);

  // ── Auto-fill kendaraan ───────────────────────────────────────────────────
  const [lookupStatus, setLookupStatus] = useState("idle"); // idle|loading|found|new
  const [isAutoFilled, setIsAutoFilled] = useState(false);
  const lookupTimer = useRef(null);

  // ── Validasi errors ───────────────────────────────────────────────────────
  const [gpsErrors, setGpsErrors] = useState({
    segel: { ket: false }, kabel: { ket: false }, foto: false,
  });
  const [cctvErrors, setCctvErrors] = useState({
    dashcam: { ket_bricket: false, ket_kabel: false },
    kanan:   { ket_bricket: false, ket_kabel: false },
    kiri:    { ket_bricket: false, ket_kabel: false },
    foto: false,
  });

  const photosRef    = useRef(photos);
  const submittedRef = useRef(false);
  useEffect(() => { photosRef.current = photos; }, [photos]);

  // Cleanup foto orphan saat unmount
  useEffect(() => {
    return () => {
      if (!submittedRef.current && photosRef.current.length > 0) {
        const paths = photosRef.current.map((p) => p.path).filter(Boolean);
        if (paths.length) supabase.storage.from("foto-inspeksi").remove(paths).catch(console.error);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // kendaraan.armada  = Nomor Lambung (lookup key, tersimpan sebagai nama_armada di DB)
  // kendaraan.plat    = Nomor Polisi  (auto-fill)
  // kendaraan.perusahaan = Transportir (auto-fill)
  // kendaraan.pemeriksa  = Nama Pemeriksa (manual, dari profil)
  const [kendaraan, setKendaraan] = useState({ armada: "", plat: "", pemeriksa: "", perusahaan: "" });
  const setK = (k) => (v) => setKendaraan((p) => ({ ...p, [k]: v }));

  // Debounce lookup saat Nomor Lambung berubah
  const handleArmadaChange = useCallback((val) => {
    setKendaraan((p) => ({ ...p, armada: val, plat: "", perusahaan: "" }));
    setIsAutoFilled(false);
    setLookupStatus("idle");
    if (lookupTimer.current) clearTimeout(lookupTimer.current);
    if (!val.trim()) return;

    lookupTimer.current = setTimeout(async () => {
      setLookupStatus("loading");
      try {
        const { data } = await supabase
          .from("kendaraan").select("nomor_polisi, transportir")
          .eq("nomor_lambung", val.trim()).maybeSingle();

        if (data) {
          setKendaraan((p) => ({ ...p, plat: data.nomor_polisi, perusahaan: data.transportir }));
          setIsAutoFilled(true);
          setLookupStatus("found");
        } else {
          setLookupStatus("new");
        }
      } catch {
        setLookupStatus("new");
      }
    }, 600);
  }, []);

  const [gps, setGps] = useState({ segel: { status: "", ket: "" }, kabel: { status: "", ket: "" } });
  const setGpsField = (field, key) => (val) =>
    setGps((p) => ({ ...p, [field]: { ...p[field], [key]: val } }));

  const [cctv, setCctv] = useState({
    dashcam: { segel_bricket: "", segel_kabel: "", ket_bricket: "", ket_kabel: "" },
    kanan:   { segel_bricket: "", segel_kabel: "", ket_bricket: "", ket_kabel: "" },
    kiri:    { segel_bricket: "", segel_kabel: "", ket_bricket: "", ket_kabel: "" },
  });
  const setCctvField = (cam, field) => (val) =>
    setCctv((p) => ({ ...p, [cam]: { ...p[cam], [field]: val } }));

  // Load nama pemeriksa dari profil
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      setCurrentUser(user.id);
      supabase.from("profiles").select("nama").eq("id", user.id).single()
        .then(({ data: profile }) => {
          if (profile?.nama) setKendaraan((p) => ({ ...p, pemeriksa: profile.nama }));
        });
    });
  }, []);

  const hasGpsFoto  = photos.some((p) => p.kategori === "gps");
  const hasCctvFoto = photos.some((p) => p.kategori === "cctv");

  const validateGps = () => {
    const e = {
      segel: { ket: gps.segel.status === "Abnormal" && !gps.segel.ket.trim() },
      kabel: { ket: gps.kabel.status === "Abnormal" && !gps.kabel.ket.trim() },
      foto: !hasGpsFoto,
    };
    setGpsErrors(e);
    return !e.segel.ket && !e.kabel.ket && !e.foto;
  };

  const validateCctv = () => {
    const cams = ["dashcam", "kanan", "kiri"];
    const e = { foto: !hasCctvFoto };
    cams.forEach((cam) => {
      e[cam] = {
        ket_bricket: cctv[cam].segel_bricket === "Abnormal" && !cctv[cam].ket_bricket.trim(),
        ket_kabel:   cctv[cam].segel_kabel   === "Abnormal" && !cctv[cam].ket_kabel.trim(),
      };
    });
    setCctvErrors(e);
    return !e.foto && !cams.some((c) => e[c].ket_bricket || e[c].ket_kabel);
  };

  const handleNextFromGps = () => {
    if (!gps.segel.status || !gps.kabel.status) { alert("Kondisi GPS wajib diisi!"); return; }
    if (!validateGps()) return;
    setStep(3);
  };

  const handleSubmit = async () => {
    if (!kendaraan.armada || !kendaraan.plat) {
      alert("Nomor Lambung & Nomor Polisi wajib diisi!"); setStep(1); return;
    }
    if (!gps.segel.status || !gps.kabel.status) {
      alert("Kondisi GPS wajib diisi!"); setStep(2); return;
    }
    const cctvFields = [
      cctv.dashcam.segel_bricket, cctv.dashcam.segel_kabel,
      cctv.kanan.segel_bricket,   cctv.kanan.segel_kabel,
      cctv.kiri.segel_bricket,    cctv.kiri.segel_kabel,
    ];
    if (cctvFields.some((f) => !f)) { alert("Semua kondisi CCTV wajib diisi!"); setStep(3); return; }
    if (!validateGps())  { setStep(2); return; }
    if (!validateCctv()) return;

    setSubmitting(true);
    try {
      const { data: inspData, error: inspErr } = await supabase
        .from("inspeksi").insert([{
          user_id: currentUser,
          nomor_polisi: kendaraan.plat,
          nama_armada: kendaraan.armada,
          nama_pemeriksa: kendaraan.pemeriksa,
          perusahaan_transportir: kendaraan.perusahaan,
          segel_gps: gps.segel.status,          segel_gps_ket: gps.segel.ket,
          kabel_gps: gps.kabel.status,          kabel_gps_ket: gps.kabel.ket,
          segel_bricket_dashcam: cctv.dashcam.segel_bricket,
          segel_bricket_dashcam_ket: cctv.dashcam.ket_bricket,
          segel_kabel_dashcam: cctv.dashcam.segel_kabel,
          segel_kabel_dashcam_ket: cctv.dashcam.ket_kabel,
          segel_bricket_kanan: cctv.kanan.segel_bricket,
          segel_bricket_kanan_ket: cctv.kanan.ket_bricket,
          segel_kabel_kanan: cctv.kanan.segel_kabel,
          segel_kabel_kanan_ket: cctv.kanan.ket_kabel,
          segel_bricket_kiri: cctv.kiri.segel_bricket,
          segel_bricket_kiri_ket: cctv.kiri.ket_bricket,
          segel_kabel_kiri: cctv.kiri.segel_kabel,
          segel_kabel_kiri_ket: cctv.kiri.ket_kabel,
        }]).select().single();

      if (inspErr) throw inspErr;
      submittedRef.current = true;

      if (photos.length > 0) {
        const { error: fotoErr } = await supabase.from("foto_inspeksi").insert(
          photos.map((p) => ({ inspeksi_id: inspData.id, url: p.url, kategori: p.kategori, timestamp_foto: p.timestamp }))
        );
        if (fotoErr) {
          alert("⚠️ Laporan tersimpan, tapi foto gagal.\n\nDetail: " + fotoErr.message);
          onNav("dashboard"); return;
        }
      }

      // Upsert ke tabel kendaraan — simpan data untuk auto-fill berikutnya
      if (kendaraan.armada && kendaraan.plat) {
        supabase.from("kendaraan").upsert(
          { nomor_lambung: kendaraan.armada.trim(), nomor_polisi: kendaraan.plat.trim(), transportir: kendaraan.perusahaan.trim(), updated_at: new Date().toISOString() },
          { onConflict: "nomor_lambung" }
        ).then(({ error: e }) => { if (e) console.warn("Upsert kendaraan:", e.message); });
      }

      alert("✓ Data berhasil disimpan!");
      onNav("dashboard");
    } catch (err) {
      // Cleanup foto orphan jika insert inspeksi gagal
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
      {/* Header */}
      <div style={{ background: theme.surface, padding: "48px 16px 16px", borderBottom: `1px solid ${theme.border}`, boxShadow: theme.shadow }}>
        <div onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14, cursor: "pointer", color: theme.textSub, fontSize: 13 }}>
          <Icon name="arrow" size={16} color={theme.textSub} /> Kembali
        </div>
        <div style={{ fontWeight: 800, fontSize: 18, color: theme.text, marginBottom: 16 }}>Form Pengecekan</div>

        {/* Step Indicator */}
        <div style={{ display: "flex", alignItems: "center" }}>
          {steps.map((s, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", flex: i < steps.length - 1 ? 1 : 0 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{
                  width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                  background: step > i+1 ? theme.success : step === i+1 ? theme.primary : theme.surfaceAlt,
                  fontSize: 12, fontWeight: 700, color: step >= i+1 ? "#fff" : theme.textMuted,
                }}>
                  {step > i+1 ? <Icon name="check" size={13} color="#fff" /> : i+1}
                </div>
                <div style={{ fontSize: 10, marginTop: 4, color: step === i+1 ? theme.primary : theme.textMuted, fontWeight: step === i+1 ? 700 : 400 }}>
                  {s}
                </div>
              </div>
              {i < steps.length - 1 && (
                <div style={{ flex: 1, height: 2, background: step > i+1 ? theme.success : theme.border, margin: "0 6px", marginBottom: 14 }} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 16px", paddingBottom: 90 }}>

        {/* Step 1 — Kendaraan */}
        {step === 1 && (
          <>
            <SectionLabel>Data Kendaraan</SectionLabel>
            <div style={{ background: theme.surface, borderRadius: 14, padding: 16, border: `1px solid ${theme.border}` }}>

              {/* Nomor Lambung — primary lookup key */}
              <Input
                label="Nomor Lambung Mobil Tangki"
                placeholder="Contoh: MT-001"
                value={kendaraan.armada}
                onChange={handleArmadaChange}
              />

              {/* Feedback status lookup */}
              {lookupStatus === "loading" && (
                <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 10 }}>🔍 Mencari data kendaraan...</div>
              )}
              {lookupStatus === "found" && (
                <div style={{ fontSize: 12, color: theme.success, fontWeight: 600, marginBottom: 10 }}>
                  ✅ Data ditemukan — Nomor Polisi & Transportir terisi otomatis
                </div>
              )}
              {lookupStatus === "new" && (
                <div style={{ fontSize: 12, color: "#F59E0B", fontWeight: 600, marginBottom: 10 }}>
                  🆕 Kendaraan baru — isi manual, data akan tersimpan untuk pemeriksaan berikutnya
                </div>
              )}

              {/* Nomor Polisi — readonly jika auto-fill */}
              <Input
                label="Nomor Polisi"
                placeholder={isAutoFilled ? "" : "B 1234 XY"}
                value={kendaraan.plat}
                onChange={isAutoFilled ? undefined : setK("plat")}
                disabled={isAutoFilled}
              />
              {isAutoFilled && (
                <div style={{ fontSize: 11, color: theme.textMuted, marginTop: -8, marginBottom: 12 }}>
                  Terisi otomatis.{" "}
                  <span onClick={() => { setIsAutoFilled(false); setLookupStatus("new"); }}
                    style={{ color: theme.primary, cursor: "pointer", textDecoration: "underline" }}>
                    Edit manual
                  </span>
                </div>
              )}

              {/* Perusahaan Transportir — readonly jika auto-fill */}
              <Input
                label="Perusahaan Transportir"
                placeholder={isAutoFilled ? "" : "PT. ..."}
                value={kendaraan.perusahaan}
                onChange={isAutoFilled ? undefined : setK("perusahaan")}
                disabled={isAutoFilled}
              />
              {isAutoFilled && (
                <div style={{ fontSize: 11, color: theme.textMuted, marginTop: -8, marginBottom: 12 }}>
                  Terisi otomatis.{" "}
                  <span onClick={() => { setIsAutoFilled(false); setLookupStatus("new"); }}
                    style={{ color: theme.primary, cursor: "pointer", textDecoration: "underline" }}>
                    Edit manual
                  </span>
                </div>
              )}

              {/* Nama Pemeriksa — selalu manual */}
              <Input
                label="Nama Pemeriksa"
                placeholder="Nama Pemeriksa"
                value={kendaraan.pemeriksa}
                onChange={setK("pemeriksa")}
              />

              <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 8 }}>
                📅 {new Date().toLocaleDateString("id-ID")} · 🕐{" "}
                {new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
          </>
        )}

        {/* Step 2 — GPS */}
        {step === 2 && (
          <>
            <SectionLabel>Kondisi GPS</SectionLabel>
            <CheckItem
              label="Kondisi Segel GPS"
              status={gps.segel.status} onStatus={setGpsField("segel", "status")}
              ket={gps.segel.ket}       onKet={setGpsField("segel", "ket")}
              errorKet={gpsErrors.segel.ket}
            />
            <CheckItem
              label="Kabel GPS"
              status={gps.kabel.status} onStatus={setGpsField("kabel", "status")}
              ket={gps.kabel.ket}       onKet={setGpsField("kabel", "ket")}
              errorKet={gpsErrors.kabel.ket}
            />
            <SectionLabel style={{ marginTop: 8 }}>Foto Dokumentasi GPS</SectionLabel>
            <CameraCapture
              label="Foto GPS, Segel & Kabel"
              kategori="gps" onPhotos={setPhotos}
              hasPhoto={hasGpsFoto} errorFoto={gpsErrors.foto}
            />
          </>
        )}

        {/* Step 3 — CCTV */}
        {step === 3 && (
          <>
            <SectionLabel>Kondisi CCTV</SectionLabel>
            <CamSection title="Dashcam" cam="dashcam" cctv={cctv} setCctvField={setCctvField} errorsKet={cctvErrors} />
            <CamSection title="Kanan"   cam="kanan"   cctv={cctv} setCctvField={setCctvField} errorsKet={cctvErrors} />
            <CamSection title="Kiri"    cam="kiri"    cctv={cctv} setCctvField={setCctvField} errorsKet={cctvErrors} />
            <SectionLabel>Foto Dokumentasi CCTV</SectionLabel>
            <CameraCapture
              label="Foto semua kamera CCTV"
              kategori="cctv" onPhotos={setPhotos}
              hasPhoto={hasCctvFoto} errorFoto={cctvErrors.foto}
            />
          </>
        )}
      </div>

      {/* Bottom Action */}
      <div style={{
        position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
        width: "100%", maxWidth: 430, padding: "12px 16px",
        background: theme.surface, borderTop: `1px solid ${theme.border}`, display: "flex", gap: 10,
      }}>
        {step > 1 && (
          <Btn onClick={() => setStep((s) => s - 1)} variant="ghost" style={{ flex: 0.5, padding: "12px", fontSize: 13 }} disabled={submitting}>
            ← Kembali
          </Btn>
        )}
        {step < 2 ? (
          <Btn onClick={() => setStep((s) => s + 1)} variant="primary" disabled={submitting}>Lanjut →</Btn>
        ) : step === 2 ? (
          <Btn onClick={handleNextFromGps} variant="primary" disabled={submitting}>Lanjut →</Btn>
        ) : (
          <Btn onClick={handleSubmit} variant="primary" icon="check" disabled={submitting}>
            {submitting ? "Menyimpan..." : "Simpan & Kirim"}
          </Btn>
        )}
      </div>
    </div>
  );
};

export default FormScreen;