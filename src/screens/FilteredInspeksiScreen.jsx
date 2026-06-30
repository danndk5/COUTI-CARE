/**
 * FilteredInspeksiScreen.jsx
 *
 * Halaman list laporan terfilter untuk teknisi (dashboard),
 * dipanggil saat klik StatCard (Total / Normal / Abnormal).
 *
 * Props:
 *   filterType: "all" | "normal" | "abnormal"
 *   onBack: () => void
 *   onOpenDetail: (id) => void
 */

import { useState, useEffect } from "react";
import Card from "../components/Card";
import Badge from "../components/Badge";
import Icon from "../components/Icon";
import SectionLabel from "../components/SectionLabel";
import theme from "../styles/theme";
import { supabase } from "../lib/supabase";
import { formatDate, formatTime } from "../lib/dateHelper";

const FilteredInspeksiScreen = ({ filterType, onBack, onOpenDetail }) => {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");

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

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      // Nama user untuk header
      const { data: profile } = await supabase
        .from("profiles")
        .select("nama")
        .eq("id", user.id)
        .single();
      setUserName(profile?.nama || "");

      // Ambil semua inspeksi milik user ini
      const { data, error } = await supabase
        .from("inspeksi")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error loading inspeksi:", error);
        setLoading(false);
        return;
      }

      const withStatus = (data || []).map((item) => ({
        ...item,
        overallStatus: isNormal(item) ? "Normal" : "Abnormal",
      }));

      const filtered =
        filterType === "normal"
          ? withStatus.filter((i) => i.overallStatus === "Normal")
          : filterType === "abnormal"
          ? withStatus.filter((i) => i.overallStatus === "Abnormal")
          : withStatus; // "all"

      setList(filtered);
      setLoading(false);
    };

    loadData();
  }, [filterType]);

  // ── Judul ──────────────────────────────────────────────────────────────────
  const getTitle = () => {
    if (filterType === "normal") return "✅ Pengecekan Normal";
    if (filterType === "abnormal") return "⚠️ Pengecekan Abnormal";
    return "📋 Semua Pengecekan";
  };

  const getSubtitle = () => {
    if (loading) return "Memuat data...";
    return `${list.length} laporan ditemukan`;
  };

  // ── Warna aksen header ─────────────────────────────────────────────────────
  const accentColor =
    filterType === "normal"
      ? theme.success
      : filterType === "abnormal"
      ? theme.danger
      : theme.primary;

  const accentBg =
    filterType === "normal"
      ? theme.successLight
      : filterType === "abnormal"
      ? theme.dangerLight
      : theme.primaryLight;

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
    <div style={{ minHeight: "100vh", background: theme.bg, paddingBottom: 32 }}>
      {/* Header */}
      <div
        style={{
          background: theme.surface,
          padding: "48px 20px 16px",
          borderBottom: `1px solid ${theme.border}`,
          boxShadow: theme.shadow,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
          <div
            onClick={onBack}
            style={{
              cursor: "pointer",
              padding: "6px 10px",
              borderRadius: 10,
              background: theme.surfaceAlt,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="arrow" size={18} color={theme.textSub} />
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: theme.text }}>
              {getTitle()}
            </div>
            <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>
              {getSubtitle()}
            </div>
          </div>
        </div>

        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            marginTop: 4,
            padding: "4px 12px",
            borderRadius: 20,
            background: accentBg,
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 700, color: accentColor }}>
            {filterType === "all"
              ? "Semua laporan"
              : filterType === "normal"
              ? "Status Normal"
              : "Status Abnormal"}
          </span>
        </div>
      </div>

      {/* List */}
      <div style={{ padding: "20px 16px" }}>
        {list.length === 0 ? (
          <Card style={{ padding: "28px 16px", textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: theme.text, marginBottom: 4 }}>
              Tidak ada laporan
            </div>
            <div style={{ fontSize: 12, color: theme.textMuted }}>
              Tidak ada data untuk kategori ini
            </div>
          </Card>
        ) : (
          <>
            <SectionLabel style={{ marginBottom: 12 }}>Daftar Laporan</SectionLabel>
            {list.map((item) => (
              <Card
                key={item.id}
                onClick={() => onOpenDetail(item.id)}
                style={{ marginBottom: 10, padding: "14px 16px", cursor: "pointer" }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 12,
                        background: theme.primaryLight,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <Icon name="car" size={18} color={theme.primary} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: theme.text }}>
                        {item.nomor_polisi}
                      </div>
                      <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 1 }}>
                        {item.nama_armada}
                      </div>
                      <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 2 }}>
                        {formatDate(item.created_at)} · {formatTime(item.created_at)}
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-end",
                      gap: 6,
                      flexShrink: 0,
                    }}
                  >
                    <Badge status={item.overallStatus} />
                    <Icon name="chevron" size={14} color={theme.textMuted} />
                  </div>
                </div>
              </Card>
            ))}
          </>
        )}
      </div>
    </div>
  );
};

export default FilteredInspeksiScreen;