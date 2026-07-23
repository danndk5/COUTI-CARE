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

// ── StatCard ──────────────────────────────────────────────────────────────────
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

// ── Tab Bar ───────────────────────────────────────────────────────────────────
const TAB_LIST = [
  { key: "gps",    label: "GPS & CCTV" },
  { key: "hse",    label: "Uji Kedap MT" },
  { key: "p1",     label: "Cek Random P1" },
];

const TabBar = ({ active, onChange }) => (
  <div style={{
    display: "flex", borderBottom: `2px solid ${theme.border}`,
    background: theme.surface, paddingLeft: 16, paddingRight: 16,
  }}>
    {TAB_LIST.map((t) => (
      <div key={t.key} onClick={() => onChange(t.key)} style={{
        padding: "12px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer",
        color: active === t.key ? theme.primary : theme.textMuted,
        borderBottom: active === t.key ? `2.5px solid ${theme.primary}` : "2.5px solid transparent",
        marginBottom: -2, whiteSpace: "nowrap",
        transition: "color 0.15s",
      }}>
        {t.label}
      </div>
    ))}
  </div>
);

// ── HEALTH CATEGORY COLORS ────────────────────────────────────────────────────
const HEALTH_CATEGORY_COLORS = {
  Baik: "#10B981",
  "Perlu Perhatian": "#F59E0B",
  Kritis: "#EF4444",
};

