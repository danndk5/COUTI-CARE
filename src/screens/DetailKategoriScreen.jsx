/**
 * DetailKategoriScreen.jsx
 *
 * Halaman detail yang muncul ketika Pertamina mengklik:
 *  - Segmen pie chart (Baik / Perlu Perhatian / Kritis)  → props: filterType="health", filterValue="Baik"|"Perlu Perhatian"|"Kritis"
 *  - Bar chart tanggal tertentu                          → props: filterType="date",   filterValue="2025-06-01"
 *  - StatCard Total/Abnormal/Proses/Selesai              → props: filterType="status", filterValue="total"|"abnormal"|"ditugaskan"|"selesai"
 *
 * Tidak mengubah App.jsx secara langsung — lihat catatan di bawah tentang
 * bagian App.jsx yang PERLU ditambahkan.
 */

import { useState, useEffect } from "react";
import Card from "../components/Card";
import Badge from "../components/Badge";
import Icon from "../components/Icon";
import SectionLabel from "../components/SectionLabel";
import theme from "../styles/theme";
import { supabase } from "../lib/supabase";
import { calculateHealthScore, getHealthStatus } from "../lib/healthScore";
import { formatDate, formatTime } from "../lib/dateHelper";

const HEALTH_CATEGORY_COLORS = {
  Baik: "#10B981",
  "Perlu Perhatian": "#F59E0B",
  Kritis: "#EF4444",
};

const HEALTH_EMOJI = {
  Baik: "🟢",
  "Perlu Perhatian": "🟡",
  Kritis: "🔴",
};

const DetailKategoriScreen = ({ filterType, filterValue, onBack, onOpenDetail }) => {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);

      let query = supabase
        .from("inspeksi")
        .select("*")
        .order("created_at", { ascending: false });

      // Untuk filter tanggal, batasi query di sisi Supabase langsung
      if (filterType === "date" && filterValue) {
        const dateStart = `${filterValue}T00:00:00`;
        const dateEnd   = `${filterValue}T23:59:59`;
        query = query.gte("created_at", dateStart).lte("created_at", dateEnd);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error loading detail kategori:", error);
        setLoading(false);
        return;
      }

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

      const withMeta = (data || []).map((item) => {
        const health = calculateHealthScore(item);
        const healthCategory = getHealthStatus(health.overall).label;
        return {
          ...item,
          overallStatus: isNormal(item) ? "Normal" : "Abnormal",
          health,
          healthCategory,
        };
      });

      // Filter tambahan di sisi client untuk kategori health & status
      let filtered = withMeta;
      if (filterType === "health") {
        filtered = withMeta.filter((i) => i.healthCategory === filterValue);
      } else if (filterType === "status") {
        if (filterValue === "abnormal") {
          filtered = withMeta.filter((i) => i.overallStatus === "Abnormal");
        } else if (filterValue === "ditugaskan" || filterValue === "selesai") {
          filtered = withMeta.filter((i) => i.status === filterValue);
        }
        // filterValue === "total" → tidak difilter, tampilkan semua
      }
      // filterType === "date" sudah difilter lewat query Supabase di atas

      setList(filtered);
      setLoading(false);
    };

    loadData();
  }, [filterType, filterValue]);

  // ── Judul halaman ──────────────────────────────────────────────────────────
  const STATUS_TITLES = {
    total: "📋 Semua Laporan",
    abnormal: "⚠️ Laporan Abnormal",
    ditugaskan: "🔧 Sedang Diperbaiki",
    selesai: "✅ Selesai Diperbaiki",
  };

  const getTitle = () => {
    if (filterType === "health") {
      return `${HEALTH_EMOJI[filterValue] || ""} Armada ${filterValue}`;
    }
    if (filterType === "date") {
      // format filterValue (YYYY-MM-DD) → "1 Jun 2025"
      const d = new Date(`${filterValue}T00:00:00`);
      const label = d.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
      return `📅 Inspeksi ${label}`;
    }
    if (filterType === "status") {
      return STATUS_TITLES[filterValue] || "Detail Laporan";
    }
    return "Detail Laporan";
  };

  const getSubtitle = () => {
    if (loading) return "Memuat data...";
    return `${list.length} laporan ditemukan`;
  };

  // ── Render ─────────────────────────────────────────────────────────────────
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
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
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

        {/* Indikator warna kategori (hanya untuk filter health) */}
        {filterType === "health" && filterValue && (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              marginTop: 8,
              padding: "4px 12px",
              borderRadius: 20,
              background: filterValue === "Baik"
                ? "#D1FAE5"
                : filterValue === "Perlu Perhatian"
                ? "#FEF3C7"
                : "#FEE2E2",
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: HEALTH_CATEGORY_COLORS[filterValue],
              }}
            />
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: HEALTH_CATEGORY_COLORS[filterValue],
              }}
            >
              {filterValue}
            </span>
          </div>
        )}

        {/* Indikator warna kategori (hanya untuk filter status) */}
        {filterType === "status" && filterValue && filterValue !== "total" && (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              marginTop: 8,
              padding: "4px 12px",
              borderRadius: 20,
              background:
                filterValue === "abnormal"
                  ? theme.dangerLight
                  : filterValue === "ditugaskan"
                  ? "#FEF3C7"
                  : theme.successLight,
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color:
                  filterValue === "abnormal"
                    ? theme.danger
                    : filterValue === "ditugaskan"
                    ? "#F59E0B"
                    : theme.success,
              }}
            >
              {filterValue === "abnormal"
                ? "Abnormal"
                : filterValue === "ditugaskan"
                ? "Proses"
                : "Selesai"}
            </span>
          </div>
        )}
      </div>

      {/* Daftar laporan */}
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
            {list.map((item) => {
              const healthStatus = getHealthStatus(item.health.overall);
              return (
                <Card
                  key={item.id}
                  onClick={() => onOpenDetail(item.id)}
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
                    }}
                  >
                    {/* Info kiri */}
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
                          {item.perusahaan_transportir
                            ? ` · ${item.perusahaan_transportir}`
                            : ""}
                        </div>
                        <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 2 }}>
                          {formatDate(item.created_at)} · {formatTime(item.created_at)}
                        </div>
                        {item.nama_pemeriksa && (
                          <div style={{ fontSize: 11, color: theme.textMuted }}>
                            Diperiksa: {item.nama_pemeriksa}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Info kanan */}
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
                      {/* Health score badge */}
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: 10,
                          background: healthStatus.bg,
                          color: healthStatus.color,
                        }}
                      >
                        {item.health.overall}%
                      </div>
                      <Icon name="chevron" size={14} color={theme.textMuted} />
                    </div>
                  </div>

                  {/* Status perbaikan (kalau ada) */}
                  {item.status === "ditugaskan" && (
                    <div
                      style={{
                        marginTop: 10,
                        fontSize: 11,
                        fontWeight: 600,
                        color: "#F59E0B",
                        background: "#FEF3C7",
                        padding: "5px 10px",
                        borderRadius: 8,
                      }}
                    >
                      🔧 Sedang diperbaiki
                    </div>
                  )}
                  {item.status === "selesai" && (
                    <div
                      style={{
                        marginTop: 10,
                        fontSize: 11,
                        fontWeight: 600,
                        color: theme.success,
                        background: theme.successLight,
                        padding: "5px 10px",
                        borderRadius: 8,
                      }}
                    >
                      ✓ Perbaikan selesai
                    </div>
                  )}
                </Card>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
};

export default DetailKategoriScreen;