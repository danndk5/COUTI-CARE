import { useState, useEffect, useRef, useCallback } from "react";
import Btn from "../components/Btn";
import Icon from "../components/Icon";
import Input from "../components/Input";
import SectionLabel from "../components/SectionLabel";
import ToggleStatus from "../components/ToggleStatus";
import theme from "../styles/theme";
import { supabase } from "../lib/supabase";

// ── Helpers ──────────────────────────────────────────────────────────────────
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

// ── ToggleAktif — Aktif / Tidak Aktif ────────────────────────────────────────
const ToggleAktif = ({ value, onChange }) => (
  <div style={{ display: "flex", gap: 8, marginTop: 10, marginBottom: 4 }}>
    {["Aktif", "Tidak Aktif"].map((opt) => (
      <div
        key={opt}
        onClick={() => onChange(opt)}
        style={{
          flex: 1, textAlign: "center", padding: "9px 0", borderRadius: 10,
          fontSize: 13, fontWeight: 600, cursor: "pointer",
          background: value === opt
            ? (opt === "Aktif" ? theme.success : theme.danger)
            : theme.surfaceAlt,
          color: value === opt ? "#fff" : theme.textMuted,
          border: `1.5px solid ${value === opt
            ? (opt === "Aktif" ? theme.success : theme.danger)
            : theme.border}`,
          transition: "all 0.15s",
        }}
      >
        {opt === "Aktif" ? "✅ Aktif" : "❌ Tidak Aktif"}
      </div>
    ))}
  </div>
);

