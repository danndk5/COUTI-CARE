import { useState, useEffect } from "react";
import Badge from "../components/Badge";
import BottomNav from "../components/BottomNav";
import Btn from "../components/Btn";
import Card from "../components/Card";
import Icon from "../components/Icon";
import SectionLabel from "../components/SectionLabel";
import theme from "../styles/theme";
import { supabase } from "../lib/supabase";

// ── Tab "Beranda" — gabungan ringkasan inspeksi (dari DashboardScreen lama)
//    + ringkasan tugas perbaikan (dari MekanikDashboard lama) ──────────────

const BerandaTab = ({ currentUser, stats, tugasStats, recentChecks, onNav, onOpenDetail, onOpenKategori }) => (
  <>
    {/* Stats inspeksi — IDENTIK dengan DashboardScreen.jsx lama, tidak diubah */}
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr",
        gap: 10,
        marginBottom: 16,
      }}
    >
      <div
        onClick={() => onOpenKategori && onOpenKategori("all")}
        style={{
          background: theme.primaryLight,
          borderRadius: 14,
          padding: "14px 10px",
          textAlign: "center",
          cursor: "pointer",
        }}
      >
        <div style={{ fontSize: 26, fontWeight: 800, color: theme.primary }}>
          {stats.total}
        </div>
        <div style={{ fontSize: 10, color: theme.primary, fontWeight: 600, marginTop: 2, opacity: 0.8 }}>
          Total Cek
        </div>
      </div>
      <div
        onClick={() => onOpenKategori && onOpenKategori("normal")}
        style={{
          background: theme.successLight,
          borderRadius: 14,
          padding: "14px 10px",
          textAlign: "center",
          cursor: "pointer",
        }}
      >
        <div style={{ fontSize: 26, fontWeight: 800, color: theme.success }}>
          {stats.normal}
        </div>
        <div style={{ fontSize: 10, color: theme.success, fontWeight: 600, marginTop: 2, opacity: 0.8 }}>
          Normal
        </div>
      </div>
      <div
        onClick={() => onOpenKategori && onOpenKategori("abnormal")}
        style={{
          background: theme.dangerLight,
          borderRadius: 14,
          padding: "14px 10px",
          textAlign: "center",
          cursor: "pointer",
        }}
      >
        <div style={{ fontSize: 26, fontWeight: 800, color: theme.danger }}>
          {stats.abnormal}
        </div>
        <div style={{ fontSize: 10, color: theme.danger, fontWeight: 600, marginTop: 2, opacity: 0.8 }}>
          Abnormal
        </div>
      </div>
    </div>

    {/* Stats tugas perbaikan — dari MekanikDashboard.jsx lama */}
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr",
        gap: 10,
        marginBottom: 24,
      }}
    >
      <div style={{ background: theme.dangerLight, borderRadius: 14, padding: "14px 10px", textAlign: "center" }}>
        <div style={{ fontSize: 24, fontWeight: 800, color: theme.danger }}>{tugasStats.menunggu}</div>
        <div style={{ fontSize: 10, color: theme.danger, fontWeight: 600, marginTop: 2 }}>Tugas Menunggu</div>
      </div>
      <div style={{ background: theme.primaryLight, borderRadius: 14, padding: "14px 10px", textAlign: "center" }}>
        <div style={{ fontSize: 24, fontWeight: 800, color: theme.primary }}>{tugasStats.dikerjakan}</div>
        <div style={{ fontSize: 10, color: theme.primary, fontWeight: 600, marginTop: 2 }}>Dikerjakan</div>
      </div>
      <div style={{ background: theme.successLight, borderRadius: 14, padding: "14px 10px", textAlign: "center" }}>
        <div style={{ fontSize: 24, fontWeight: 800, color: theme.success }}>{tugasStats.selesai}</div>
        <div style={{ fontSize: 10, color: theme.success, fontWeight: 600, marginTop: 2 }}>Selesai</div>
      </div>
    </div>

    {/* CTA inspeksi baru — IDENTIK dengan DashboardScreen lama */}
    <div style={{ marginBottom: 24 }}>
      <Btn onClick={() => onNav("form")} variant="primary" icon="plus">
        Pengecekan Baru
      </Btn>
    </div>

    {/* Recent Checks — IDENTIK dengan DashboardScreen lama */}
    <SectionLabel>Pengecekan Terbaru</SectionLabel>
    {recentChecks.length > 0 ? (
      recentChecks.map((r, i) => (
        <Card
          key={i}
          onClick={() => onOpenDetail(r.id)}
          style={{
            marginBottom: 10,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 16px",
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
              <Icon name="car" size={18} color={theme.primary} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: theme.text }}>{r.plat}</div>
              <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 1 }}>
                {r.armada} · {r.time}
              </div>
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
  </>
);

// ── Tab "Tugas Perbaikan" — IDENTIK dengan isi MekanikDashboard.jsx lama ──

const TugasTab = ({ tugasList, onOpenTugas }) => {
  const statusColor = {
    menunggu: { bg: theme.dangerLight, color: theme.danger, label: "Menunggu" },
    dikerjakan: { bg: theme.primaryLight, color: theme.primary, label: "Dikerjakan" },
    selesai: { bg: theme.successLight, color: theme.success, label: "Selesai" },
  };

  return (
    <>
      <SectionLabel>Tugas Perbaikan</SectionLabel>
      {tugasList.length > 0 ? (
        tugasList.map((tugas) => {
          const sc = statusColor[tugas.status] || statusColor.menunggu;
          return (
            <Card
              key={tugas.id}
              onClick={() => onOpenTugas(tugas.id)}
              style={{ marginBottom: 10, padding: "14px 16px", cursor: "pointer" }}
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
          <div style={{ fontSize: 13, color: theme.textMuted }}>Belum ada tugas perbaikan</div>
        </Card>
      )}
    </>
  );
};

// ── DashboardScreen gabungan — dipanggil dari App.jsx untuk role teknisi ──
// CATATAN: nama komponen & cara dipanggil dari App.jsx TIDAK BERUBAH
// (tetap <DashboardScreen role={role} onNav={onNav} onLogout={onLogout} onOpenDetail={openDetail} />),
// hanya ditambah 1 prop baru onOpenTugas yang WAJIB ditambahkan di App.jsx.

const DashboardScreen = ({ role, onNav, onLogout, onOpenDetail, onOpenTugas, initialTab, onOpenKategori }) => {
  const [activeTab, setActiveTab] = useState(initialTab || "beranda");

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  const [currentUser, setCurrentUser] = useState(null);
  const [stats, setStats] = useState({ total: 0, normal: 0, abnormal: 0 });
  const [recentChecks, setRecentChecks] = useState([]);
  const [tugasList, setTugasList] = useState([]);
  const [tugasStats, setTugasStats] = useState({ menunggu: 0, dikerjakan: 0, selesai: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        // ── Bagian inspeksi (IDENTIK logic DashboardScreen.jsx lama) ──
        const { data: profile } = await supabase
          .from("profiles")
          .select("nama, perusahaan")
          .eq("id", user.id)
          .single();

        setCurrentUser(profile);

        const { data: inspeksiData } = await supabase
          .from("inspeksi")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (inspeksiData) {
          const totalCek = inspeksiData.length;
          const normalCount = inspeksiData.filter((item) => {
            const gpsNormal =
              item.segel_gps?.toLowerCase() === "normal" &&
              item.kabel_gps?.toLowerCase() === "normal";
            const cctvNormal =
              item.segel_bricket_dashcam?.toLowerCase() === "normal" &&
              item.segel_kabel_dashcam?.toLowerCase() === "normal" &&
              item.segel_bricket_kanan?.toLowerCase() === "normal" &&
              item.segel_kabel_kanan?.toLowerCase() === "normal" &&
              item.segel_bricket_kiri?.toLowerCase() === "normal" &&
              item.segel_kabel_kiri?.toLowerCase() === "normal";
            return gpsNormal && cctvNormal;
          }).length;
          const abnormalCount = totalCek - normalCount;

          setStats({ total: totalCek, normal: normalCount, abnormal: abnormalCount });

          const recent = inspeksiData.slice(0, 5).map((item) => {
            const gpsNormal =
              item.segel_gps?.toLowerCase() === "normal" &&
              item.kabel_gps?.toLowerCase() === "normal";
            const cctvNormal =
              item.segel_bricket_dashcam?.toLowerCase() === "normal" &&
              item.segel_kabel_dashcam?.toLowerCase() === "normal" &&
              item.segel_bricket_kanan?.toLowerCase() === "normal" &&
              item.segel_kabel_kanan?.toLowerCase() === "normal" &&
              item.segel_bricket_kiri?.toLowerCase() === "normal" &&
              item.segel_kabel_kiri?.toLowerCase() === "normal";

            const status = gpsNormal && cctvNormal ? "Normal" : "Abnormal";
            const time = new Date(item.created_at).toLocaleTimeString("id-ID", {
              hour: "2-digit",
              minute: "2-digit",
            });

            return {
              id: item.id,
              plat: item.nomor_polisi,
              armada: item.nama_armada,
              status,
              time,
              pemeriksa: item.nama_pemeriksa,
            };
          });

          setRecentChecks(recent);
        }

        // ── Bagian tugas perbaikan (IDENTIK logic MekanikDashboard.jsx lama) ──
        const { data: tugasData, error: tugasError } = await supabase
          .from("tugas_perbaikan")
          .select("*, inspeksi:inspeksi_id(*)")
          .eq("mekanik_id", user.id)
          .order("created_at", { ascending: false });

        if (tugasError) console.error("Error loading tugas:", tugasError);

        if (tugasData) {
          setTugasList(tugasData);
          setTugasStats({
            menunggu: tugasData.filter((t) => t.status === "menunggu").length,
            dikerjakan: tugasData.filter((t) => t.status === "dikerjakan").length,
            selesai: tugasData.filter((t) => t.status === "selesai").length,
          });
        }
      }

      setLoading(false);
    };

    loadData();
  }, []);

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
      {/* Header — IDENTIK dengan DashboardScreen lama */}
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
            <div style={{ fontSize: 19, fontWeight: 800, color: theme.text }}>
              {currentUser?.perusahaan || "Loading..."}
            </div>
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
              Teknisi
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
        {activeTab === "beranda" && (
          <BerandaTab
            currentUser={currentUser}
            stats={stats}
            tugasStats={tugasStats}
            recentChecks={recentChecks}
            onNav={onNav}
            onOpenDetail={onOpenDetail}
            onOpenKategori={onOpenKategori}
          />
        )}
        {activeTab === "tugas" && (
          <TugasTab tugasList={tugasList} onOpenTugas={onOpenTugas} />
        )}
      </div>

      <BottomNav active="home" onNav={onNav} role={role} />
    </div>
  );
};

export default DashboardScreen;