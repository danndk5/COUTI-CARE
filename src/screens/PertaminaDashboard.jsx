import { useState, useEffect } from "react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import Badge from "../components/Badge";
import BottomNav from "../components/BottomNav";
import Card from "../components/Card";
import Icon from "../components/Icon";
import SectionLabel from "../components/SectionLabel";
import Btn from "../components/Btn";
import ReminderBanner from "../components/ReminderBanner";
import Top3KerusakanCard from "../components/Top3KerusakanCard";
import theme from "../styles/theme";
import { supabase } from "../lib/supabase";
import { calculateHealthScore, getHealthStatus } from "../lib/healthScore";
import { formatDate, formatTime } from "../lib/dateHelper";
import { getArmadaReminderList } from "../lib/reminderHelper";
import { getGroupedKerusakan } from "../lib/kerusakanHelper";
import { useBreakpoint } from "../hooks/useBreakpoint";
import { DESKTOP_GRID_GAP } from "../styles/layout";

const AssignModal = ({ inspeksi, onClose, onAssigned }) => {
  const [mekanikList, setMekanikList] = useState([]);
  const [selectedMekanik, setSelectedMekanik] = useState("");
  const [catatan, setCatatan] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadMekanik = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, nama, perusahaan")
        .eq("role", "mekanik");
      setMekanikList(data || []);
    };
    loadMekanik();
  }, []);

  const handleAssign = async () => {
    if (!selectedMekanik) {
      alert("Pilih mekanik terlebih dahulu");
      return;
    }

    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();

    const { error: tugasError } = await supabase.from("tugas_perbaikan").insert([
      {
        inspeksi_id: inspeksi.id,
        mekanik_id: selectedMekanik,
        ditugaskan_oleh: user.id,
        catatan_tugas: catatan,
        status: "menunggu",
      },
    ]);

    if (tugasError) {
      alert("Gagal assign: " + tugasError.message);
      setLoading(false);
      return;
    }

    await supabase.from("inspeksi").update({ status: "ditugaskan" }).eq("id", inspeksi.id);

    setLoading(false);
    onAssigned();
    onClose();
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: theme.surface,
          borderRadius: "20px 20px 0 0",
          padding: 24,
          width: "100%",
          maxWidth: 430,
          maxHeight: "85vh",
          overflowY: "auto",
        }}
      >
        <div style={{ fontWeight: 800, fontSize: 16, color: theme.text, marginBottom: 4 }}>
          Tugaskan Mekanik
        </div>
        <div style={{ fontSize: 13, color: theme.textMuted, marginBottom: 16 }}>
          {inspeksi.nomor_polisi} · {inspeksi.nama_armada}
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: theme.text, marginBottom: 8 }}>
            Pilih Mekanik
          </div>
          {mekanikList.length === 0 ? (
            <div style={{ fontSize: 13, color: theme.textMuted }}>Belum ada mekanik terdaftar</div>
          ) : (
            mekanikList.map((m) => (
              <div
                key={m.id}
                onClick={() => setSelectedMekanik(m.id)}
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: `1.5px solid ${selectedMekanik === m.id ? theme.primary : theme.border}`,
                  background: selectedMekanik === m.id ? theme.primaryLight : theme.surface,
                  marginBottom: 8,
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 600,
                  color: theme.text,
                }}
              >
                {m.nama} <span style={{ color: theme.textMuted, fontWeight: 400 }}>· {m.perusahaan}</span>
              </div>
            ))
          )}
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: theme.text, marginBottom: 8 }}>
            Catatan (opsional)
          </div>
          <textarea
            placeholder="Instruksi untuk mekanik..."
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 10,
              border: `1.5px solid ${theme.border}`,
              fontSize: 13,
              fontFamily: "'DM Sans', sans-serif",
              resize: "none",
              minHeight: 70,
              boxSizing: "border-box",
              outline: "none",
            }}
          />
        </div>

        <Btn onClick={handleAssign} variant="primary" disabled={loading}>
          {loading ? "Menugaskan..." : "Tugaskan Sekarang"}
        </Btn>
      </div>
    </div>
  );
};

const StatCard = ({ value, label, color, bg, isDesktop }) => (
  <div
    style={{
      background: bg,
      borderRadius: 16,
      padding: isDesktop ? "22px 16px" : "16px 12px",
      textAlign: "center",
    }}
  >
    <div style={{ fontSize: isDesktop ? 28 : 22, fontWeight: 800, color }}>{value}</div>
    <div style={{ fontSize: isDesktop ? 12 : 10, color, fontWeight: 600, marginTop: 2, opacity: 0.85 }}>
      {label}
    </div>
  </div>
);

const HEALTH_CATEGORY_COLORS = {
  Baik: "#10B981",
  "Perlu Perhatian": "#F59E0B",
  Kritis: "#EF4444",
};

