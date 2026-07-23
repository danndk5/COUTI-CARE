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

// ── CameraCapture ─────────────────────────────────────────────────────────────
const CameraCapture = ({ label, kategori, onPhotos, allPhotos, errorFoto }) => {
  const [photos,   setPhotos]   = useState([]);
  const [capState, setCapState] = useState("idle");
  const [permErr,  setPermErr]  = useState(null);
  const fileInputRef = useRef(null);

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
    } catch (err) {
      setCapState("idle");
      setPermErr("Izin kamera/lokasi diperlukan. Aktifkan di pengaturan browser.");
    }
  };

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setCapState("processing");
    try {
      const blob     = await applyOverlay(files[0]);
      const fileName = `hse-${kategori}-${Date.now()}.jpg`;
      const { data, error } = await supabase.storage
        .from("foto-inspeksi").upload(fileName, blob, { contentType: "image/jpeg" });
      if (error) { alert("⚠️ Foto gagal diupload: " + error.message); return; }
      const { data: pub } = supabase.storage.from("foto-inspeksi").getPublicUrl(data.path);
      const newPhoto = { name: fileName, url: pub.publicUrl, path: data.path };
      setPhotos((p) => [...p, newPhoto]);
      onPhotos((p) => [...p, { kategori, url: newPhoto.url, path: newPhoto.path }]);
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

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{
        border: `2px dashed ${errorFoto ? theme.danger : theme.border}`, borderRadius: 12, padding: "14px 16px",
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
        <Btn onClick={handleCaptureClick} variant="outline"
          style={{ padding: "9px", fontSize: 13, width: "100%" }} disabled={isWorking}>
          {capState === "checking" ? "🔐 Cek izin..." : capState === "processing" ? "⏳ Memproses..." : "📷 Ambil Foto"}
        </Btn>
        {photos.length > 0 && (
          <div style={{ marginTop: 10 }}>
            {photos.map((p) => (
              <div key={p.path} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "8px 12px", background: theme.primaryLight, borderRadius: 8,
                marginBottom: 6, fontSize: 12, color: theme.primary,
              }}>
                <span>✓ {p.name}</span>
                <div onClick={() => removePhoto(p.path)} style={{ cursor: "pointer", fontWeight: 700, color: theme.danger }}>✕</div>
              </div>
            ))}
          </div>
        )}
      </div>
      {errorFoto && (
        <div style={{ marginTop: 6, fontSize: 12, color: theme.danger, fontWeight: 600 }}>⚠️ Foto dokumentasi wajib diambil.</div>
      )}
    </div>
  );
};

