import { useState, useEffect } from "react";
import Badge from "../components/Badge";
import BottomNav from "../components/BottomNav";
import Card from "../components/Card";
import Icon from "../components/Icon";
import SectionLabel from "../components/SectionLabel";
import theme from "../styles/theme";
import { supabase } from "../lib/supabase";

const MekanikDashboard = ({ onNav, onLogout, onOpenTugas }) => {
  const [tugasList, setTugasList] = useState([]);
  const [stats, setStats] = useState({ menunggu: 0, dikerjakan: 0, selesai: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data, error } = await supabase
          .from("tugas_perbaikan")
          .select("*, inspeksi:inspeksi_id(*)")
          .eq("mekanik_id", user.id)
          .order("created_at", { ascending: false });

        if (error) console.error("Error loading tugas:", error);

        if (data) {
          setTugasList(data);
          setStats({
            menunggu: data.filter((t) => t.status === "menunggu").length,
            dikerjakan: data.filter((t) => t.status === "dikerjakan").length,
            selesai: data.filter((t) => t.status === "selesai").length,
          });
        }
      }

      setLoading(false);
    };

    loadData();
  }, []);

  const statusColor = {
    menunggu: { bg: theme.dangerLight, color: theme.danger, label: "Menunggu" },
    dikerjakan: { bg: theme.primaryLight, color: theme.primary, label: "Dikerjakan" },
    selesai: { bg: theme.successLight, color: theme.success, label: "Selesai" },
  };

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: theme.bg,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <div style={{ color: theme.textMuted }}>Memuat data...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: theme.bg, paddingBottom: 80 }}>
      {/* Header */}
      <div
        style={{
          background: theme.surface,
          padding: "48px 20px 20px",
          borderBottom: `1px solid ${theme.border}`,
          boxShadow: theme.shadow,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 13, color: theme.textMuted }}>Selamat datang,</div>
            <div style={{ fontSize: 19, fontWeight: 800, color: theme.text }}>Mekanik</div>
            <div
              style={{
                display: "inline-block",
                marginTop: 4,
                fontSize: 11,
                fontWeight: 600,
                padding: "2px 10px",
                borderRadius: 20,
                background: theme.primaryLight,
                color: theme.primary,
              }}
            >
              Mekanik · Teknisi
            </div>
          </div>
          <div
            onClick={onLogout}
            style={{ cursor: "pointer", padding: 10, borderRadius: 12, background: theme.surfaceAlt }}
          >
            <Icon name="logout" size={18} color={theme.textSub} />
          </div>
        </div>
      </div>

      <div style={{ padding: "20px 16px" }}>
        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 24 }}>
          <div style={{ background: theme.dangerLight, borderRadius: 14, padding: "14px 10px", textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: theme.danger }}>{stats.menunggu}</div>
            <div style={{ fontSize: 10, color: theme.danger, fontWeight: 600, marginTop: 2 }}>Menunggu</div>
          </div>
          <div style={{ background: theme.primaryLight, borderRadius: 14, padding: "14px 10px", textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: theme.primary }}>{stats.dikerjakan}</div>
            <div style={{ fontSize: 10, color: theme.primary, fontWeight: 600, marginTop: 2 }}>Dikerjakan</div>
          </div>
          <div style={{ background: theme.successLight, borderRadius: 14, padding: "14px 10px", textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: theme.success }}>{stats.selesai}</div>
            <div style={{ fontSize: 10, color: theme.success, fontWeight: 600, marginTop: 2 }}>Selesai</div>
          </div>
        </div>

        <SectionLabel>Tugas Perbaikan</SectionLabel>
        {tugasList.length > 0 ? (
          tugasList.map((tugas) => {
            const sc = statusColor[tugas.status] || statusColor.menunggu;
            return (
              <Card
                key={tugas.id}
                onClick={() => onOpenTugas(tugas.id)}
                style={{
                  marginBottom: 10,
                  padding: "14px 16px",
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 8,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 12,
                        background: theme.primaryLight,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Icon name="wrench" size={18} color={theme.primary} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: theme.text }}>
                        {tugas.inspeksi?.nomor_polisi}
                      </div>
                      <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 1 }}>
                        {tugas.inspeksi?.nama_armada}
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "4px 10px",
                      borderRadius: 20,
                      background: sc.bg,
                      color: sc.color,
                    }}
                  >
                    {sc.label}
                  </div>
                </div>
                {tugas.catatan_tugas && (
                  <div
                    style={{
                      fontSize: 12,
                      color: theme.textSub,
                      background: theme.surfaceAlt,
                      padding: "8px 10px",
                      borderRadius: 8,
                      fontStyle: "italic",
                    }}
                  >
                    "{tugas.catatan_tugas}"
                  </div>
                )}
              </Card>
            );
          })
        ) : (
          <Card style={{ padding: "20px 16px", textAlign: "center" }}>
            <div style={{ fontSize: 13, color: theme.textMuted }}>
              Belum ada tugas perbaikan
            </div>
          </Card>
        )}
      </div>

      <BottomNav active="home" onNav={onNav} role="mekanik" />
    </div>
  );
};

export default MekanikDashboard;