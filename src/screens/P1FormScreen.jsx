import { useState, useEffect, useRef, useCallback } from "react";
import Btn from "../components/Btn";
import Icon from "../components/Icon";
import Input from "../components/Input";
import SectionLabel from "../components/SectionLabel";
import theme from "../styles/theme";
import { supabase } from "../lib/supabase";

// ── Overlay helper ────────────────────────────────────────────────────────────
const decimalToDMS = (d, p, n) => {
  const dir = d >= 0 ? p : n, abs = Math.abs(d);
  const deg = Math.floor(abs), mf = (abs - deg) * 60, min = Math.floor(mf);
  return `${deg}\u00b0${min}'${Math.round((mf - min) * 60)}"${dir}`;
};
const formatDMS = (lat, lng) => `${decimalToDMS(lat,"N","S")} ${decimalToDMS(lng,"E","W")}`;
const formatServerTime = (date) => {
  const H = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"][date.getDay()];
  const B = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"][date.getMonth()];
  return `${H}, ${date.getDate()} ${B} ${date.getFullYear()} ${String(date.getHours()).padStart(2,"0")}:${String(date.getMinutes()).padStart(2,"0")}:${String(date.getSeconds()).padStart(2,"0")}`;
};
const formatTanggal = (dateStr) => {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
};