// ── HSEFormScreen ─────────────────────────────────────────────────────────────
const HSEFormScreen = ({ onBack, onNav }) => {
  // step: "sop" | "kendaraan" | "kategori" | "kompartemen"
  const [step,        setStep]        = useState("sop");
  const [sopPage,     setSopPage]     = useState(0);
  const [currentUser, setCurrentUser] = useState(null);
  const [submitting,  setSubmitting]  = useState(false);
  const [photos,      setPhotos]      = useState([]);

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
  const [kategoriMT, setKategoriMT] = useState(""); // "merah_putih" | "industri"

  // Data kompartemen — array dinamis sesuai jumlah kompartemen
  const [kompartemenData, setKompartemenData] = useState([]);

  // Errors
  const [errors, setErrors] = useState({});

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

  // Load user
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUser(user.id);
    });
  }, []);

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
            transportir:  data.transportir        || "",
            kapasitas:    data.kapasitas_mt        || "",
            kompartemen:  data.jumlah_kompartemen?.toString() || "",
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

  // Init kompartemen data saat pindah ke step kompartemen
  const initKompartemen = (jumlah) => {
    const n = parseInt(jumlah) || 1;
    setKompartemenData(
      Array.from({ length: n }, (_, i) => ({
        nomor:      i + 1,
        status:     "",   // "kedap" | "tidak_kedap"
        keterangan: "",
      }))
    );
  };

  const setKomp = (idx, field) => (val) =>
    setKompartemenData((p) => p.map((k, i) => i === idx ? { ...k, [field]: val } : k));

  const hasPhoto = (kat) => photos.some((p) => p.kategori === kat);

  // ── Navigasi antar step ───────────────────────────────────────────────────
  const handleLanjutSOP = () => {
    if (sopPage < SOP_IMAGES.length - 1) { setSopPage((p) => p + 1); return; }
    setStep("kendaraan");
  };

  const handleSkipSOP = () => {
    setStep("kendaraan");
  };

  const handleLanjutKendaraan = () => {
    const e = {};
    if (!kendaraan.polisi.trim())     e.polisi      = true;
    if (!kendaraan.kapasitas.trim())  e.kapasitas   = true;
    if (!kendaraan.kompartemen.trim()) e.kompartemen = true;
    if (!kendaraan.transportir.trim()) e.transportir = true;
    setErrors(e);
    if (Object.keys(e).length > 0) { alert("Semua data kendaraan wajib diisi!"); return; }
    setStep("kategori");
  };

  const handleLanjutKategori = () => {
    if (!kategoriMT) { alert("Pilih kategori MT terlebih dahulu!"); return; }
    initKompartemen(kendaraan.kompartemen);
    setStep("kompartemen");
  };

  const handleSubmit = async () => {
    const e = {};
    kompartemenData.forEach((k, i) => {
      if (!k.status) e[`komp_${i}_status`] = true;
      if (k.status === "tidak_kedap" && !k.keterangan.trim()) e[`komp_${i}_ket`] = true;
      if (!hasPhoto(`komp_${i + 1}`)) e[`komp_${i}_foto`] = true;
    });
    setErrors(e);
    if (Object.keys(e).length > 0) { alert("Lengkapi semua data kompartemen dan foto!"); return; }

    setSubmitting(true);
    try {
      // Simpan inspeksi HSE
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
          status:             "baru",
        }]).select().single();
      if (inspErr) throw inspErr;

      submittedRef.current = true;

      // Simpan per kompartemen
      const kompRows = kompartemenData.map((k) => ({
        inspeksi_hse_id: inspData.id,
        nomor:           k.nomor,
        status:          k.status,
        keterangan:      k.keterangan || null,
      }));
      const { error: kompErr } = await supabase.from("inspeksi_hse_kompartemen").insert(kompRows);
      if (kompErr) throw kompErr;

      // Simpan foto
      if (photos.length > 0) {
        await supabase.from("foto_inspeksi_hse").insert(
          photos.map((p) => ({
            inspeksi_hse_id: inspData.id,
            kompartemen_no:  parseInt(p.kategori.replace("komp_", "")) || null,
            url:             p.url,
          }))
        );
      }

      // Upsert kendaraan untuk auto-fill berikutnya
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

      alert("✅ Data Uji Kedap berhasil disimpan & dikirim ke Depot!");
      onNav("dashboard");
    } catch (err) {
      const paths = photos.map((p) => p.path).filter(Boolean);
      if (paths.length) await supabase.storage.from("foto-inspeksi").remove(paths).catch(console.error);
      alert("Gagal menyimpan: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ── STEP SOP ──────────────────────────────────────────────────────────────
  if (step === "sop") {
    return (
      <div style={{ minHeight: "100vh", background: "#000", display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <div style={{ background: theme.surface, padding: "48px 16px 16px", borderBottom: `1px solid ${theme.border}` }}>
          <div onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10, cursor: "pointer", color: theme.textSub, fontSize: 13 }}>
            <Icon name="arrow" size={16} color={theme.textSub} /> Kembali
          </div>
          <div style={{ fontWeight: 800, fontSize: 18, color: theme.text }}>Acuan SOP Uji Kedap</div>
          <div style={{ fontSize: 13, color: theme.textMuted, marginTop: 2 }}>
            Halaman {sopPage + 1} dari {SOP_IMAGES.length} — baca sebelum melanjutkan
          </div>
          {/* Progress bar */}
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

        {/* Gambar SOP */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: theme.bg, padding: 16 }}>
          <img
            src={SOP_IMAGES[sopPage]}
            alt={`SOP halaman ${sopPage + 1}`}
            style={{ width: "100%", maxWidth: 500, borderRadius: 12, boxShadow: "0 4px 20px rgba(0,0,0,0.15)", objectFit: "contain" }}
          />
        </div>

        {/* Navigasi SOP */}
        <div style={{ background: theme.surface, padding: "16px", borderTop: `1px solid ${theme.border}` }}>
          {/* Tombol Skip — hanya muncul sebelum halaman terakhir */}

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
                Lewati SOP ⏭
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

        <div style={{ flex: 1, overflowY: "auto", padding: "20px 16px", paddingBottom: 100 }}>
          <div style={{ background: theme.surface, borderRadius: 14, padding: 16, border: `1px solid ${theme.border}` }}>
            <Input
              label="Nomor Polisi"
              placeholder="Contoh: B 1234 XY"
              value={kendaraan.polisi}
              onChange={handlePolisiChange}
            />
            {lookupStatus === "loading" && <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 10 }}>🔍 Mencari data kendaraan...</div>}
            {lookupStatus === "found"   && <div style={{ fontSize: 12, color: theme.success, fontWeight: 600, marginBottom: 10 }}>✅ Data ditemukan — terisi otomatis</div>}
            {lookupStatus === "new"     && <div style={{ fontSize: 12, color: "#F59E0B", fontWeight: 600, marginBottom: 10 }}>🆕 Kendaraan baru — isi manual</div>}
            {errors.polisi && <div style={{ fontSize: 12, color: theme.danger, marginBottom: 8 }}>⚠️ Nomor Polisi wajib diisi.</div>}

            <Input
              label="Kapasitas MT (contoh: 10 KL)"
              placeholder="10 KL"
              value={kendaraan.kapasitas}
              onChange={isAutoFilled ? undefined : setK("kapasitas")}
              disabled={isAutoFilled}
            />
            {errors.kapasitas && <div style={{ fontSize: 12, color: theme.danger, marginBottom: 8 }}>⚠️ Kapasitas MT wajib diisi.</div>}

            <Input
              label="Jumlah Kompartemen"
              placeholder="1 / 2 / 3"
              value={kendaraan.kompartemen}
              onChange={isAutoFilled ? undefined : setK("kompartemen")}
              disabled={isAutoFilled}
            />
            {errors.kompartemen && <div style={{ fontSize: 12, color: theme.danger, marginBottom: 8 }}>⚠️ Jumlah kompartemen wajib diisi.</div>}

            <Input
              label="Transportir"
              placeholder="PT. ..."
              value={kendaraan.transportir}
              onChange={isAutoFilled ? undefined : setK("transportir")}
              disabled={isAutoFilled}
            />
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

        <div style={{ flex: 1, padding: "24px 16px" }}>
          {[
            { value: "merah_putih", label: "MT Merah Putih", desc: "Untuk SPBU / distribusi BBM retail", icon: "🔴" },
            { value: "industri",    label: "MT Industri",    desc: "Untuk pabrik, tambang, industri", icon: "🏭" },
          ].map((opt) => (
            <div
              key={opt.value}
              onClick={() => setKategoriMT(opt.value)}
              style={{
                marginBottom: 14, padding: 20, borderRadius: 14, cursor: "pointer",
                border: `2px solid ${kategoriMT === opt.value ? theme.primary : theme.border}`,
                background: kategoriMT === opt.value ? theme.primaryLight : theme.surface,
                transition: "all 0.15s",
              }}
            >
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

  // ── STEP KOMPARTEMEN ──────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: theme.bg, display: "flex", flexDirection: "column" }}>
      <div style={{ background: theme.surface, padding: "48px 16px 16px", borderBottom: `1px solid ${theme.border}`, boxShadow: theme.shadow }}>
        <div onClick={() => setStep("kategori")} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14, cursor: "pointer", color: theme.textSub, fontSize: 13 }}>
          <Icon name="arrow" size={16} color={theme.textSub} /> Kembali
        </div>
        <div style={{ fontWeight: 800, fontSize: 18, color: theme.text }}>Uji Kedap Kompartemen</div>
        <div style={{ fontSize: 13, color: theme.textMuted, marginTop: 2 }}>
          {kendaraan.polisi} · {kendaraan.kapasitas} · {kompartemenData.length} kompartemen
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "20px 16px", paddingBottom: 100 }}>
        {kompartemenData.map((komp, idx) => (
          <div key={idx} style={{ marginBottom: 20, padding: 16, borderRadius: 14, background: theme.surface, border: `1px solid ${theme.border}` }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: theme.text, marginBottom: 12 }}>
              Kompartemen {komp.nomor}
            </div>

            {/* Toggle Kedap / Tidak Kedap */}
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              {["kedap", "tidak_kedap"].map((opt) => (
                <div
                  key={opt}
                  onClick={() => setKomp(idx, "status")(opt)}
                  style={{
                    flex: 1, textAlign: "center", padding: "10px 0", borderRadius: 10,
                    fontSize: 13, fontWeight: 600, cursor: "pointer",
                    background: komp.status === opt
                      ? (opt === "kedap" ? theme.success : theme.danger)
                      : theme.surfaceAlt,
                    color: komp.status === opt ? "#fff" : theme.textMuted,
                    border: `1.5px solid ${komp.status === opt
                      ? (opt === "kedap" ? theme.success : theme.danger)
                      : theme.border}`,
                  }}
                >
                  {opt === "kedap" ? "✅ Kedap" : "❌ Tidak Kedap"}
                </div>
              ))}
            </div>
            {errors[`komp_${idx}_status`] && (
              <div style={{ fontSize: 12, color: theme.danger, fontWeight: 600, marginBottom: 8 }}>⚠️ Status kompartemen wajib dipilih.</div>
            )}

            {/* Keterangan — wajib kalau tidak kedap */}
            {komp.status === "tidak_kedap" && (
              <>
                <textarea
                  placeholder="Tuliskan keterangan temuan (wajib)..."
                  value={komp.keterangan}
                  onChange={(e) => setKomp(idx, "keterangan")(e.target.value)}
                  style={{
                    width: "100%", padding: "10px 12px", borderRadius: 10,
                    border: `1.5px solid ${errors[`komp_${idx}_ket`] ? theme.danger : theme.border}`,
                    background: errors[`komp_${idx}_ket`] ? theme.dangerLight : theme.surfaceAlt,
                    color: theme.text, fontSize: 13, fontFamily: "'DM Sans', sans-serif",
                    resize: "none", minHeight: 80, boxSizing: "border-box", outline: "none",
                    marginBottom: 8,
                  }}
                />
                {errors[`komp_${idx}_ket`] && (
                  <div style={{ fontSize: 12, color: theme.danger, fontWeight: 600, marginBottom: 8 }}>⚠️ Keterangan wajib diisi saat tidak kedap.</div>
                )}
              </>
            )}

            {/* Foto dokumentasi */}
            <CameraCapture
              label={`Foto dokumentasi Kompartemen ${komp.nomor}`}
              kategori={`komp_${komp.nomor}`}
              onPhotos={setPhotos}
              allPhotos={photos}
              errorFoto={errors[`komp_${idx}_foto`]}
            />
          </div>
        ))}
      </div>

      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, padding: "12px 16px", background: theme.surface, borderTop: `1px solid ${theme.border}` }}>
        <Btn onClick={handleSubmit} variant="primary" icon="check" disabled={submitting}>
          {submitting ? "Menyimpan..." : "Simpan & Kirim ke Depot"}
        </Btn>
      </div>
    </div>
  );
};

export default HSEFormScreen;