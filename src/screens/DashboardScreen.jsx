import { useState, useEffect } from "react";
import Badge from "../components/Badge";
import BottomNav from "../components/BottomNav";
import Btn from "../components/Btn";
import Card from "../components/Card";
import Icon from "../components/Icon";
import SectionLabel from "../components/SectionLabel";
import theme from "../styles/theme";
import { supabase } from "../lib/supabase";
import { formatTime } from "../lib/dateHelper";
// FIX: pakai helper terpusat, tidak tulis ulang logika status
import { hitungStats, mapInspeksiItem } from "../lib/inspeksiHelper";

const DashboardScreen = ({ role, onNav, onLogout, onOpenDetail }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [stats, setStats] = useState({ total: 0, normal: 0, abnormal: 0 });
  const [recentChecks, setRecentChecks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null); // FIX: tambah error state

  // FIX: transportir & driver keduanya hanya lihat data sendiri
  const isTransportir = role === "transportir" || role === "driver";

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setError("Sesi tidak ditemukan. Silakan login ulang.");
        setLoading(false);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("nama, perusahaan")
        .eq("id", user.id)
        .single();

      if (profileError) {
        setError("Gagal memuat profil pengguna.");
        setLoading(false);
        return;
      }

      setCurrentUser(profile);

      let query = supabase.from("inspeksi").select("*");

      if (isTransportir) {
        query = query.eq("user_id", user.id);
      }

      const { data: inspeksiData, error: inspeksiError } = await query
        .order("created_at", { ascending: false })
        .limit(50); // FIX: batasi fetch, jangan ambil semua tanpa limit

      if (inspeksiError) {
        setError("Gagal memuat data inspeksi: " + inspeksiError.message);
        setLoading(false);
        return;
      }

      if (inspeksiData) {
        // FIX: pakai helper, tidak duplikasi logika
        setStats(hitungStats(inspeksiData));

        const recent = inspeksiData.slice(0, 5).map((item) => ({
          ...mapInspeksiItem(item),
          time: formatTime(item.created_at),
        }));

        setRecentChecks(recent);
      }

      setLoading(false);
    };

    loadData();
  }, [role]); // FIX: gunakan role langsung sebagai dependency, bukan isTransportir

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: theme.bg, display: "flex", justifyContent: "center", alignItems: "center" }}>
        <div style={{ color: theme.textMuted }}>Memuat data...</div>
      </div>
    );
  }

  // FIX: tampilkan error dengan jelas
  if (error) {
    return (
      <div style={{ minHeight: "100vh", background: theme.bg, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: 24 }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
        <div style={{ fontSize: 14, color: theme.danger, textAlign: "center", marginBottom: 16 }}>{error}</div>
        <Btn onClick={() => window.location.reload()} variant="outline">Coba Lagi</Btn>
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
            <div style={{ fontSize: 19, fontWeight: 800, color: theme.text }}>
              {/* FIX: selalu tampilkan nama dari profile, bukan hardcode "Pertamina" */}
              {currentUser?.perusahaan || currentUser?.nama || "—"}
            </div>
            <div style={{
              display: "inline-block", marginTop: 4, fontSize: 11, fontWeight: 600,
              padding: "2px 10px", borderRadius: 20,
              background: theme.primaryLight, color: theme.primary,
            }}>
              {isTransportir ? "Transportir" : role === "pertamina" ? "Pertamina · Pemantau" : role}
            </div>
          </div>
          <div onClick={onLogout} style={{ cursor: "pointer", padding: 10, borderRadius: 12, background: theme.surfaceAlt }}>
            <Icon name="logout" size={18} color={theme.textSub} />
          </div>
        </div>
      </div>

      <div style={{ padding: "20px 16px" }}>
        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 24 }}>
          <div style={{ background: theme.primaryLight, borderRadius: 14, padding: "14px 10px", textAlign: "center" }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: theme.primary }}>{stats.total}</div>
            <div style={{ fontSize: 10, color: theme.primary, fontWeight: 600, marginTop: 2, opacity: 0.8 }}>Total Cek</div>
          </div>
          <div style={{ background: theme.successLight, borderRadius: 14, padding: "14px 10px", textAlign: "center" }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: theme.success }}>{stats.normal}</div>
            <div style={{ fontSize: 10, color: theme.success, fontWeight: 600, marginTop: 2, opacity: 0.8 }}>Normal</div>
          </div>
          <div style={{ background: theme.dangerLight, borderRadius: 14, padding: "14px 10px", textAlign: "center" }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: theme.danger }}>{stats.abnormal}</div>
            <div style={{ fontSize: 10, color: theme.danger, fontWeight: 600, marginTop: 2, opacity: 0.8 }}>Abnormal</div>
          </div>
        </div>

        {/* CTA */}
        {isTransportir && (
          <div style={{ marginBottom: 24 }}>
            <Btn onClick={() => onNav("form")} variant="primary" icon="plus">
              Pengecekan Baru
            </Btn>
          </div>
        )}

        {/* Recent Checks */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <SectionLabel>Pengecekan Terbaru</SectionLabel>
          {/* FIX: tambah link ke riwayat lengkap */}
          {recentChecks.length > 0 && (
            <div
              onClick={() => onNav("history")}
              style={{ fontSize: 12, color: theme.primary, fontWeight: 600, cursor: "pointer" }}
            >
              Lihat Semua →
            </div>
          )}
        </div>

        {recentChecks.length > 0 ? (
          recentChecks.map((r) => ( // FIX: key pakai r.id bukan index
            <Card
              key={r.id}
              onClick={() => onOpenDetail(r.id)}
              style={{ marginBottom: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 42, height: 42, borderRadius: 12, background: theme.primaryLight, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon name="car" size={18} color={theme.primary} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: theme.text }}>{r.plat}</div>
                  <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 1 }}>{r.armada} · {r.time}</div>
                  <div style={{ fontSize: 11, color: theme.textMuted }}>{r.pemeriksa}</div>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                <Badge status={r.status} />
                <Icon name="chevron" size={14} color={theme.textMuted} />
              </div>
            </Card>
          ))
        ) : (
          <Card style={{ padding: "20px 16px", textAlign: "center" }}>
            <div style={{ fontSize: 13, color: theme.textMuted }}>Belum ada data pengecekan</div>
          </Card>
        )}
      </div>

      <BottomNav active="home" onNav={onNav} role={role} />
    </div>
  );
};

export default DashboardScreen;