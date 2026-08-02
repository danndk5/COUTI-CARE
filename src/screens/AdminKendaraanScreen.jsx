import { useState, useEffect } from "react";
import BottomNav from "../components/BottomNav";
import Btn from "../components/Btn";
import Card from "../components/Card";
import Icon from "../components/Icon";
import Input from "../components/Input";
import SectionLabel from "../components/SectionLabel";
import theme from "../styles/theme";
import { supabase } from "../lib/supabase";

const KATEGORI_OPTIONS = [
  { value: "merah_putih", label: "MT Merah Putih" },
  { value: "industri",    label: "MT Industri" },
];

const emptyForm = {
  nomor_polisi: "",
  transportir: "",
  kapasitas_mt: "",
  jumlah_kompartemen: "",
  kategori_mt: "",
  masa_berlaku_head_truck: "",
  masa_berlaku_tangki: "",
};

// ── Helper cek masa berlaku ───────────────────────────────────────────────────
const cekMasaBerlaku = (dateStr) => {
  if (!dateStr) return null;
  const hari = Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24));
  if (hari < 0) return "expired";
  if (hari <= 30) return "warning";
  return "ok";
};

const formatTanggal = (dateStr) => {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
};

// ── FormModal — tambah / edit kendaraan ───────────────────────────────────────
const FormModal = ({ initial, onClose, onSaved }) => {
  const [form, setForm] = useState(initial || emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const isEdit = !!initial;

  const setF = (k) => (v) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.nomor_polisi.trim()) { setError("Nomor Polisi wajib diisi."); return; }
    if (!form.transportir.trim()) { setError("Transportir wajib diisi."); return; }
    if (!form.kapasitas_mt.trim()) { setError("Kapasitas MT wajib diisi."); return; }
    if (!form.jumlah_kompartemen) { setError("Jumlah Kompartemen wajib diisi."); return; }
    if (!form.kategori_mt) { setError("Kategori MT wajib dipilih."); return; }

    setSaving(true);
    setError("");
    try {
      const payload = {
        nomor_polisi: form.nomor_polisi.trim().toUpperCase(),
        transportir: form.transportir.trim(),
        kapasitas_mt: form.kapasitas_mt.trim(),
        jumlah_kompartemen: parseInt(form.jumlah_kompartemen),
        kategori_mt: form.kategori_mt,
        masa_berlaku_head_truck: form.masa_berlaku_head_truck || null,
        masa_berlaku_tangki: form.masa_berlaku_tangki || null,
        updated_at: new Date().toISOString(),
      };

      const { error: err } = await supabase
        .from("kendaraan")
        .upsert(payload, { onConflict: "nomor_polisi" });

      if (err) throw err;

      onSaved();
      onClose();
    } catch (err) {
      setError("Gagal menyimpan: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 2000,
      display: "flex", alignItems: "flex-end", justifyContent: "center",
    }}>
      <div style={{
        background: theme.surface, borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 430,
        maxHeight: "88vh", overflowY: "auto", padding: 20,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontWeight: 800, fontSize: 17, color: theme.text }}>
            {isEdit ? "Edit Kendaraan" : "Tambah Kendaraan"}
          </div>
          <div onClick={onClose} style={{ cursor: "pointer", fontSize: 20, color: theme.textMuted }}>✕</div>
        </div>

        <Input
          label="Nomor Polisi"
          placeholder="Contoh: B 1234 XY"
          value={form.nomor_polisi}
          onChange={isEdit ? undefined : setF("nomor_polisi")}
          disabled={isEdit}
        />
        {isEdit && (
          <div style={{ fontSize: 11, color: theme.textMuted, marginTop: -8, marginBottom: 12 }}>
            Nomor Polisi tidak bisa diubah (kunci utama data).
          </div>
        )}

        <Input label="Transportir" placeholder="PT. ..." value={form.transportir} onChange={setF("transportir")} />
        <Input label="Kapasitas MT" placeholder="Contoh: 10 KL" value={form.kapasitas_mt} onChange={setF("kapasitas_mt")} />
        <Input label="Jumlah Kompartemen" placeholder="1 / 2 / 3" value={form.jumlah_kompartemen} onChange={setF("jumlah_kompartemen")} />

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: theme.text, marginBottom: 6 }}>Kategori MT</div>
          <div style={{ display: "flex", gap: 8 }}>
            {KATEGORI_OPTIONS.map((opt) => (
              <div
                key={opt.value}
                onClick={() => setF("kategori_mt")(opt.value)}
                style={{
                  flex: 1, textAlign: "center", padding: "9px 0", borderRadius: 10,
                  fontSize: 12, fontWeight: 600, cursor: "pointer",
                  background: form.kategori_mt === opt.value ? theme.primary : theme.surfaceAlt,
                  color: form.kategori_mt === opt.value ? "#fff" : theme.textMuted,
                  border: `1.5px solid ${form.kategori_mt === opt.value ? theme.primary : theme.border}`,
                }}
              >
                {opt.label}
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: theme.text, marginBottom: 6 }}>Masa Berlaku Head Truck</div>
          <input
            type="date"
            value={form.masa_berlaku_head_truck || ""}
            onChange={(e) => setF("masa_berlaku_head_truck")(e.target.value)}
            style={{
              width: "100%", padding: "10px 12px", borderRadius: 10,
              border: `1.5px solid ${theme.border}`, fontSize: 13,
              fontFamily: "'DM Sans', sans-serif", boxSizing: "border-box", outline: "none",
            }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: theme.text, marginBottom: 6 }}>Masa Berlaku Tangki</div>
          <input
            type="date"
            value={form.masa_berlaku_tangki || ""}
            onChange={(e) => setF("masa_berlaku_tangki")(e.target.value)}
            style={{
              width: "100%", padding: "10px 12px", borderRadius: 10,
              border: `1.5px solid ${theme.border}`, fontSize: 13,
              fontFamily: "'DM Sans', sans-serif", boxSizing: "border-box", outline: "none",
            }}
          />
        </div>

        {error && (
          <div style={{ fontSize: 12, color: theme.danger, fontWeight: 600, marginBottom: 12, padding: "8px 12px", background: theme.dangerLight, borderRadius: 8 }}>
            ⚠️ {error}
          </div>
        )}

        <Btn onClick={handleSave} variant="primary" disabled={saving}>
          {saving ? "Menyimpan..." : "Simpan"}
        </Btn>
      </div>
    </div>
  );
};