// ── InfoRow — tampilan data kendaraan readonly ───────────────────────────────
const InfoRow = ({ label, value, highlight }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${theme.border}` }}>
    <div style={{ fontSize: 12, color: theme.textMuted }}>{label}</div>
    <div style={{ fontSize: 13, fontWeight: 600, color: highlight ? theme.danger : theme.text, textAlign: "right", maxWidth: "60%" }}>{value || "-"}</div>
  </div>
);

// ── CameraCapture ─────────────────────────────────────────────────────────────
const CameraCapture = ({ onFile, fotoUrl, onRemove, errorFoto }) => {
  const [capState, setCapState] = useState("idle");
  const [permErr,  setPermErr]  = useState(null);
  const fileRef = useRef(null);

  const checkPerms = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      s.getTracks().forEach(t => t.stop());
    } catch { throw new Error("camera"); }
    await new Promise((r, j) => navigator.geolocation.getCurrentPosition(r, j, { enableHighAccuracy: true, timeout: 10000 }));
  };

  const handleClick = async () => {
    setPermErr(null); setCapState("checking");
    try { await checkPerms(); setCapState("idle"); fileRef.current?.click(); }
    catch (e) {
      setCapState("idle");
      setPermErr(e.message === "camera"
        ? "Izin kamera diperlukan. Aktifkan di pengaturan browser."
        : "Izin lokasi (GPS) diperlukan. Aktifkan di pengaturan browser.");
    }
  };

  const applyOverlay = async (file) => {
    let serverTime = new Date();
    try { const { data } = await supabase.rpc("get_server_time"); if (data) serverTime = new Date(data); } catch {}
    const pos = await new Promise((r, j) => navigator.geolocation.getCurrentPosition(r, j, { enableHighAccuracy: true, timeout: 15000 }));
    const img = await new Promise((r, j) => { const i = new Image(); i.onload = () => r(i); i.onerror = j; i.src = URL.createObjectURL(file); });
    const canvas = document.createElement("canvas");
    canvas.width = img.width; canvas.height = img.height;
    const ctx = canvas.getContext("2d"); ctx.drawImage(img, 0, 0);
    const fs = Math.max(20, Math.round(img.width * 0.028)), pad = fs * 0.7, lh = fs * 1.6;
    const ts = formatServerTime(serverTime), ds = formatDMS(pos.coords.latitude, pos.coords.longitude);
    ctx.font = `bold ${fs}px Arial,sans-serif`;
    const bw = Math.max(ctx.measureText(ts).width, ctx.measureText(ds).width) + pad * 2.5, bh = lh * 2 + pad * 1.5;
    ctx.fillStyle = "rgba(0,0,0,0.60)"; ctx.fillRect(pad, canvas.height - bh - pad, bw, bh);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(ts, pad * 2, canvas.height - bh - pad + pad + fs);
    ctx.fillText(ds, pad * 2, canvas.height - bh - pad + pad + fs + lh);
    return new Promise(r => canvas.toBlob(r, "image/jpeg", 0.92));
  };

  const handleChange = async (e) => {
    const files = Array.from(e.target.files || []); if (!files.length) return;
    setCapState("processing");
    try {
      const blob = await applyOverlay(files[0]);
      const name = `p1-${Date.now()}.jpg`;
      const { data, error } = await supabase.storage.from("foto-inspeksi").upload(name, blob, { contentType: "image/jpeg" });
      if (error) { alert("⚠️ Upload gagal: " + error.message); return; }
      const { data: pub } = supabase.storage.from("foto-inspeksi").getPublicUrl(data.path);
      onFile({ url: pub.publicUrl, path: data.path });
    } catch (err) { alert("⚠️ Gagal memproses foto: " + err.message); }
    finally { setCapState("idle"); e.target.value = ""; }
  };

  const isWorking = capState !== "idle";
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{
        border: `2px dashed ${errorFoto ? theme.danger : theme.border}`,
        borderRadius: 10, padding: "12px",
        background: errorFoto ? theme.dangerLight : "transparent", textAlign: "center",
      }}>
        {fotoUrl ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: theme.primaryLight, borderRadius: 8, fontSize: 12, color: theme.primary }}>
            <span>✓ Foto dokumentasi tersimpan</span>
            <div onClick={onRemove} style={{ cursor: "pointer", fontWeight: 700, color: theme.danger }}>✕</div>
          </div>
        ) : (
          <>
            {permErr && <div style={{ fontSize: 11, color: theme.danger, fontWeight: 600, marginBottom: 8 }}>⛔ {permErr}</div>}
            <div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 8 }}>📷 Kamera belakang · ⏱ Timestamp · 📍 GPS</div>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleChange} style={{ display: "none" }} />
            <Btn onClick={handleClick} variant="outline" style={{ padding: "7px 16px", fontSize: 12 }} disabled={isWorking}>
              {capState === "checking" ? "🔐 Cek izin..." : capState === "processing" ? "⏳ Memproses..." : "📷 Ambil Foto"}
            </Btn>
          </>
        )}
      </div>
      {errorFoto && <div style={{ fontSize: 11, color: theme.danger, fontWeight: 600, marginTop: 4 }}>⚠️ Foto wajib diambil.</div>}
    </div>
  );
};

// ── Satu item temuan ──────────────────────────────────────────────────────────
const TemuanItem = ({ idx, item, onChange, onRemove, showRemove }) => {
  const set = (k) => (v) => onChange(idx, k, v);
  const handleFile = (fd) => onChange(idx, "foto", fd);
  const handleRemoveFoto = async () => {
    if (item.foto?.path) await supabase.storage.from("foto-inspeksi").remove([item.foto.path]);
    onChange(idx, "foto", null);
  };
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

      <div style={{ fontSize: 13, fontWeight: 600, color: theme.textSub, marginBottom: 6 }}>Foto Dokumentasi</div>
      <CameraCapture
        onFile={handleFile}
        fotoUrl={item.foto?.url || null}
        onRemove={handleRemoveFoto}
        errorFoto={item.errorFoto || false}
      />
    </div>
  );
};

// ── P1FormScreen ──────────────────────────────────────────────────────────────
const P1FormScreen = ({ onBack, onNav }) => {
  const [step,        setStep]        = useState(1); // 1=Kendaraan, 2=Temuan
  const [currentUser, setCurrentUser] = useState(null);
  const [submitting,  setSubmitting]  = useState(false);

  // Data kendaraan — SEMUA dari database, tidak ada input manual lagi
  const [nopol,         setNopol]         = useState("");
  const [kendaraanData, setKendaraanData] = useState(null); // hasil lookup lengkap
  const [lookupStatus,  setLookupStatus]  = useState("idle"); // idle|loading|found|notfound
  const lookupTimer = useRef(null);

  // Temuan (dinamis)
  const [temuan, setTemuan] = useState([
    { judul: "", keterangan: "", foto: null, errorJudul: false, errorKet: false, errorFoto: false }
  ]);

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
    setTemuan(prev => [...prev, { judul: "", keterangan: "", foto: null, errorJudul: false, errorKet: false, errorFoto: false }]);

  const removeTemuan = async (idx) => {
    if (temuan[idx].foto?.path) await supabase.storage.from("foto-inspeksi").remove([temuan[idx].foto.path]);
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

  const handleSubmit = async () => {
    if (!validateTemuan()) return;
    setSubmitting(true);
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

      // Insert setiap temuan + foto
      for (const t of temuan) {
        const { data: tv, error: tvErr } = await supabase.from("inspeksi_p1_temuan").insert([{
          inspeksi_p1_id: insp.id,
          judul: t.judul,
          keterangan: t.keterangan,
        }]).select().single();
        if (tvErr) throw tvErr;
        if (t.foto?.url) {
          await supabase.from("foto_inspeksi_p1").insert([{
            temuan_id: tv.id,
            url: t.foto.url,
          }]);
        }
      }

      alert("✓ Laporan cek random berhasil dikirim!");
      onNav("dashboard");
    } catch (err) {
      alert("Gagal menyimpan: " + err.message);
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
    </div>
  );
};

export default P1FormScreen;