// ─────────────────────────────────────────────────────────────────────────────
// TAB 1: GPS & CCTV (konten lama, tidak diubah)
// ─────────────────────────────────────────────────────────────────────────────
const TabGPS = ({ onOpenDetail, onOpenKategori, isDesktop }) => {
  const [inspeksiList, setInspeksiList] = useState([]);
  const [stats, setStats] = useState({ total: 0, normal: 0, abnormal: 0, selesai: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("semua");

  useEffect(() => {
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
    loadData();
  }, []);

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
    <div style={{ padding: 40, textAlign: "center", color: theme.textMuted }}>Memuat data...</div>
  );

  return (
    <div style={{ padding: isDesktop ? "24px 32px" : "20px 16px" }}>
      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: isDesktop ? DESKTOP_GRID_GAP : 8, marginBottom: 20 }}>
        <StatCard value={stats.total}    label="Total"    color={theme.primary} bg={theme.primaryLight} isDesktop={isDesktop} onClick={() => onOpenKategori?.("status", "total")} />
        <StatCard value={stats.normal}   label="Normal"   color={theme.success} bg={theme.successLight} isDesktop={isDesktop} onClick={() => onOpenKategori?.("status", "normal")} />
        <StatCard value={stats.abnormal} label="Abnormal" color={theme.danger}  bg={theme.dangerLight}  isDesktop={isDesktop} onClick={() => onOpenKategori?.("status", "abnormal")} />
        <StatCard value={stats.selesai}  label="Selesai"  color="#10B981"       bg="#D1FAE5"            isDesktop={isDesktop} onClick={() => onOpenKategori?.("status", "selesai")} />
      </div>

      <ReminderBanner armadaList={getArmadaReminderList(inspeksiList)} />
      <Top3KerusakanCard groupedKerusakan={getGroupedKerusakan(inspeksiList)} />

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

      {/* Filter & List */}
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

      <SectionLabel>Daftar Laporan GPS & CCTV</SectionLabel>
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
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// TAB 2: Uji Kedap MT (data dari inspeksi_hse, semua akun HSE)
// ─────────────────────────────────────────────────────────────────────────────
const TabHSE = ({ isDesktop }) => {
  const [list, setList]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState("semua");

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("inspeksi_hse")
        .select("*")
        .order("created_at", { ascending: false });
      setList(data || []);
      setLoading(false);
    };
    loadData();
  }, []);

  const stats = {
    total:   list.length,
    kedap:   list.filter((i) => i.status === "selesai").length,
    perlu:   list.filter((i) => i.status !== "selesai").length,
  };

  // Trend 7 hari
  const last7Days = [...Array(7)].map((_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const dateStr = d.toISOString().slice(0, 10);
    return {
      day: d.toLocaleDateString("id-ID", { weekday: "short" }),
      jumlah: list.filter((item) => item.created_at?.slice(0, 10) === dateStr).length,
    };
  });

  // Pie: MT Merah Putih vs MT Industri
  const merahPutih = list.filter((i) => i.kategori_mt === "merah_putih").length;
  const industri   = list.filter((i) => i.kategori_mt === "industri").length;
  const pieData = [
    merahPutih > 0 && { name: "MT Merah Putih", value: merahPutih, color: "#EF4444" },
    industri   > 0 && { name: "MT Industri",    value: industri,   color: "#3B82F6" },
  ].filter(Boolean);

  const filteredList = list.filter((item) => {
    if (filter === "semua")  return true;
    if (filter === "selesai") return item.status === "selesai";
    if (filter === "perlu")   return item.status !== "selesai";
    if (filter === "merah_putih") return item.kategori_mt === "merah_putih";
    if (filter === "industri")    return item.kategori_mt === "industri";
    return true;
  });

  if (loading) return (
    <div style={{ padding: 40, textAlign: "center", color: theme.textMuted }}>Memuat data...</div>
  );

  return (
    <div style={{ padding: isDesktop ? "24px 32px" : "20px 16px" }}>
      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: isDesktop ? DESKTOP_GRID_GAP : 8, marginBottom: 20 }}>
        <StatCard value={stats.total} label="Total Diperiksa" color={theme.primary} bg={theme.primaryLight} isDesktop={isDesktop} />
        <StatCard value={stats.perlu} label="Perlu Tindak Lanjut" color={theme.danger} bg={theme.dangerLight} isDesktop={isDesktop} />
        <StatCard value={stats.kedap} label="Sudah Selesai" color={theme.success} bg={theme.successLight} isDesktop={isDesktop} />
      </div>

      {/* Charts */}
      <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "1fr 1fr" : "1fr", gap: isDesktop ? DESKTOP_GRID_GAP : 0, alignItems: "start" }}>
        {pieData.length > 0 && (
          <Card style={{ marginBottom: 20, padding: 16 }}>
            <SectionLabel style={{ marginBottom: 8 }}>Kategori MT</SectionLabel>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ width: 120, height: 120, flexShrink: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={32} outerRadius={56} paddingAngle={2}>
                      {pieData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ flex: 1 }}>
                {pieData.map((d) => (
                  <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: d.color }} />
                    <div style={{ fontSize: 12, color: theme.text, fontWeight: 600 }}>{d.name}</div>
                    <div style={{ fontSize: 12, color: theme.textMuted, marginLeft: "auto" }}>
                      {d.value} ({stats.total > 0 ? Math.round((d.value / stats.total) * 100) : 0}%)
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        )}

        <Card style={{ marginBottom: 20, padding: 16 }}>
          <SectionLabel style={{ marginBottom: 8 }}>Trend Uji Kedap (7 Hari Terakhir)</SectionLabel>
          <div style={{ height: 140 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={last7Days} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: theme.textMuted }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: theme.textMuted }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${theme.border}` }} />
                <Bar dataKey="jumlah" fill="#F59E0B" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Filter */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, overflowX: "auto" }}>
        {[
          { key: "semua",       label: "Semua" },
          { key: "perlu",       label: "Perlu Tindak Lanjut" },
          { key: "selesai",     label: "Selesai" },
          { key: "merah_putih", label: "MT Merah Putih" },
          { key: "industri",    label: "MT Industri" },
        ].map((f) => (
          <div key={f.key} onClick={() => setFilter(f.key)} style={{
            padding: "8px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600,
            whiteSpace: "nowrap", cursor: "pointer",
            background: filter === f.key ? "#F59E0B" : theme.surfaceAlt,
            color: filter === f.key ? "#fff" : theme.textMuted,
          }}>
            {f.label}
          </div>
        ))}
      </div>

      <SectionLabel>Daftar Laporan Uji Kedap MT</SectionLabel>
      {filteredList.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "repeat(3, 1fr)" : "1fr", gap: isDesktop ? DESKTOP_GRID_GAP : 0 }}>
          {filteredList.map((item) => (
            <Card key={item.id} style={{ marginBottom: isDesktop ? 0 : 10, padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 42, height: 42, borderRadius: 12, background: "#FEF3C7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon name="car" size={18} color="#D97706" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: theme.text }}>{item.nomor_polisi}</div>
                  <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 1 }}>
                    {item.transportir}
                  </div>
                  <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 1 }}>
                    {item.kapasitas_mt} · {item.jumlah_kompartemen} kompartemen · {item.kategori_mt === "merah_putih" ? "MT Merah Putih" : "MT Industri"}
                  </div>
                  <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 2 }}>
                    {formatDate(item.created_at)} · {formatTime(item.created_at)}
                  </div>
                </div>
                <div style={{
                  fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20, flexShrink: 0,
                  background: item.status === "selesai" ? theme.successLight : theme.dangerLight,
                  color: item.status === "selesai" ? theme.success : theme.danger,
                }}>
                  {item.status === "selesai" ? "✓ Selesai" : "⚠️ Perlu Tindak Lanjut"}
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card style={{ padding: "20px 16px", textAlign: "center" }}>
          <div style={{ fontSize: 13, color: theme.textMuted }}>Tidak ada data</div>
        </Card>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// TAB 3: Cek Random P1 (data dari inspeksi_p1, semua akun P1)
// ─────────────────────────────────────────────────────────────────────────────
const TabP1 = ({ isDesktop }) => {
  const [list, setList]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState("semua");

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("inspeksi_p1")
        .select("*, inspeksi_p1_temuan(id, judul, keterangan)")
        .order("created_at", { ascending: false });
      setList(data || []);
      setLoading(false);
    };
    loadData();
  }, []);

  const stats = {
    total:   list.length,
    perlu:   list.filter((i) => i.status !== "selesai").length,
    selesai: list.filter((i) => i.status === "selesai").length,
  };

  // Trend 7 hari
  const last7Days = [...Array(7)].map((_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const dateStr = d.toISOString().slice(0, 10);
    return {
      day: d.toLocaleDateString("id-ID", { weekday: "short" }),
      jumlah: list.filter((item) => item.created_at?.slice(0, 10) === dateStr).length,
    };
  });

  // Pie: MT Merah Putih vs MT Industri
  const merahPutih = list.filter((i) => i.kategori_mt === "merah_putih").length;
  const industri   = list.filter((i) => i.kategori_mt === "industri").length;
  const pieData = [
    merahPutih > 0 && { name: "MT Merah Putih", value: merahPutih, color: "#EF4444" },
    industri   > 0 && { name: "MT Industri",    value: industri,   color: "#3B82F6" },
  ].filter(Boolean);

  const filteredList = list.filter((item) => {
    if (filter === "semua")   return true;
    if (filter === "perlu")   return item.status !== "selesai";
    if (filter === "selesai") return item.status === "selesai";
    if (filter === "merah_putih") return item.kategori_mt === "merah_putih";
    if (filter === "industri")    return item.kategori_mt === "industri";
    return true;
  });

  if (loading) return (
    <div style={{ padding: 40, textAlign: "center", color: theme.textMuted }}>Memuat data...</div>
  );

  return (
    <div style={{ padding: isDesktop ? "24px 32px" : "20px 16px" }}>
      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: isDesktop ? DESKTOP_GRID_GAP : 8, marginBottom: 20 }}>
        <StatCard value={stats.total}   label="Total Diperiksa"      color={theme.primary} bg={theme.primaryLight} isDesktop={isDesktop} />
        <StatCard value={stats.perlu}   label="Perlu Tindak Lanjut"  color={theme.danger}  bg={theme.dangerLight}  isDesktop={isDesktop} />
        <StatCard value={stats.selesai} label="Sudah Selesai"        color={theme.success} bg={theme.successLight} isDesktop={isDesktop} />
      </div>

      {/* Charts */}
      <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "1fr 1fr" : "1fr", gap: isDesktop ? DESKTOP_GRID_GAP : 0, alignItems: "start" }}>
        {pieData.length > 0 && (
          <Card style={{ marginBottom: 20, padding: 16 }}>
            <SectionLabel style={{ marginBottom: 8 }}>Kategori MT</SectionLabel>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ width: 120, height: 120, flexShrink: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={32} outerRadius={56} paddingAngle={2}>
                      {pieData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ flex: 1 }}>
                {pieData.map((d) => (
                  <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: d.color }} />
                    <div style={{ fontSize: 12, color: theme.text, fontWeight: 600 }}>{d.name}</div>
                    <div style={{ fontSize: 12, color: theme.textMuted, marginLeft: "auto" }}>
                      {d.value} ({stats.total > 0 ? Math.round((d.value / stats.total) * 100) : 0}%)
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        )}

        <Card style={{ marginBottom: 20, padding: 16 }}>
          <SectionLabel style={{ marginBottom: 8 }}>Trend Cek Random (7 Hari Terakhir)</SectionLabel>
          <div style={{ height: 140 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={last7Days} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: theme.textMuted }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: theme.textMuted }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${theme.border}` }} />
                <Bar dataKey="jumlah" fill="#8B5CF6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Filter */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, overflowX: "auto" }}>
        {[
          { key: "semua",       label: "Semua" },
          { key: "perlu",       label: "Perlu Tindak Lanjut" },
          { key: "selesai",     label: "Selesai" },
          { key: "merah_putih", label: "MT Merah Putih" },
          { key: "industri",    label: "MT Industri" },
        ].map((f) => (
          <div key={f.key} onClick={() => setFilter(f.key)} style={{
            padding: "8px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600,
            whiteSpace: "nowrap", cursor: "pointer",
            background: filter === f.key ? "#8B5CF6" : theme.surfaceAlt,
            color: filter === f.key ? "#fff" : theme.textMuted,
          }}>
            {f.label}
          </div>
        ))}
      </div>

      <SectionLabel>Daftar Laporan Cek Random P1</SectionLabel>
      {filteredList.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "repeat(3, 1fr)" : "1fr", gap: isDesktop ? DESKTOP_GRID_GAP : 0 }}>
          {filteredList.map((item) => {
            const temuanCount = item.inspeksi_p1_temuan?.length || 0;
            return (
              <Card key={item.id} style={{ marginBottom: isDesktop ? 0 : 10, padding: "14px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 12, background: "#EDE9FE", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Icon name="car" size={18} color="#7C3AED" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: theme.text }}>{item.nomor_polisi}</div>
                    <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 1 }}>
                      {item.transportir}
                    </div>
                    <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 1 }}>
                      {item.kapasitas_mt} · {item.jumlah_kompartemen} kompartemen · {item.kategori_mt === "merah_putih" ? "MT Merah Putih" : "MT Industri"}
                    </div>
                    <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 1 }}>
                      {temuanCount} temuan · {formatDate(item.created_at)}
                    </div>
                  </div>
                  <div style={{
                    fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20, flexShrink: 0,
                    background: item.status === "selesai" ? theme.successLight : theme.dangerLight,
                    color: item.status === "selesai" ? theme.success : theme.danger,
                  }}>
                    {item.status === "selesai" ? "✓ Selesai" : "⚠️ Perlu Tindak Lanjut"}
                  </div>
                </div>

                {/* Preview temuan */}
                {temuanCount > 0 && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${theme.border}` }}>
                    {item.inspeksi_p1_temuan.slice(0, 2).map((t) => (
                      <div key={t.id} style={{ fontSize: 11, color: theme.textSub, marginBottom: 3 }}>
                        • {t.judul}
                      </div>
                    ))}
                    {temuanCount > 2 && (
                      <div style={{ fontSize: 11, color: theme.textMuted }}>+{temuanCount - 2} temuan lainnya</div>
                    )}
                  </div>
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
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN: PertaminaDashboard
// ─────────────────────────────────────────────────────────────────────────────
const PertaminaDashboard = ({ onNav, onLogout, onOpenDetail, onOpenKategori }) => {
  const isDesktop = useBreakpoint();
  const [activeTab, setActiveTab] = useState("gps");

  return (
    <div style={{ minHeight: "100vh", background: theme.bg, paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ background: theme.surface, padding: "48px 20px 0", borderBottom: `1px solid ${theme.border}`, boxShadow: theme.shadow }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 13, color: theme.textMuted }}>Selamat datang,</div>
            <div style={{ fontSize: 19, fontWeight: 800, color: theme.text }}>Pertamina</div>
            <div style={{ display: "inline-block", marginTop: 4, fontSize: 11, fontWeight: 600, padding: "2px 10px", borderRadius: 20, background: theme.primaryLight, color: theme.primary }}>
              Depot · Monitor & Audit
            </div>
          </div>
          <div onClick={onLogout} style={{ cursor: "pointer", padding: 10, borderRadius: 12, background: theme.surfaceAlt }}>
            <Icon name="logout" size={18} color={theme.textSub} />
          </div>
        </div>

        <TabBar active={activeTab} onChange={setActiveTab} />
      </div>

      {/* Tab Content */}
      {activeTab === "gps" && (
        <TabGPS
          onOpenDetail={onOpenDetail}
          onOpenKategori={onOpenKategori}
          isDesktop={isDesktop}
        />
      )}
      {activeTab === "hse" && <TabHSE isDesktop={isDesktop} />}
      {activeTab === "p1"  && <TabP1  isDesktop={isDesktop} />}

      <BottomNav active="home" onNav={onNav} role="pertamina" />
    </div>
  );
};

export default PertaminaDashboard;