const PertaminaDashboard = ({ onNav, onLogout, onOpenDetail, onOpenKategori }) => {
  const isDesktop = useBreakpoint();

  const [inspeksiList, setInspeksiList] = useState([]);
  const [tugasList, setTugasList] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    normal: 0,
    abnormal: 0,
    ditugaskan: 0,
    selesai: 0,
  });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("semua");
  const [assignTarget, setAssignTarget] = useState(null);

  const loadData = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("inspeksi")
      .select("*")
      .order("created_at", { ascending: false });

    const { data: tugasData } = await supabase
      .from("tugas_perbaikan")
      .select("*, mekanik:mekanik_id(nama)");

    if (data) {
      const isNormal = (item) => {
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
      };

      const withStatus = data.map((item) => {
        const health = calculateHealthScore(item);
        const healthCategory = getHealthStatus(health.overall).label;
        return {
          ...item,
          overallStatus: isNormal(item) ? "Normal" : "Abnormal",
          health,
          healthCategory,
        };
      });

      setInspeksiList(withStatus);
      setTugasList(tugasData || []);

      setStats({
        total: withStatus.length,
        normal: withStatus.filter((i) => i.overallStatus === "Normal").length,
        abnormal: withStatus.filter((i) => i.overallStatus === "Abnormal").length,
        ditugaskan: withStatus.filter((i) => i.status === "ditugaskan").length,
        selesai: withStatus.filter((i) => i.status === "selesai").length,
      });
    }

    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredList = inspeksiList.filter((item) => {
    if (filter === "semua") return true;
    if (filter === "abnormal") return item.overallStatus === "Abnormal";
    if (filter === "ditugaskan") return item.status === "ditugaskan";
    if (filter === "selesai") return item.status === "selesai";
    if (filter === "baru") return item.status === "baru" || !item.status;
    return true;
  });

  const healthCategoryCounts = {
    Baik: inspeksiList.filter((i) => i.healthCategory === "Baik").length,
    "Perlu Perhatian": inspeksiList.filter((i) => i.healthCategory === "Perlu Perhatian").length,
    Kritis: inspeksiList.filter((i) => i.healthCategory === "Kritis").length,
  };
  const pieData = Object.entries(healthCategoryCounts)
    .map(([name, value]) => ({ name, value }))
    .filter((d) => d.value > 0);

  const last7Days = [...Array(7)]
    .map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d;
    })
    .map((d) => {
      const dateStr = d.toISOString().slice(0, 10);
      const count = inspeksiList.filter(
        (item) => item.created_at?.slice(0, 10) === dateStr
      ).length;
      return {
        day: d.toLocaleDateString("id-ID", { weekday: "short" }),
        jumlah: count,
        dateStr, // disimpan untuk navigasi onClick bar chart
      };
    });

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
            <div style={{ fontSize: 19, fontWeight: 800, color: theme.text }}>Pertamina</div>
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
              Pertamina · Monitor & Audit
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

      <div style={{ padding: isDesktop ? "24px 32px" : "20px 16px" }}>
        {/* Stats Cards */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr 1fr",
          gap: isDesktop ? DESKTOP_GRID_GAP : 8,
          marginBottom: 20,
        }}>
          <StatCard value={stats.total} label="Total" color={theme.primary} bg={theme.primaryLight} isDesktop={isDesktop} />
          <StatCard value={stats.abnormal} label="Abnormal" color={theme.danger} bg={theme.dangerLight} isDesktop={isDesktop} />
          <StatCard value={stats.ditugaskan} label="Proses" color="#F59E0B" bg="#FEF3C7" isDesktop={isDesktop} />
          <StatCard value={stats.selesai} label="Selesai" color={theme.success} bg={theme.successLight} isDesktop={isDesktop} />
        </div>

        {/* Reminder & Top3 — full width di kedua mode */}
        <ReminderBanner armadaList={getArmadaReminderList(inspeksiList)} />
        <Top3KerusakanCard
          groupedKerusakan={getGroupedKerusakan(inspeksiList)}
          onViewAll={() => onNav("riwayat-kerusakan")}
        />

        {/* Charts — vertikal di mobile, 2 kolom di desktop */}
        <div style={{
          display: "grid",
          gridTemplateColumns: isDesktop ? "1fr 1fr" : "1fr",
          gap: isDesktop ? DESKTOP_GRID_GAP : 0,
          marginBottom: isDesktop ? 0 : 0,
          alignItems: "start",
        }}>
          {/* Pie Chart */}
          {pieData.length > 0 && (
            <Card style={{ marginBottom: 20, padding: 16 }}>
              <SectionLabel style={{ marginBottom: 8 }}>
                Komposisi Status Kesehatan Armada
              </SectionLabel>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ width: 120, height: 120, flexShrink: 0 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={32}
                        outerRadius={56}
                        paddingAngle={2}
                        onClick={(entry) =>
                            onOpenKategori && onOpenKategori("health", entry.name)
                          }
                        cursor="pointer"
                      >
                        {pieData.map((entry, index) => (
                          <Cell
                            key={index}
                            fill={HEALTH_CATEGORY_COLORS[entry.name]}
                          />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                    <div style={{ flex: 1 }}>
                  {pieData.map((d) => (
                    <div
                      key={d.name}
                      onClick={() =>
                        onOpenKategori && onOpenKategori("health", d.name)
                      }
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 8,
                        cursor: "pointer",
                      }}
                    >
                      <div
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: "50%",
                          background: HEALTH_CATEGORY_COLORS[d.name],
                        }}
                      />
                      <div style={{ fontSize: 12, color: theme.text, fontWeight: 600 }}>
                        {d.name === "Baik" && "🟢 "}
                        {d.name === "Perlu Perhatian" && "🟡 "}
                        {d.name === "Kritis" && "🔴 "}
                        {d.name}
                      </div>
                      <div style={{ fontSize: 12, color: theme.textMuted, marginLeft: "auto" }}>
                        {d.value} ({Math.round((d.value / stats.total) * 100)}%)
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}

          {/* Bar Chart */}
          <Card style={{ marginBottom: 20, padding: 16 }}>
            <SectionLabel style={{ marginBottom: 8 }}>Trend Inspeksi (7 Hari Terakhir)</SectionLabel>
            <div style={{ height: 140 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={last7Days} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 11, fill: theme.textMuted }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: theme.textMuted }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${theme.border}` }}
                  />
                  <Bar
                    dataKey="jumlah"
                    fill={theme.primary}
                    radius={[6, 6, 0, 0]}
                    cursor="pointer"
                    onClick={(data) => {
                      if (data?.dateStr && onOpenKategori) {
                        onOpenKategori("date", data.dateStr);
                      }
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        {/* Filter Tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16, overflowX: "auto" }}>
          {[
            { key: "semua", label: "Semua" },
            { key: "abnormal", label: "Abnormal" },
            { key: "baru", label: "Belum Ditugaskan" },
            { key: "ditugaskan", label: "Sedang Diperbaiki" },
            { key: "selesai", label: "Selesai Diperbaiki" },
          ].map((f) => (
            <div
              key={f.key}
              onClick={() => setFilter(f.key)}
              style={{
                padding: "8px 14px",
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 600,
                whiteSpace: "nowrap",
                cursor: "pointer",
                background: filter === f.key ? theme.primary : theme.surfaceAlt,
                color: filter === f.key ? "#fff" : theme.textMuted,
              }}
            >
              {f.label}
            </div>
          ))}
        </div>

        <SectionLabel>Daftar Laporan</SectionLabel>
        {filteredList.length > 0 ? (
          <div style={{
            display: "grid",
            gridTemplateColumns: isDesktop ? "repeat(3, 1fr)" : "1fr",
            gap: isDesktop ? DESKTOP_GRID_GAP : 0,
          }}>
            {filteredList.map((item) => {
              const tugasItem = tugasList.find((t) => t.inspeksi_id === item.id);
              return (
                <Card key={item.id} style={{ marginBottom: isDesktop ? 0 : 10, padding: "14px 16px" }}>
                  <div
                    onClick={() => onOpenDetail(item.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      cursor: "pointer",
                      marginBottom: 10,
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
                        <div style={{ fontWeight: 700, fontSize: 14, color: theme.text }}>
                          {item.nomor_polisi}
                        </div>
                        <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 1 }}>
                          {item.nama_armada} · {item.perusahaan_transportir}
                        </div>
                        <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 2 }}>
                          {formatDate(item.created_at)} · {formatTime(item.created_at)}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                      <Badge status={item.overallStatus} />
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: HEALTH_CATEGORY_COLORS[item.healthCategory],
                        }}
                      >
                        {item.health.overall}%
                      </div>
                    </div>
                  </div>

                  {item.status === "ditugaskan" && (
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: "#F59E0B",
                        background: "#FEF3C7",
                        padding: "6px 10px",
                        borderRadius: 8,
                        marginBottom: item.overallStatus === "Abnormal" ? 8 : 0,
                      }}
                    >
                      🔧 Sedang diperbaiki {tugasItem?.mekanik?.nama ? `oleh ${tugasItem.mekanik.nama}` : ""}
                    </div>
                  )}
                  {item.status === "selesai" && (
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: theme.success,
                        background: theme.successLight,
                        padding: "6px 10px",
                        borderRadius: 8,
                      }}
                    >
                      ✓ Perbaikan selesai
                    </div>
                  )}

                  {item.overallStatus === "Abnormal" && (!item.status || item.status === "baru") && (
                    <Btn
                      onClick={() => setAssignTarget(item)}
                      variant="outline"
                      style={{ padding: "8px", fontSize: 12 }}
                    >
                      Tugaskan Mekanik
                    </Btn>
                  )}
                </Card>
              );
            })}
          </div>
        ) : (
          <Card style={{ padding: "20px 16px", textAlign: "center" }}>
            <div style={{ fontSize: 13, color: theme.textMuted }}>Tidak ada data</div>
          </Card>
        )}
      </div>

      {assignTarget && (
        <AssignModal inspeksi={assignTarget} onClose={() => setAssignTarget(null)} onAssigned={loadData} />
      )}

      <BottomNav active="home" onNav={onNav} role="pertamina" />
    </div>
  );
};

export default PertaminaDashboard;