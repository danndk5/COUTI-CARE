import { useState, useEffect } from "react";
import BottomNav from "../components/BottomNav";
import Card from "../components/Card";
import Icon from "../components/Icon";
import theme from "../styles/theme";
import { supabase } from "../lib/supabase";

// ── List kendaraan (sub-view dari stat card) ──────────────────────────────────
const KendaraanList = ({ title, items, onBack }) => (
  <div style={{ minHeight: "100vh", background: theme.bg }}>
    <div style={{ background: theme.surface, padding: "48px 16px 16px", borderBottom: `1px solid ${theme.border}`, boxShadow: theme.shadow }}>
      <div onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14, cursor: "pointer", color: theme.textSub, fontSize: 13 }}>
        <Icon name="arrow" size={16} color={theme.textSub} /> Kembali
      </div>
      <div style={{ fontWeight: 800, fontSize: 18, color: theme.text }}>{title}</div>
      <div style={{ fontSize: 13, color: theme.textMuted, marginTop: 2 }}>{items.length} kendaraan</div>
    </div>
    <div style={{ padding: "20px 16px 40px" }}>
      {items.length === 0 ? (
        <Card style={{ padding: 40, textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
          <div style={{ fontSize: 14, color: theme.textMuted }}>Belum ada data</div>
        </Card>
      ) : items.map((i) => (
        <Card key={i.id} style={{ marginBottom: 12, padding: "14px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "#EDE9FE", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Icon name="car" size={20} color="#7C3AED" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: theme.text }}>{i.nomor_polisi}</div>
              <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>{i.transportir}</div>
              <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 1 }}>
                {i.kapasitas_mt} · {i.jumlah_kompartemen} kompartemen · {i.kategori_mt === "merah_putih" ? "MT Merah Putih" : "MT Industri"}
              </div>
              <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 1 }}>
                {new Date(i.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
              </div>
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20,
              background: i.status === "selesai" ? theme.successLight : theme.dangerLight,
              color: i.status === "selesai" ? theme.success : theme.danger }}>
              {i.status === "selesai" ? "Selesai" : "Perlu Tindak Lanjut"}
            </div>
          </div>
        </Card>
      ))}
    </div>
  </div>
);

// ── P1Dashboard ───────────────────────────────────────────────────────────────
const P1Dashboard = ({ role, onNav, onLogout }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [inspeksiAll, setInspeksiAll] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [view,        setView]        = useState("dashboard"); // "dashboard"|"all"|"perlu"|"selesai"

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data: profile } = await supabase.from("profiles").select("nama").eq("id", user.id).single();
      setCurrentUser(profile);
      const { data } = await supabase
        .from("inspeksi_p1")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      setInspeksiAll(data || []);
      setLoading(false);
    };
    load();
  }, []);

  const perluTindak  = inspeksiAll.filter(i => i.status !== "selesai");
  const sudahTindak  = inspeksiAll.filter(i => i.status === "selesai");

  if (view === "all")    return <KendaraanList title="Total Diperiksa"        items={inspeksiAll}  onBack={() => setView("dashboard")} />;
  if (view === "perlu")  return <KendaraanList title="Perlu Ditindaklanjuti"  items={perluTindak}  onBack={() => setView("dashboard")} />;
  if (view === "selesai")return <KendaraanList title="Sudah Ditindaklanjuti"  items={sudahTindak}  onBack={() => setView("dashboard")} />;

  const MENU = [
    { label: "Pengecekan",    icon: "plus",    screen: "form",          color: "#7C3AED", bg: "#EDE9FE", desc: "Buat laporan cek random baru" },
    { label: "Tindak Lanjut", icon: "wrench",  screen: "tindak-lanjut", color: "#D97706", bg: "#FEF3C7", desc: "Tangani temuan yang belum selesai" },
    { label: "Riwayat",       icon: "history", screen: "history",        color: theme.success, bg: theme.successLight, desc: "Lihat riwayat pengecekan" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: theme.bg, paddingBottom: 80, display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ background: theme.surface, padding: "48px 20px 20px", borderBottom: `1px solid ${theme.border}`, boxShadow: theme.shadow }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 13, color: theme.textMuted }}>Selamat datang,</div>
            <div style={{ fontSize: 19, fontWeight: 800, color: theme.text }}>{currentUser?.nama || "P1"}</div>
            <div style={{ display: "inline-block", marginTop: 4, fontSize: 11, fontWeight: 600, padding: "2px 10px", borderRadius: 20, background: "#EDE9FE", color: "#7C3AED" }}>
              P1 · Cek Random
            </div>
          </div>
          <div onClick={onLogout} style={{ cursor: "pointer", padding: 10, borderRadius: 12, background: theme.surfaceAlt }}>
            <Icon name="logout" size={18} color={theme.textSub} />
          </div>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 24px", gap: 14 }}>
        {/* 3 Tombol Utama — vertikal di tengah sesuai spesifikasi */}
        <div style={{ fontSize: 14, fontWeight: 800, color: theme.text, marginBottom: 4, textAlign: "center" }}>Pilih Kegiatan</div>

        {MENU.map((item) => (
          <div key={item.screen} onClick={() => onNav(item.screen)} style={{
            width: "100%", maxWidth: 340, padding: "18px 20px", borderRadius: 16,
            background: item.bg, border: `1.5px solid ${item.color}30`,
            display: "flex", alignItems: "center", gap: 16,
            cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
          }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: item.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Icon name={item.icon} size={22} color="#fff" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 16, color: item.color }}>{item.label}</div>
              <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>{item.desc}</div>
            </div>
          </div>
        ))}

        {/* Statistik — klik untuk lihat list */}
        {!loading && (
          <div style={{ display: "flex", gap: 10, marginTop: 8, width: "100%", maxWidth: 340 }}>
            {[
              { val: inspeksiAll.length, label: "Total",        view: "all",    color: "#7C3AED", bg: "#EDE9FE" },
              { val: perluTindak.length, label: "Perlu Tindak", view: "perlu",  color: theme.danger, bg: theme.dangerLight },
              { val: sudahTindak.length, label: "Selesai",      view: "selesai",color: theme.success, bg: theme.successLight },
            ].map((s) => (
              <div key={s.view} onClick={() => setView(s.view)} style={{
                flex: 1, textAlign: "center", padding: "12px 8px",
                background: s.bg, borderRadius: 12, cursor: "pointer",
                border: `1px solid ${s.color}30`,
              }}>
                <div style={{ fontWeight: 800, fontSize: 22, color: s.color }}>{s.val}</div>
                <div style={{ fontSize: 10, color: s.color, marginTop: 2, lineHeight: 1.3, fontWeight: 600, opacity: 0.8 }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <BottomNav active="dashboard" onNav={onNav} role={role} />
    </div>
  );
};

export default P1Dashboard;