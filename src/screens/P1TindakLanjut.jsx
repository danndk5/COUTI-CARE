import { useState, useEffect, useRef } from "react";
import Btn from "../components/Btn";
import Card from "../components/Card";
import Icon from "../components/Icon";
import Input from "../components/Input";
import SectionLabel from "../components/SectionLabel";
import theme from "../styles/theme";
import { supabase } from "../lib/supabase";

// ── CameraCapture (sama seperti P1FormScreen) ─────────────────────────────────
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

const CameraCapture = ({ onFile, fotoUrl, onRemove }) => {
  const [capState, setCapState] = useState("idle");
  const [permErr,  setPermErr]  = useState(null);
  const fileRef = useRef(null);

  const checkPerms = async () => {
    try { const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }); s.getTracks().forEach(t => t.stop()); } catch { throw new Error("camera"); }
    await new Promise((r, j) => navigator.geolocation.getCurrentPosition(r, j, { enableHighAccuracy: true, timeout: 10000 }));
  };

  const handleClick = async () => {
    setPermErr(null); setCapState("checking");
    try { await checkPerms(); setCapState("idle"); fileRef.current?.click(); }
    catch (e) { setCapState("idle"); setPermErr(e.message === "camera" ? "Izin kamera diperlukan." : "Izin lokasi diperlukan."); }
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
    ctx.fillStyle = "#ffffff"; ctx.fillText(ts, pad * 2, canvas.height - bh - pad + pad + fs); ctx.fillText(ds, pad * 2, canvas.height - bh - pad + pad + fs + lh);
    return new Promise(r => canvas.toBlob(r, "image/jpeg", 0.92));
  };

  const handleChange = async (e) => {
    const files = Array.from(e.target.files || []); if (!files.length) return;
    setCapState("processing");
    try {
      const blob = await applyOverlay(files[0]);
      const name = `p1-tl-${Date.now()}.jpg`;
      const { data, error } = await supabase.storage.from("foto-inspeksi").upload(name, blob, { contentType: "image/jpeg" });
      if (error) { alert("⚠️ Upload gagal: " + error.message); return; }
      const { data: pub } = supabase.storage.from("foto-inspeksi").getPublicUrl(data.path);
      onFile({ url: pub.publicUrl, path: data.path });
    } catch (err) { alert("⚠️ Gagal: " + err.message); }
    finally { setCapState("idle"); e.target.value = ""; }
  };

  const isWorking = capState !== "idle";
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ border: `2px dashed ${theme.border}`, borderRadius: 10, padding: "12px", textAlign: "center" }}>
        {fotoUrl ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: theme.primaryLight, borderRadius: 8, fontSize: 12, color: theme.primary }}>
            <span>✓ Foto tindak lanjut tersimpan</span>
            <div onClick={onRemove} style={{ cursor: "pointer", fontWeight: 700, color: theme.danger }}>✕</div>
          </div>
        ) : (
          <>
            {permErr && <div style={{ fontSize: 11, color: theme.danger, fontWeight: 600, marginBottom: 6 }}>⛔ {permErr}</div>}
            <div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 8 }}>📷 Foto dokumentasi tindak lanjut</div>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleChange} style={{ display: "none" }} />
            <Btn onClick={handleClick} variant="outline" style={{ padding: "7px 16px", fontSize: 12 }} disabled={isWorking}>
              {capState === "checking" ? "🔐 Cek izin..." : capState === "processing" ? "⏳ Memproses..." : "📷 Ambil Foto"}
            </Btn>
          </>
        )}
      </div>
    </div>
  );
};

// ── Form Tindak Lanjut per temuan ─────────────────────────────────────────────
const TindakLanjutItem = ({ idx, temuan, tl, onChange }) => {
  const set = (k) => (v) => onChange(temuan.id, k, v);
  const handleFile = (fd) => onChange(temuan.id, "foto", fd);
  const handleRemoveFoto = async () => {
    if (tl.foto?.path) await supabase.storage.from("foto-inspeksi").remove([tl.foto.path]);
    onChange(temuan.id, "foto", null);
  };

  return (
    <div style={{ background: theme.surface, border: `1.5px solid ${theme.border}`, borderRadius: 14, padding: 16, marginBottom: 14 }}>
      {/* Temuan asli */}
      <div style={{ marginBottom: 12, padding: "10px 12px", background: theme.dangerLight, borderRadius: 10 }}>
        <div style={{ fontSize: 11, color: theme.danger, fontWeight: 700, marginBottom: 2 }}>📌 TEMUAN #{idx + 1}</div>
        <div style={{ fontWeight: 700, fontSize: 14, color: theme.text }}>{temuan.judul}</div>
        <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 4 }}>{temuan.keterangan}</div>
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

      <div style={{ fontSize: 13, fontWeight: 600, color: theme.textSub, marginBottom: 6 }}>Foto Dokumentasi Tindak Lanjut</div>
      <CameraCapture onFile={handleFile} fotoUrl={tl.foto?.url || null} onRemove={handleRemoveFoto} />

      {/* Tandai selesai */}
      <div onClick={() => set("selesai")(!tl.selesai)} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", marginTop: 6, padding: "10px 12px", borderRadius: 10, background: tl.selesai ? theme.successLight : theme.surfaceAlt, border: `1.5px solid ${tl.selesai ? theme.success : theme.border}` }}>
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

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data } = await supabase
      .from("inspeksi_p1")
      .select("*, inspeksi_p1_temuan(*)")
      .eq("user_id", user.id)
      .neq("status", "selesai")
      .order("created_at", { ascending: false });
    setInspeksiList((data || []).filter(i => i.inspeksi_p1_temuan?.length > 0));
    setLoading(false);
  };

  const openDetail = (insp) => {
    setSelected(insp);
    const list = insp.inspeksi_p1_temuan || [];
    setTemuanList(list);
    const init = {};
    list.forEach(t => { init[t.id] = { catatan: "", foto: null, selesai: false, errorCatatan: false }; });
    setTL(init);
  };

  const updateTL = (temuanId, key, val) =>
    setTL(prev => ({ ...prev, [temuanId]: { ...prev[temuanId], [key]: val } }));

  const handleSave = async () => {
    // Validasi — minimal satu catatan
    let valid = true;
    const updated = { ...tl };
    Object.entries(tl).forEach(([id, t]) => {
      if (!t.catatan.trim()) { updated[id] = { ...t, errorCatatan: true }; valid = false; }
    });
    if (!valid) { setTL(updated); alert("Isi tindakan untuk setiap temuan!"); return; }

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

      alert("✓ Tindak lanjut berhasil disimpan!");
      setSelected(null);
      loadData();
    } catch (err) {
      alert("Gagal menyimpan: " + err.message);
    } finally {
      setSaving(false);
    }
  };

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
            Isi tindakan untuk setiap temuan. Centang <b>selesai</b> jika sudah tuntas ditangani.
          </div>
          {temuanList.map((t, i) => (
            <TindakLanjutItem key={t.id} idx={i} temuan={t} tl={tl[t.id] || {}} onChange={updateTL} />
          ))}
        </div>

        <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, padding: "12px 16px", background: theme.surface, borderTop: `1px solid ${theme.border}` }}>
          <Btn onClick={handleSave} variant="primary" icon="check" disabled={saving}>
            {saving ? "Menyimpan..." : "Simpan Tindak Lanjut"}
          </Btn>
        </div>
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