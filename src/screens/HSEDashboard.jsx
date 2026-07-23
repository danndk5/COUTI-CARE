import { useState, useEffect } from "react";
import BottomNav from "../components/BottomNav";
import Card from "../components/Card";
import Icon from "../components/Icon";
import SectionLabel from "../components/SectionLabel";
import theme from "../styles/theme";
import { supabase } from "../lib/supabase";

// ── StatCard ─────────────────────────────────────────────────────────────────
const StatCard = ({ value, label, bg, color, onClick }) => (
  <div
    onClick={onClick}
    style={{
      background: bg, borderRadius: 14, padding: "18px 10px",
      textAlign: "center", cursor: "pointer", flex: 1,
      boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
    }}
  >
    <div style={{ fontSize: 28, fontWeight: 800, color }}>{value}</div>
    <div style={{ fontSize: 10, color, fontWeight: 600, marginTop: 4, opacity: 0.85, lineHeight: 1.3 }}>
      {label}
    </div>
  </div>
);

// ── InspeksiList ──────────────────────────────────────────────────────────────
const InspeksiList = ({ title, items, onBack }) => (
  <div style={{ minHeight: "100vh", background: theme.bg }}>
    <div style={{ background: theme.surface, padding: "48px 16px 16px", borderBottom: `1px solid ${theme.border}`, boxShadow: theme.shadow }}>
      <div onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14, cursor: "pointer", color: theme.textSub, fontSize: 13 }}>
        <Icon name="arrow" size={16} color={theme.textSub} /> Kembali
      </div>
      <div style={{ fontWeight: 800, fontSize: 18, color: theme.text }}>{title}</div>
      <div style={{ fontSize: 13, color: theme.textMuted, marginTop: 2 }}>{items.length} kendaraan</div>
    </div>
    <div style={{ padding: "20px 16px", paddingBottom: 40 }}>
      {items.length === 0 ? (
        <Card style={{ padding: 32, textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
          <div style={{ fontSize: 14, color: theme.textMuted }}>Belum ada data</div>
        </Card>
      ) : (
        items.map((insp) => (
          <Card key={insp.id} style={{ marginBottom: 12, padding: "14px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12, background: theme.primaryLight,
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <Icon name="car" size={20} color={theme.primary} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: theme.text }}>{insp.nomor_polisi}</div>
                <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>{insp.transportir}</div>
                <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 1 }}>
                  {insp.kapasitas_mt} · {insp.jumlah_kompartemen} kompartemen · {insp.kategori_mt === "merah_putih" ? "MT Merah Putih" : "MT Industri"}
                </div>
                <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 1 }}>
                  {new Date(insp.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                </div>
              </div>
              <div style={{
                fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20,
                background: insp.status === "selesai" ? theme.successLight : theme.dangerLight,
                color: insp.status === "selesai" ? theme.success : theme.danger,
              }}>
                {insp.status === "selesai" ? "Selesai" : "Perlu Tindak Lanjut"}
              </div>
            </div>
          </Card>
        ))
      )}
    </div>
  </div>
);

// ── HSEDashboard ──────────────────────────────────────────────────────────────
const HSEDashboard = ({ role, onNav, onLogout }) => {
  const [view,        setView]        = useState("dashboard");
  const [currentUser, setCurrentUser] = useState(null);
  const [inspeksiAll, setInspeksiAll] = useState([]);
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: profile } = await supabase
        .from("profiles").select("nama, perusahaan").eq("id", user.id).single();
      setCurrentUser(profile);

      const { data: inspeksiData } = await supabase
        .from("inspeksi_hse")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      setInspeksiAll(inspeksiData || []);
      setLoading(false);
    };
    loadData();
  }, []);

  const perluTindak  = inspeksiAll.filter((i) => i.status !== "selesai");
  const sudahTindak  = inspeksiAll.filter((i) => i.status === "selesai");

  if (view === "list-all")    return <InspeksiList title="Total Diperiksa"         items={inspeksiAll} onBack={() => setView("dashboard")} />;
  if (view === "list-perlu")  return <InspeksiList title="Perlu Ditindaklanjuti"   items={perluTindak} onBack={() => setView("dashboard")} />;
  if (view === "list-selesai") return <InspeksiList title="Sudah Ditindaklanjuti"  items={sudahTindak} onBack={() => setView("dashboard")} />;

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: theme.bg, display: "flex", justifyContent: "center", alignItems: "center" }}>
        <div style={{ color: theme.textMuted }}>Memuat data...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: theme.bg, paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ background: theme.surface, padding: "48px 20px 20px", borderBottom: `1px solid ${theme.border}`, boxShadow: theme.shadow }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 13, color: theme.textMuted }}>Selamat datang,</div>
            <div style={{ fontSize: 19, fontWeight: 800, color: theme.text }}>{currentUser?.nama || "HSE"}</div>
            <div style={{ display: "inline-block", marginTop: 4, fontSize: 11, fontWeight: 600, padding: "2px 10px", borderRadius: 20, background: "#FEF3C7", color: "#D97706" }}>
              HSE
            </div>
          </div>
          <div onClick={onLogout} style={{ cursor: "pointer", padding: 10, borderRadius: 12, background: theme.surfaceAlt }}>
            <Icon name="logout" size={18} color={theme.textSub} />
          </div>
        </div>
      </div>

      <div style={{ padding: "24px 16px" }}>
        <SectionLabel>Ringkasan Uji Kedap</SectionLabel>
        <div style={{ display: "flex", gap: 10, marginBottom: 28 }}>
          <StatCard value={inspeksiAll.length} label={"Total\nDiperiksa"}         bg={theme.primaryLight} color={theme.primary}  onClick={() => setView("list-all")} />
          <StatCard value={perluTindak.length}  label={"Perlu\nDitindaklanjuti"}  bg={theme.dangerLight}  color={theme.danger}   onClick={() => setView("list-perlu")} />
          <StatCard value={sudahTindak.length}  label={"Sudah\nDitindaklanjuti"}  bg={theme.successLight} color={theme.success}  onClick={() => setView("list-selesai")} />
        </div>

        <div style={{ padding: "14px 16px", borderRadius: 14, background: theme.surface, border: `1px solid ${theme.border}`, fontSize: 13, color: theme.textMuted, lineHeight: 1.6 }}>
          <div style={{ fontWeight: 700, color: theme.text, marginBottom: 4 }}>💡 Panduan</div>
          <div>• Klik angka untuk lihat daftar kendaraan</div>
          <div>• Gunakan <b>Pengecekan</b> untuk uji kedap baru</div>
          <div>• Gunakan <b>Tindak Lanjut</b> untuk tangani temuan</div>
        </div>
      </div>

      <BottomNav active="dashboard" onNav={onNav} role={role} />
    </div>
  );
};

export default HSEDashboard;