// ── AdminKendaraanScreen ───────────────────────────────────────────────────────
const AdminKendaraanScreen = ({ role, onNav, onBack }) => {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const loadData = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("kendaraan")
      .select("*")
      .order("nomor_polisi", { ascending: true });
    if (error) console.error("Error load kendaraan:", error);
    setList(data || []);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const handleDelete = async (nomor_polisi) => {
    if (!window.confirm(`Hapus data kendaraan ${nomor_polisi}? Tindakan ini tidak bisa dibatalkan.`)) return;
    const { error } = await supabase.from("kendaraan").delete().eq("nomor_polisi", nomor_polisi);
    if (error) { alert("Gagal menghapus: " + error.message); return; }
    loadData();
  };

  const handleExport = () => {
    const headers = ["Nomor Polisi", "Transportir", "Kapasitas MT", "Jumlah Kompartemen", "Kategori MT", "Masa Berlaku Head Truck", "Masa Berlaku Tangki"];
    const rows = filteredList.map((k) => [
      k.nomor_polisi,
      k.transportir || "",
      k.kapasitas_mt || "",
      k.jumlah_kompartemen || "",
      k.kategori_mt === "merah_putih" ? "MT Merah Putih" : k.kategori_mt === "industri" ? "MT Industri" : (k.kategori_mt || ""),
      k.masa_berlaku_head_truck || "",
      k.masa_berlaku_tangki || "",
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `data-kendaraan-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const filteredList = list.filter((k) =>
    !search.trim() ||
    k.nomor_polisi?.toLowerCase().includes(search.toLowerCase()) ||
    k.transportir?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ minHeight: "100vh", background: theme.bg, paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ background: theme.surface, padding: "48px 16px 16px", borderBottom: `1px solid ${theme.border}`, boxShadow: theme.shadow }}>
        <div onClick={() => (onBack ? onBack() : onNav("dashboard"))} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14, cursor: "pointer", color: theme.textSub, fontSize: 13 }}>
          <Icon name="arrow" size={16} color={theme.textSub} /> Kembali
        </div>
        <div style={{ fontWeight: 800, fontSize: 18, color: theme.text }}>Data Kendaraan</div>
        <div style={{ fontSize: 13, color: theme.textMuted, marginTop: 2 }}>{list.length} kendaraan terdaftar</div>

        <div style={{ marginTop: 14 }}>
          <input
            placeholder="Cari nomor polisi / transportir..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%", padding: "9px 12px", borderRadius: 10,
              border: `1.5px solid ${theme.border}`, fontSize: 13,
              fontFamily: "'DM Sans', sans-serif", boxSizing: "border-box", outline: "none",
            }}
          />
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <Btn onClick={() => { setEditing(null); setShowForm(true); }} variant="primary" icon="plus" style={{ flex: 1, fontSize: 13 }}>
            Tambah Kendaraan
          </Btn>
          <Btn onClick={handleExport} variant="outline" style={{ flex: 1, fontSize: 13 }}>
            📤 Export CSV
          </Btn>
        </div>
      </div>

      {/* List */}
      <div style={{ padding: "16px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: theme.textMuted }}>Memuat data...</div>
        ) : filteredList.length === 0 ? (
          <Card style={{ padding: 32, textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🚛</div>
            <div style={{ fontSize: 14, color: theme.textMuted }}>
              {search ? "Tidak ada kendaraan sesuai pencarian" : "Belum ada data kendaraan"}
            </div>
          </Card>
        ) : (
          filteredList.map((k) => {
            const statusHT = cekMasaBerlaku(k.masa_berlaku_head_truck);
            const statusTK = cekMasaBerlaku(k.masa_berlaku_tangki);
            const adaWarning = statusHT === "expired" || statusHT === "warning" || statusTK === "expired" || statusTK === "warning";

            return (
              <Card key={k.id} style={{ marginBottom: 12, padding: "14px 16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: theme.text }}>{k.nomor_polisi}</div>
                    <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>{k.transportir}</div>
                  </div>
                  {adaWarning && (
                    <div style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20, background: theme.dangerLight, color: theme.danger }}>
                      ⚠️ Perlu Perhatian
                    </div>
                  )}
                </div>

                <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 4 }}>
                  {k.kapasitas_mt} · {k.jumlah_kompartemen} kompartemen · {k.kategori_mt === "merah_putih" ? "MT Merah Putih" : k.kategori_mt === "industri" ? "MT Industri" : "-"}
                </div>

                <div style={{ display: "flex", gap: 12, fontSize: 11, marginBottom: 12 }}>
                  <div style={{ color: statusHT === "expired" ? theme.danger : statusHT === "warning" ? "#F59E0B" : theme.textMuted }}>
                    🚛 Head Truck: {formatTanggal(k.masa_berlaku_head_truck)}
                    {statusHT === "expired" && " (Kadaluarsa)"}
                    {statusHT === "warning" && " (Segera habis)"}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 12, fontSize: 11, marginBottom: 12 }}>
                  <div style={{ color: statusTK === "expired" ? theme.danger : statusTK === "warning" ? "#F59E0B" : theme.textMuted }}>
                    🛢️ Tangki: {formatTanggal(k.masa_berlaku_tangki)}
                    {statusTK === "expired" && " (Kadaluarsa)"}
                    {statusTK === "warning" && " (Segera habis)"}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, borderTop: `1px solid ${theme.border}`, paddingTop: 10 }}>
                  <Btn onClick={() => { setEditing(k); setShowForm(true); }} variant="ghost" style={{ flex: 1, fontSize: 12, padding: "8px" }}>
                    ✏️ Edit
                  </Btn>
                  <Btn onClick={() => handleDelete(k.nomor_polisi)} variant="ghost" style={{ flex: 1, fontSize: 12, padding: "8px", color: theme.danger }}>
                    🗑️ Hapus
                  </Btn>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {showForm && (
        <FormModal
          initial={editing}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={loadData}
        />
      )}
    </div>
  );
};

export default AdminKendaraanScreen;