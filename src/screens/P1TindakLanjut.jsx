import { useState, useEffect } from "react";
import Btn from "../components/Btn";
import Card from "../components/Card";
import Icon from "../components/Icon";
import SectionLabel from "../components/SectionLabel";
import theme from "../styles/theme";
import { supabase } from "../lib/supabase";

const P1TindakLanjut = ({ onBack, onNav }) => {
  const [inspeksiList, setInspeksiList] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [selected,     setSelected]     = useState(null); // inspeksi yang sedang ditindaklanjuti
  const [temuan,       setTemuan]       = useState([]);
  const [tindakLanjut, setTindakLanjut] = useState({}); // { [temuan_id]: { catatan, selesai } }
  const [saving,       setSaving]       = useState(false);

  useEffect(() => {
    loadData();
  }, []);

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

    // Hanya tampilkan yang punya temuan
    const filtered = (data || []).filter(i => i.inspeksi_p1_temuan?.length > 0);
    setInspeksiList(filtered);
    setLoading(false);
  };

  const openTindakLanjut = (insp) => {
    setSelected(insp);
    setTemuan(insp.inspeksi_p1_temuan || []);
    // Init state tindak lanjut
    const init = {};
    (insp.inspeksi_p1_temuan || []).forEach(t => {
      init[t.id] = { catatan: "", selesai: false };
    });
    setTindakLanjut(init);
  };

  const setTL = (id, key, val) => setTindakLanjut(p => ({ ...p, [id]: { ...p[id], [key]: val } }));

  const handleSave = async () => {
    const atleastOne = Object.values(tindakLanjut).some(t => t.catatan.trim());
    if (!atleastOne) { alert("Isi minimal satu catatan tindak lanjut!"); return; }

    setSaving(true);
    try {
      for (const [temuanId, tl] of Object.entries(tindakLanjut)) {
        if (!tl.catatan.trim()) continue;
        await supabase.from("tindaklanjut_p1").insert([{
          inspeksi_id: selected.id,
          temuan_id: temuanId,
          catatan: tl.catatan,
          status: tl.selesai ? "selesai" : "dikerjakan",
        }]);
        if (tl.selesai) {
          await supabase.from("inspeksi_p1_temuan").update({ status: "selesai" }).eq("id", temuanId);
        }
      }

      // Cek apakah semua temuan selesai → update status inspeksi
      const { data: allTemuan } = await supabase
        .from("inspeksi_p1_temuan").select("status").eq("inspeksi_id", selected.id);
      const semuaSelesai = allTemuan?.every(t => t.status === "selesai");
      if (semuaSelesai) {
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

  // ── Tampilan detail tindak lanjut ─────────────────────────────────────────
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
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "20px 16px", paddingBottom: 90 }}>
          <SectionLabel>Temuan yang Perlu Ditindaklanjuti</SectionLabel>
          <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 16 }}>
            Isi catatan tindak lanjut untuk setiap temuan. Centang "Selesai" jika sudah ditangani.
          </div>

          {temuan.map((t) => (
            <Card key={t.id} style={{ marginBottom: 16, padding: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: theme.text, marginBottom: 4 }}>
                📌 {t.judul}
              </div>
              <div style={{ fontSize: 13, color: theme.textMuted, marginBottom: 12 }}>
                {t.keterangan}
              </div>
              <textarea
                placeholder="Tuliskan tindak lanjut yang dilakukan..."
                value={tindakLanjut[t.id]?.catatan || ""}
                onChange={(e) => setTL(t.id, "catatan", e.target.value)}
                style={{
                  width: "100%", padding: "10px 12px", borderRadius: 10,
                  border: `1.5px solid ${theme.border}`, background: theme.surfaceAlt,
                  color: theme.text, fontSize: 13, fontFamily: "'DM Sans',sans-serif",
                  resize: "none", minHeight: 80, boxSizing: "border-box", outline: "none",
                  marginBottom: 10,
                }}
              />
              <div
                onClick={() => setTL(t.id, "selesai", !tindakLanjut[t.id]?.selesai)}
                style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}
              >
                <div style={{
                  width: 20, height: 20, borderRadius: 6, border: `2px solid ${theme.primary}`,
                  background: tindakLanjut[t.id]?.selesai ? theme.primary : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {tindakLanjut[t.id]?.selesai && <Icon name="check" size={12} color="#fff" />}
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: theme.primary }}>
                  Tandai selesai
                </span>
              </div>
            </Card>
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

  // ── Tampilan daftar inspeksi pending ─────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: theme.bg, paddingBottom: 80 }}>
      <div style={{ background: theme.surface, padding: "48px 16px 16px", borderBottom: `1px solid ${theme.border}`, boxShadow: theme.shadow }}>
        <div onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14, cursor: "pointer", color: theme.textSub, fontSize: 13 }}>
          <Icon name="arrow" size={16} color={theme.textSub} /> Kembali
        </div>
        <div style={{ fontWeight: 800, fontSize: 18, color: theme.text }}>Tindak Lanjut</div>
        <div style={{ fontSize: 13, color: theme.textMuted, marginTop: 2 }}>Kendaraan dengan temuan yang belum selesai</div>
      </div>

      <div style={{ padding: "20px 16px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: theme.textMuted }}>Memuat data...</div>
        ) : inspeksiList.length === 0 ? (
          <Card style={{ padding: 40, textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>✅</div>
            <div style={{ fontWeight: 700, fontSize: 15, color: theme.text }}>Semua beres!</div>
            <div style={{ fontSize: 13, color: theme.textMuted, marginTop: 4 }}>Tidak ada temuan yang perlu ditindaklanjuti.</div>
          </Card>
        ) : (
          inspeksiList.map((insp) => (
            <Card key={insp.id} style={{ marginBottom: 12, padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: theme.dangerLight, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon name="car" size={20} color={theme.danger} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: theme.text }}>{insp.nomor_polisi}</div>
                  <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>
                    {insp.transportir} · {insp.kategori_mt === "merah_putih" ? "MT Merah Putih" : "MT Industri"}
                  </div>
                  <div style={{ fontSize: 11, color: theme.danger, fontWeight: 600, marginTop: 4 }}>
                    {insp.inspeksi_p1_temuan?.length || 0} temuan
                  </div>
                </div>
                <Btn onClick={() => openTindakLanjut(insp)} variant="primary" style={{ padding: "8px 14px", fontSize: 12 }}>
                  Tindak Lanjut
                </Btn>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default P1TindakLanjut;