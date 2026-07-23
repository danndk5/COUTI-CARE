import { useState, useEffect } from "react";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import Badge from "../components/Badge";
import BottomNav from "../components/BottomNav";
import Card from "../components/Card";
import Icon from "../components/Icon";
import SectionLabel from "../components/SectionLabel";
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

// AssignModal DIHAPUS — pemeriksa = teknisi (orang yang sama), tidak ada assign dari Pertamina.

const StatCard = ({ value, label, color, bg, isDesktop, onClick }) => (
  <div onClick={onClick} style={{
    background: bg, borderRadius: 16,
    padding: isDesktop ? "22px 16px" : "16px 12px",
    textAlign: "center", cursor: onClick ? "pointer" : "default",
  }}>
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
  const [stats, setStats] = useState({ total: 0, normal: 0, abnormal: 0, selesai: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("semua");

  const loadData = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("inspeksi").select("*").order("created_at", { ascending: false });

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
        return { ...item, overallStatus: isNormal(item) ? "Normal" : "Abnormal", health, healthCategory };
      });

      setInspeksiList(withStatus);
      setStats({
        total: withStatus.length,
        normal: withStatus.filter((i) => i.overallStatus === "Normal").length,
        abnormal: withStatus.filter((i) => i.overallStatus === "Abnormal").length,
        selesai: withStatus.filter((i) => i.status === "selesai").length,
      });
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const filteredList = inspeksiList.filter((item) => {
    if (filter === "semua") return true;
    if (filter === "normal") return item.overallStatus === "Normal";
    if (filter === "abnormal") return item.overallStatus === "Abnormal";
    if (filter === "selesai") return item.status === "selesai";
    return true;
  });

  const healthCategoryCounts = {
    Baik: inspeksiList.filter((i) => i.healthCategory === "Baik").length,
    "Perlu Perhatian": inspeksiList.filter((i) => i.healthCategory === "Perlu Perhatian").length,
    Kritis: inspeksiList.filter((i) => i.healthCategory === "Kritis").length,
  };
  const pieData = Object.entries(healthCategoryCounts)
    .map(([name, value]) => ({ name, value })).filter((d) => d.value > 0);

  const last7Days = [...Array(7)].map((_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const dateStr = d.toISOString().slice(0, 10);
    return {
      day: d.toLocaleDateString("id-ID", { weekday: "short" }),
      jumlah: inspeksiList.filter((item) => item.created_at?.slice(0, 10) === dateStr).length,
      dateStr,
    };
  });

  if (loading) return (
    <div style={{ minHeight: "100vh", background: theme.bg, display: "flex", justifyContent: "center", alignItems: "center" }}>
      <div style={{ color: theme.textMuted }}>Memuat data...</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: theme.bg, paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ background: theme.surface, padding: "48px 20px 20px", borderBottom: `1px solid ${theme.border}`, boxShadow: theme.shadow }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 13, color: theme.textMuted }}>Selamat datang,</div>
            <div style={{ fontSize: 19, fontWeight: 800, color: theme.text }}>Pertamina</div>
            <div style={{ display: "inline-block", marginTop: 4, fontSize: 11, fontWeight: 600, padding: "2px 10px", borderRadius: 20, background: theme.primaryLight, color: theme.primary }}>
              Pertamina · Monitor & Audit
            </div>
          </div>
          <div onClick={onLogout} style={{ cursor: "pointer", padding: 10, borderRadius: 12, background: theme.surfaceAlt }}>
            <Icon name="logout" size={18} color={theme.textSub} />
          </div>
        </div>
      </div>

      <div style={{ padding: isDesktop ? "24px 32px" : "20px 16px" }}>
        {/* Stats — Total, Normal, Abnormal, Selesai */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: isDesktop ? DESKTOP_GRID_GAP : 8, marginBottom: 20 }}>
          <StatCard value={stats.total}    label="Total"    color={theme.primary} bg={theme.primaryLight} isDesktop={isDesktop} onClick={() => onOpenKategori?.("status", "total")} />
          <StatCard value={stats.normal}   label="Normal"   color={theme.success} bg={theme.successLight} isDesktop={isDesktop} onClick={() => onOpenKategori?.("status", "normal")} />
          <StatCard value={stats.abnormal} label="Abnormal" color={theme.danger}  bg={theme.dangerLight}  isDesktop={isDesktop} onClick={() => onOpenKategori?.("status", "abnormal")} />
          <StatCard value={stats.selesai}  label="Selesai"  color="#10B981"       bg="#D1FAE5"            isDesktop={isDesktop} onClick={() => onOpenKategori?.("status", "selesai")} />
        </div>

        <ReminderBanner armadaList={getArmadaReminderList(inspeksiList)} />
        <Top3KerusakanCard groupedKerusakan={getGroupedKerusakan(inspeksiList)} onViewAll={() => onNav("riwayat-kerusakan")} />

        {/* Charts */}
        <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "1fr 1fr" : "1fr", gap: isDesktop ? DESKTOP_GRID_GAP : 0, alignItems: "start" }}>
          {pieData.length > 0 && (
            <Card style={{ marginBottom: 20, padding: 16 }}>
              <SectionLabel style={{ marginBottom: 8 }}>Status Kesehatan Armada</SectionLabel>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ width: 120, height: 120, flexShrink: 0 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={32} outerRadius={56} paddingAngle={2}
                        onClick={(entry) => onOpenKategori?.("health", entry.name)} cursor="pointer">
                        {pieData.map((entry, index) => <Cell key={index} fill={HEALTH_CATEGORY_COLORS[entry.name]} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ flex: 1 }}>
                  {pieData.map((d) => (
                    <div key={d.name} onClick={() => onOpenKategori?.("health", d.name)}
                      style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, cursor: "pointer" }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: HEALTH_CATEGORY_COLORS[d.name] }} />
                      <div style={{ fontSize: 12, color: theme.text, fontWeight: 600 }}>
                        {d.name === "Baik" && "🟢 "}{d.name === "Perlu Perhatian" && "🟡 "}{d.name === "Kritis" && "🔴 "}{d.name}
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

          <Card style={{ marginBottom: 20, padding: 16 }}>
            <SectionLabel style={{ marginBottom: 8 }}>Trend Inspeksi (7 Hari Terakhir)</SectionLabel>
            <div style={{ height: 140 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={last7Days} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: theme.textMuted }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: theme.textMuted }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${theme.border}` }} />
                  <Bar dataKey="jumlah" fill={theme.primary} radius={[6, 6, 0, 0]} cursor="pointer"
                    onClick={(data) => { if (data?.dateStr) onOpenKategori?.("date", data.dateStr); }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        {/* Filter Tabs — disederhanakan, tanpa "Belum Ditugaskan"/"Sedang Diperbaiki" */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16, overflowX: "auto" }}>
          {[
            { key: "semua",    label: "Semua" },
            { key: "normal",   label: "Normal" },
            { key: "abnormal", label: "Abnormal" },
            { key: "selesai",  label: "Selesai Diperbaiki" },
          ].map((f) => (
            <div key={f.key} onClick={() => setFilter(f.key)} style={{
              padding: "8px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600,
              whiteSpace: "nowrap", cursor: "pointer",
              background: filter === f.key ? theme.primary : theme.surfaceAlt,
              color: filter === f.key ? "#fff" : theme.textMuted,
            }}>
              {f.label}
            </div>
          ))}
        </div>

        <SectionLabel>Daftar Laporan</SectionLabel>
        {filteredList.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "repeat(3, 1fr)" : "1fr", gap: isDesktop ? DESKTOP_GRID_GAP : 0 }}>
            {filteredList.map((item) => (
              <Card key={item.id} style={{ marginBottom: isDesktop ? 0 : 10, padding: "14px 16px" }}>
                <div onClick={() => onOpenDetail(item.id)}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 42, height: 42, borderRadius: 12, background: theme.primaryLight, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Icon name="car" size={18} color={theme.primary} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: theme.text }}>{item.nomor_polisi}</div>
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
                    <div style={{ fontSize: 11, fontWeight: 700, color: HEALTH_CATEGORY_COLORS[item.healthCategory] }}>
                      {item.health.overall}%
                    </div>
                  </div>
                </div>

                {/* Status badge — informatif, tidak ada tombol assign */}
                {item.status === "selesai" && (
                  <div style={{ fontSize: 11, fontWeight: 600, color: theme.success, background: theme.successLight, padding: "6px 10px", borderRadius: 8 }}>
                    ✓ Perbaikan selesai
                  </div>
                )}
                {item.overallStatus === "Abnormal" && item.status !== "selesai" && (
                  <div style={{ fontSize: 11, fontWeight: 600, color: theme.danger, background: theme.dangerLight, padding: "6px 10px", borderRadius: 8 }}>
                    ⚠️ Perlu perbaikan oleh teknisi
                  </div>
                )}
              </Card>
            ))}
          </div>
        ) : (
          <Card style={{ padding: "20px 16px", textAlign: "center" }}>
            <div style={{ fontSize: 13, color: theme.textMuted }}>Tidak ada data</div>
          </Card>
        )}
      </div>

      <BottomNav active="home" onNav={onNav} role="pertamina" />
    </div>
  );
};

export default PertaminaDashboard;