// ── CameraCapture ─────────────────────────────────────────────────────────────
const CameraCapture = ({ label, kategori, onPhotos, allPhotos, errorFoto }) => {
  const [photos,   setPhotos]   = useState([]);
  const [capState, setCapState] = useState("idle");
  const [permErr,  setPermErr]  = useState(null);
  const fileInputRef = useRef(null);

  const checkPerms = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      stream.getTracks().forEach((t) => t.stop());
    } catch { throw new Error("camera"); }
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

  const applyOverlay = async (file) => {
    let serverTime = new Date();
    try {
      const { data } = await supabase.rpc("get_server_time");
      if (data) serverTime = new Date(data);
    } catch { console.warn("get_server_time fallback ke device time"); }

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

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setCapState("processing");
    try {
      const blob     = await applyOverlay(files[0]);
      const fileName = `${kategori}-${Date.now()}.jpg`;
      const { data, error } = await supabase.storage
        .from("foto-inspeksi").upload(fileName, blob, { contentType: "image/jpeg" });
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
    <div style={{ marginBottom: 12 }}>
      <div style={{
        border: `2px dashed ${borderColor}`, borderRadius: 12, padding: "14px 16px",
        background: errorFoto ? theme.dangerLight : "transparent",
      }}>
        <div style={{ fontSize: 12, color: errorFoto ? theme.danger : theme.textMuted, marginBottom: 10, textAlign: "center" }}>
          {label}
          <div style={{ fontSize: 11, marginTop: 2 }}>📷 Kamera belakang · ⏱ Timestamp server · 📍 GPS</div>
        </div>
        {permErr && (
          <div style={{ marginBottom: 10, padding: "8px 12px", borderRadius: 8, background: theme.dangerLight, color: theme.danger, fontSize: 12, fontWeight: 600 }}>
            ⛔ {permErr}
          </div>
        )}
        <input ref={fileInputRef} type="file" accept="image/*" capture="environment"
          onChange={handleFileChange} style={{ display: "none" }} />
        <Btn onClick={handleCaptureClick} variant="outline" style={{ padding: "9px", fontSize: 13, width: "100%" }} disabled={isWorking}>
          {capState === "checking"   ? "🔐 Cek izin..." :
           capState === "processing" ? "⏳ Memproses..." : "📷 Ambil Foto"}
        </Btn>
        {photos.length > 0 && (
          <div style={{ marginTop: 10 }}>
            {photos.map((p) => (
              <div key={p.path} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "8px 12px", background: theme.primaryLight, borderRadius: 8, marginBottom: 6,
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
          ⚠️ Foto dokumentasi wajib diambil.
        </div>
      )}
    </div>
  );
};

// ── CheckItemWithFoto — toggle Normal/Abnormal + keterangan + foto ────────────
const CheckItemWithFoto = ({ label, status, onStatus, ket, onKet, errorKet, kategori, onPhotos, allPhotos, errorFoto }) => {
  const hasPhoto = allPhotos.some((p) => p.kategori === kategori);
  return (
    <div style={{ marginBottom: 14, padding: 14, borderRadius: 12, background: theme.surfaceAlt, border: `1px solid ${theme.border}` }}>
      <div style={{ fontWeight: 600, fontSize: 14, color: theme.text, marginBottom: 6 }}>{label}</div>
      <ToggleStatus value={status} onChange={onStatus} />
      {status === "Abnormal" && (
        <>
          <textarea
            placeholder="Tuliskan keterangan temuan..."
            value={ket}
            onChange={(e) => onKet(e.target.value)}
            style={{
              marginTop: 10, width: "100%", padding: "10px 12px", borderRadius: 10,
              border: `1.5px solid ${errorKet ? theme.danger : theme.border}`,
              background: errorKet ? theme.dangerLight : theme.surface,
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
      <div style={{ marginTop: 10 }}>
        <CameraCapture
          label="Foto dokumentasi"
          kategori={kategori}
          onPhotos={onPhotos}
          allPhotos={allPhotos}
          errorFoto={errorFoto}
        />
      </div>
    </div>
  );
};

// ── StatusAktifWithFoto — Aktif/Tidak Aktif + foto ───────────────────────────
const StatusAktifWithFoto = ({ label, status, onStatus, kategori, onPhotos, allPhotos, errorFoto }) => {
  return (
    <div style={{ marginBottom: 14, padding: 14, borderRadius: 12, background: theme.surfaceAlt, border: `1px solid ${theme.border}` }}>
      <div style={{ fontWeight: 600, fontSize: 14, color: theme.text, marginBottom: 2 }}>{label}</div>
      <ToggleAktif value={status} onChange={onStatus} />
      <div style={{ marginTop: 10 }}>
        <CameraCapture
          label="Foto dokumentasi"
          kategori={kategori}
          onPhotos={onPhotos}
          allPhotos={allPhotos}
          errorFoto={errorFoto}
        />
      </div>
    </div>
  );
};

// ── FormScreen ────────────────────────────────────────────────────────────────
const FormScreen = ({ onBack, onNav }) => {
  const [step,        setStep]        = useState(1); // 1=Kendaraan, 2=GPS, 3=CCTV
  const [currentUser, setCurrentUser] = useState(null);
  const [submitting,  setSubmitting]  = useState(false);
  const [photos,      setPhotos]      = useState([]);

  // Auto-fill kendaraan
  const [lookupStatus, setLookupStatus] = useState("idle");
  const [isAutoFilled, setIsAutoFilled] = useState(false);
  const lookupTimer = useRef(null);

  const photosRef    = useRef(photos);
  const submittedRef = useRef(false);
  useEffect(() => { photosRef.current = photos; }, [photos]);

  // Step history
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

  // Data kendaraan — lookup key: nomor_polisi (bukan nomor_lambung lagi)
  const [kendaraan, setKendaraan] = useState({ polisi: "", transportir: "", pemeriksa: "" });
  const setK = (k) => (v) => setKendaraan((p) => ({ ...p, [k]: v }));

  // Load nama pemeriksa otomatis dari profil
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

  // Debounce lookup saat Nomor Polisi berubah
  const handlePolisiChange = useCallback((val) => {
    setKendaraan((p) => ({ ...p, polisi: val, transportir: "" }));
    setIsAutoFilled(false);
    setLookupStatus("idle");
    if (lookupTimer.current) clearTimeout(lookupTimer.current);
    if (!val.trim()) return;

    lookupTimer.current = setTimeout(async () => {
      setLookupStatus("loading");
      try {
        const { data } = await supabase
          .from("kendaraan").select("transportir")
          .eq("nomor_polisi", val.trim().toUpperCase()).maybeSingle();
        if (data) {
          setKendaraan((p) => ({ ...p, transportir: data.transportir }));
          setIsAutoFilled(true);
          setLookupStatus("found");
        } else {
          setLookupStatus("new");
        }
      } catch { setLookupStatus("new"); }
    }, 600);
  }, []);

  // ── State GPS ─────────────────────────────────────────────────────────────
  const [gps, setGps] = useState({
    status:      "",   // Aktif | Tidak Aktif
    segel:       { status: "", ket: "" },
    kabel:       { status: "", ket: "" },
  });
  const setGpsField = (field, key) => (val) =>
    setGps((p) => ({ ...p, [field]: { ...p[field], [key]: val } }));

  // ── State CCTV ────────────────────────────────────────────────────────────
  const initCctv = () => ({ status: "", segel_bricket: "", segel_kabel: "", ket_bricket: "", ket_kabel: "" });
  const [cctv, setCctv] = useState({
    dashcam: initCctv(),
    kanan:   initCctv(),
    kiri:    initCctv(),
  });
  const setCctvField = (cam, field) => (val) =>
    setCctv((p) => ({ ...p, [cam]: { ...p[cam], [field]: val } }));

  // ── State Segel Kotak Sekring ─────────────────────────────────────────────
  const [segelKotakSekring, setSegelKotakSekring] = useState(""); // Aktif | Tidak Aktif

  // ── Validasi errors ───────────────────────────────────────────────────────
  const [errors, setErrors] = useState({});

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
    if (!kendaraan.polisi.trim()) { alert("Nomor Polisi wajib diisi!"); return; }
    if (!kendaraan.transportir.trim()) { alert("Transportir wajib diisi!"); return; }
    setStep(2);
  };

  const handleNextStep2 = () => {
    if (!validateStep2()) {
      alert("Lengkapi semua data GPS dan foto dokumentasi!");
      return;
    }
    setStep(3);
  };

  const handleSubmit = async () => {
    if (!validateStep3()) {
      alert("Lengkapi semua data CCTV dan foto dokumentasi!");
      return;
    }

    setSubmitting(true);
    try {
      const { data: inspData, error: inspErr } = await supabase
        .from("inspeksi").insert([{
          user_id:                currentUser,
          nomor_polisi:           kendaraan.polisi.trim().toUpperCase(),
          nama_pemeriksa:         kendaraan.pemeriksa,
          perusahaan_transportir: kendaraan.transportir,
          // GPS
          status_gps:             gps.status,
          segel_gps:              gps.segel.status,
          segel_gps_ket:          gps.segel.ket,
          kabel_gps:              gps.kabel.status,
          kabel_gps_ket:          gps.kabel.ket,
          // CCTV Dashcam
          status_cctv_dashcam:        cctv.dashcam.status,
          segel_bricket_dashcam:      cctv.dashcam.segel_bricket,
          segel_bricket_dashcam_ket:  cctv.dashcam.ket_bricket,
          segel_kabel_dashcam:        cctv.dashcam.segel_kabel,
          segel_kabel_dashcam_ket:    cctv.dashcam.ket_kabel,
          // CCTV Kanan
          status_cctv_kanan:        cctv.kanan.status,
          segel_bricket_kanan:      cctv.kanan.segel_bricket,
          segel_bricket_kanan_ket:  cctv.kanan.ket_bricket,
          segel_kabel_kanan:        cctv.kanan.segel_kabel,
          segel_kabel_kanan_ket:    cctv.kanan.ket_kabel,
          // CCTV Kiri
          status_cctv_kiri:        cctv.kiri.status,
          segel_bricket_kiri:      cctv.kiri.segel_bricket,
          segel_bricket_kiri_ket:  cctv.kiri.ket_bricket,
          segel_kabel_kiri:        cctv.kiri.segel_kabel,
          segel_kabel_kiri_ket:    cctv.kiri.ket_kabel,
          // Segel Kotak Sekring
          segel_kotak_sekring:     segelKotakSekring,
          // Status submit ke depot
          is_submitted:  true,
          submitted_at:  new Date().toISOString(),
          status:        "baru",
        }]).select().single();

      if (inspErr) throw inspErr;
      submittedRef.current = true;

      // Simpan foto
      if (photos.length > 0) {
        const { error: fotoErr } = await supabase.from("foto_inspeksi").insert(
          photos.map((p) => ({ inspeksi_id: inspData.id, url: p.url, kategori: p.kategori, timestamp_foto: p.timestamp }))
        );
        if (fotoErr) {
          alert("⚠️ Laporan tersimpan, tapi foto gagal.\n\nDetail: " + fotoErr.message);
          onNav("dashboard"); return;
        }
      }

      // Upsert kendaraan untuk auto-fill berikutnya (key: nomor_polisi)
      if (kendaraan.polisi && kendaraan.transportir) {
        supabase.from("kendaraan").upsert(
          { nomor_polisi: kendaraan.polisi.trim().toUpperCase(), transportir: kendaraan.transportir.trim(), updated_at: new Date().toISOString() },
          { onConflict: "nomor_polisi" }
        ).then(({ error: e }) => { if (e) console.warn("Upsert kendaraan:", e.message); });
      }

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
      {/* Header */}
      <div style={{ background: theme.surface, padding: "48px 16px 16px", borderBottom: `1px solid ${theme.border}`, boxShadow: theme.shadow }}>
        <div onClick={() => { if (step > 1) window.history.back(); else onBack(); }}
          style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14, cursor: "pointer", color: theme.textSub, fontSize: 13 }}>
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
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 16px", paddingBottom: 100 }}>

        {/* ── Step 1: Kendaraan ── */}
        {step === 1 && (
          <>
            <SectionLabel>Data Kendaraan</SectionLabel>
            <div style={{ background: theme.surface, borderRadius: 14, padding: 16, border: `1px solid ${theme.border}` }}>

              <Input
                label="Nomor Polisi"
                placeholder="Contoh: B 1234 XY"
                value={kendaraan.polisi}
                onChange={handlePolisiChange}
              />

              {lookupStatus === "loading" && (
                <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 10 }}>🔍 Mencari data kendaraan...</div>
              )}
              {lookupStatus === "found" && (
                <div style={{ fontSize: 12, color: theme.success, fontWeight: 600, marginBottom: 10 }}>
                  ✅ Data ditemukan — Transportir terisi otomatis
                </div>
              )}
              {lookupStatus === "new" && (
                <div style={{ fontSize: 12, color: "#F59E0B", fontWeight: 600, marginBottom: 10 }}>
                  🆕 Kendaraan baru — isi manual, tersimpan untuk pengecekan berikutnya
                </div>
              )}

              <Input
                label="Transportir"
                placeholder="PT. ..."
                value={kendaraan.transportir}
                onChange={isAutoFilled ? undefined : setK("transportir")}
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

              {/* Nama pemeriksa otomatis dari akun */}
              <div style={{ padding: "10px 12px", borderRadius: 10, background: theme.surfaceAlt, border: `1px solid ${theme.border}`, marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 2 }}>Nama Pemeriksa</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>{kendaraan.pemeriksa || "Memuat..."}</div>
                <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 2 }}>Otomatis dari akun login</div>
              </div>

              <div style={{ fontSize: 12, color: theme.textMuted }}>
                📅 {new Date().toLocaleDateString("id-ID")} · 🕐{" "}
                {new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
          </>
        )}

        {/* ── Step 2: GPS ── */}
        {step === 2 && (
          <>
            <SectionLabel>Kondisi GPS</SectionLabel>

            {/* Status GPS */}
            <StatusAktifWithFoto
              label="Status GPS"
              status={gps.status}
              onStatus={(v) => setGps((p) => ({ ...p, status: v }))}
              kategori="gps_status"
              onPhotos={setPhotos}
              allPhotos={photos}
              errorFoto={errors.gps_status_foto}
            />
            {errors.gps_status && <div style={{ fontSize: 12, color: theme.danger, fontWeight: 600, marginTop: -8, marginBottom: 10 }}>⚠️ Status GPS wajib dipilih.</div>}

            {/* Segel GPS */}
            <CheckItemWithFoto
              label="Segel GPS"
              status={gps.segel.status}   onStatus={setGpsField("segel", "status")}
              ket={gps.segel.ket}         onKet={setGpsField("segel", "ket")}
              errorKet={errors.gps_segel_ket}
              kategori="gps_segel"
              onPhotos={setPhotos}
              allPhotos={photos}
              errorFoto={errors.gps_segel_foto}
            />

            {/* Kabel GPS */}
            <CheckItemWithFoto
              label="Kabel GPS"
              status={gps.kabel.status}   onStatus={setGpsField("kabel", "status")}
              ket={gps.kabel.ket}         onKet={setGpsField("kabel", "ket")}
              errorKet={errors.gps_kabel_ket}
              kategori="gps_kabel"
              onPhotos={setPhotos}
              allPhotos={photos}
              errorFoto={errors.gps_kabel_foto}
            />
          </>
        )}

        {/* ── Step 3: CCTV ── */}
        {step === 3 && (
          <>
            {/* CCTV Dashcam */}
            <SectionLabel>CCTV Dashcam</SectionLabel>
            <StatusAktifWithFoto
              label="Status CCTV Dashcam"
              status={cctv.dashcam.status}
              onStatus={setCctvField("dashcam", "status")}
              kategori="cctv_dashcam_status"
              onPhotos={setPhotos} allPhotos={photos}
              errorFoto={errors.dashcam_status_foto}
            />
            <CheckItemWithFoto
              label="Segel Bricket"
              status={cctv.dashcam.segel_bricket} onStatus={setCctvField("dashcam", "segel_bricket")}
              ket={cctv.dashcam.ket_bricket}      onKet={setCctvField("dashcam", "ket_bricket")}
              errorKet={errors.dashcam_bricket_ket}
              kategori="cctv_dashcam_bricket"
              onPhotos={setPhotos} allPhotos={photos}
              errorFoto={errors.dashcam_bricket_foto}
            />
            <CheckItemWithFoto
              label="Segel Sambungan Kabel"
              status={cctv.dashcam.segel_kabel} onStatus={setCctvField("dashcam", "segel_kabel")}
              ket={cctv.dashcam.ket_kabel}      onKet={setCctvField("dashcam", "ket_kabel")}
              errorKet={errors.dashcam_kabel_ket}
              kategori="cctv_dashcam_kabel"
              onPhotos={setPhotos} allPhotos={photos}
              errorFoto={errors.dashcam_kabel_foto}
            />

            {/* CCTV Kanan */}
            <SectionLabel style={{ marginTop: 8 }}>CCTV Kanan</SectionLabel>
            <StatusAktifWithFoto
              label="Status CCTV Kanan"
              status={cctv.kanan.status}
              onStatus={setCctvField("kanan", "status")}
              kategori="cctv_kanan_status"
              onPhotos={setPhotos} allPhotos={photos}
              errorFoto={errors.kanan_status_foto}
            />
            <CheckItemWithFoto
              label="Segel Bricket"
              status={cctv.kanan.segel_bricket} onStatus={setCctvField("kanan", "segel_bricket")}
              ket={cctv.kanan.ket_bricket}      onKet={setCctvField("kanan", "ket_bricket")}
              errorKet={errors.kanan_bricket_ket}
              kategori="cctv_kanan_bricket"
              onPhotos={setPhotos} allPhotos={photos}
              errorFoto={errors.kanan_bricket_foto}
            />
            <CheckItemWithFoto
              label="Segel Sambungan Kabel"
              status={cctv.kanan.segel_kabel} onStatus={setCctvField("kanan", "segel_kabel")}
              ket={cctv.kanan.ket_kabel}      onKet={setCctvField("kanan", "ket_kabel")}
              errorKet={errors.kanan_kabel_ket}
              kategori="cctv_kanan_kabel"
              onPhotos={setPhotos} allPhotos={photos}
              errorFoto={errors.kanan_kabel_foto}
            />

            {/* CCTV Kiri */}
            <SectionLabel style={{ marginTop: 8 }}>CCTV Kiri</SectionLabel>
            <StatusAktifWithFoto
              label="Status CCTV Kiri"
              status={cctv.kiri.status}
              onStatus={setCctvField("kiri", "status")}
              kategori="cctv_kiri_status"
              onPhotos={setPhotos} allPhotos={photos}
              errorFoto={errors.kiri_status_foto}
            />
            <CheckItemWithFoto
              label="Segel Bricket"
              status={cctv.kiri.segel_bricket} onStatus={setCctvField("kiri", "segel_bricket")}
              ket={cctv.kiri.ket_bricket}      onKet={setCctvField("kiri", "ket_bricket")}
              errorKet={errors.kiri_bricket_ket}
              kategori="cctv_kiri_bricket"
              onPhotos={setPhotos} allPhotos={photos}
              errorFoto={errors.kiri_bricket_foto}
            />
            <CheckItemWithFoto
              label="Segel Sambungan Kabel"
              status={cctv.kiri.segel_kabel} onStatus={setCctvField("kiri", "segel_kabel")}
              ket={cctv.kiri.ket_kabel}      onKet={setCctvField("kiri", "ket_kabel")}
              errorKet={errors.kiri_kabel_ket}
              kategori="cctv_kiri_kabel"
              onPhotos={setPhotos} allPhotos={photos}
              errorFoto={errors.kiri_kabel_foto}
            />

            {/* Segel Kotak Sekring */}
            <SectionLabel style={{ marginTop: 8 }}>Segel Kotak Sekring</SectionLabel>
            <StatusAktifWithFoto
              label="Status Segel Kotak Sekring"
              status={segelKotakSekring}
              onStatus={setSegelKotakSekring}
              kategori="segel_kotak_sekring"
              onPhotos={setPhotos} allPhotos={photos}
              errorFoto={errors.segel_kotak_foto}
            />
            {errors.segel_kotak && (
              <div style={{ fontSize: 12, color: theme.danger, fontWeight: 600, marginTop: -8, marginBottom: 10 }}>
                ⚠️ Status Segel Kotak Sekring wajib dipilih.
              </div>
            )}
          </>
        )}
      </div>

      {/* Bottom Action */}
      <div style={{
        position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
        width: "100%", maxWidth: 430, padding: "12px 16px",
        background: theme.surface, borderTop: `1px solid ${theme.border}`,
        display: "flex", gap: 10,
      }}>
        {step > 1 && (
          <Btn onClick={() => window.history.back()} variant="ghost"
            style={{ flex: 0.5, padding: "12px", fontSize: 13 }} disabled={submitting}>
            ← Kembali
          </Btn>
        )}
        {step === 1 && (
          <Btn onClick={handleNextStep1} variant="primary" disabled={submitting}>Lanjut →</Btn>
        )}
        {step === 2 && (
          <Btn onClick={handleNextStep2} variant="primary" disabled={submitting}>Lanjut →</Btn>
        )}
        {step === 3 && (
          <Btn onClick={handleSubmit} variant="primary" icon="check" disabled={submitting}>
            {submitting ? "Menyimpan..." : "Simpan & Kirim ke Depot"}
          </Btn>
        )}
      </div>
    </div>
  );
};

export default FormScreen;