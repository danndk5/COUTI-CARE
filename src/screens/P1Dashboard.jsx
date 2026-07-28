import { useState, useEffect } from "react";
import BottomNav from "../components/BottomNav";
import Icon from "../components/Icon";
import theme from "../styles/theme";
import { supabase } from "../lib/supabase";

const P1Dashboard = ({ role, onNav, onLogout }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [stats, setStats]             = useState({ total: 0, perlu: 0, selesai: 0 });
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data: profile } = await supabase
        .from("profiles").select("nama").eq("id", user.id).single();
      setCurrentUser(profile);
      const { data } = await supabase
        .from("inspeksi_p1").select("id, status").eq("user_id", user.id);
      if (data) setStats({
        total:   data.length,
        perlu:   data.filter(i => i.status !== "selesai").length,
        selesai: data.filter(i => i.status === "selesai").length,
      });
      setLoading(false);
    };
    load();
  }, []);

  const MENU = [
    { label: "Pengecekan",    icon: "plus",    screen: "form",         color: theme.primary, bg: theme.primaryLight, desc: "Buat laporan cek random baru" },
    { label: "Tindak Lanjut", icon: "wrench",  screen: "tindak-lanjut",color: "#D97706",     bg: "#FEF3C7",          desc: "Tangani temuan yang belum selesai" },
    { label: "Riwayat",       icon: "history", screen: "history",       color: theme.success, bg: theme.successLight, desc: "Lihat riwayat pengecekan" },
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

      {/* 3 Tombol Utama — vertikal di tengah (sesuai spesifikasi) */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 24px", gap: 14 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: theme.text, marginBottom: 4, textAlign: "center" }}>
          Pilih Kegiatan
        </div>

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
            <div>
              <div style={{ fontWeight: 800, fontSize: 16, color: item.color }}>{item.label}</div>
              <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>{item.desc}</div>
            </div>
            <Icon name="arrow" size={16} color={item.color} style={{ marginLeft: "auto", opacity: 0.5 }} />
          </div>
        ))}

        {/* Mini statistik */}
        {!loading && (
          <div style={{ display: "flex", gap: 10, marginTop: 12, width: "100%", maxWidth: 340 }}>
            {[
              { val: stats.total,   label: "Total",       color: theme.primary },
              { val: stats.perlu,   label: "Perlu Tindak",color: theme.danger  },
              { val: stats.selesai, label: "Selesai",     color: theme.success },
            ].map((s) => (
              <div key={s.label} style={{ flex: 1, textAlign: "center", padding: "12px 8px", background: theme.surface, borderRadius: 12, border: `1px solid ${theme.border}` }}>
                <div style={{ fontWeight: 800, fontSize: 20, color: s.color }}>{s.val}</div>
                <div style={{ fontSize: 10, color: theme.textMuted, marginTop: 2, lineHeight: 1.3 }}>{s.label}</div>
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