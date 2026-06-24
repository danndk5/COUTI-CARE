import { useState, useEffect } from "react";
import Card from "../components/Card";
import Icon from "../components/Icon";
import SectionLabel from "../components/SectionLabel";
import theme from "../styles/theme";
import { supabase } from "../lib/supabase";
import { formatDate } from "../lib/dateHelper";

const RiwayatKerusakanScreen = ({ onBack }) => {
  const [groupedData, setGroupedData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchPlat, setSearchPlat] = useState("");
  const [expandedPlat, setExpandedPlat] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from("inspeksi")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error loading riwayat kerusakan:", error);
        setLoading(false);
        return;
      }

      if (data) {
        // Filter hanya yang ada temuan abnormal (riwayat kerusakan)
        const withAbnormalDetail = data
          .map((item) => {
            const gpsStatus =
              item.segel_gps?.toLowerCase() === "abnormal" ||
              item.kabel_gps?.toLowerCase() === "abnormal"
                ? "Error GPS"
                : "Normal";

            const cctvAbnormalParts = [];
            if (item.segel_bricket_dashcam?.toLowerCase() === "abnormal" || item.segel_kabel_dashcam?.toLowerCase() === "abnormal")
              cctvAbnormalParts.push("Dashcam");
            if (item.segel_bricket_kanan?.toLowerCase() === "abnormal" || item.segel_kabel_kanan?.toLowerCase() === "abnormal")
              cctvAbnormalParts.push("Kanan");
            if (item.segel_bricket_kiri?.toLowerCase() === "abnormal" || item.segel_kabel_kiri?.toLowerCase() === "abnormal")
              cctvAbnormalParts.push("Kiri");

            const cctvStatus =
              cctvAbnormalParts.length > 0
                ? `CCTV ${cctvAbnormalParts.join(", ")} Bermasalah`
                : "Normal";

            const isAbnormal = gpsStatus !== "Normal" || cctvStatus !== "Normal";

            return {
              id: item.id,
              nomor_polisi: item.nomor_polisi,
              nama_armada: item.nama_armada,
              gpsStatus,
              cctvStatus,
              tanggal: item.created_at,
              isAbnormal,
            };
          })
          .filter((item) => item.isAbnormal); // hanya yang ada kerusakan

        // Group by nomor_polisi
        const grouped = {};
        withAbnormalDetail.forEach((item) => {
          if (!grouped[item.nomor_polisi]) {
            grouped[item.nomor_polisi] = {
              nomor_polisi: item.nomor_polisi,
              nama_armada: item.nama_armada,
              riwayat: [],
            };
          }
          grouped[item.nomor_polisi].riwayat.push(item);
        });

        // Urutkan berdasarkan jumlah kerusakan terbanyak
        const groupedArray = Object.values(grouped).sort(
          (a, b) => b.riwayat.length - a.riwayat.length
        );

        setGroupedData(groupedArray);
      }

      setLoading(false);
    };

    loadData();
  }, []);

  const filteredData = groupedData.filter((g) =>
    searchPlat
      ? g.nomor_polisi?.toLowerCase().includes(searchPlat.toLowerCase())
      : true
  );

  return (
    <div style={{ minHeight: "100vh", background: theme.bg, paddingBottom: 40 }}>
      {/* Header */}
      <div
        style={{
          background: theme.surface,
          padding: "48px 16px 16px",
          borderBottom: `1px solid ${theme.border}`,
          boxShadow: theme.shadow,
        }}
      >
        <div
          onClick={onBack}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginBottom: 14,
            cursor: "pointer",
            color: theme.textSub,
            fontSize: 13,
          }}
        >
          <Icon name="arrow" size={16} color={theme.textSub} /> Kembali
        </div>
        <div style={{ fontWeight: 800, fontSize: 18, color: theme.text, marginBottom: 4 }}>
          Riwayat Kerusakan
        </div>
        <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 14 }}>
          Histori temuan abnormal per unit armada
        </div>

        <input
          placeholder="Cari nomor polisi..."
          value={searchPlat}
          onChange={(e) => setSearchPlat(e.target.value)}
          style={{
            width: "100%",
            padding: "9px 12px",
            borderRadius: 10,
            border: `1.5px solid ${theme.border}`,
            background: theme.surface,
            color: theme.text,
            fontSize: 13,
            fontFamily: "'DM Sans', sans-serif",
            outline: "none",
            boxSizing: "border-box",
          }}
        />
      </div>

      <div style={{ padding: "16px" }}>
        {loading ? (
          <Card style={{ padding: "20px 16px", textAlign: "center" }}>
            <div style={{ fontSize: 13, color: theme.textMuted }}>Memuat data...</div>
          </Card>
        ) : filteredData.length > 0 ? (
          filteredData.map((g) => {
            const isExpanded = expandedPlat === g.nomor_polisi;
            return (
              <Card key={g.nomor_polisi} style={{ marginBottom: 10, padding: 0, overflow: "hidden" }}>
                {/* Header card - klik untuk expand */}
                <div
                  onClick={() =>
                    setExpandedPlat(isExpanded ? null : g.nomor_polisi)
                  }
                  style={{
                    padding: "14px 16px",
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 12,
                        background: theme.dangerLight,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Icon name="car" size={17} color={theme.danger} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: theme.text }}>
                        {g.nomor_polisi}
                      </div>
                      <div style={{ fontSize: 11, color: theme.textMuted }}>
                        {g.nama_armada}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: theme.danger,
                        background: theme.dangerLight,
                        padding: "3px 10px",
                        borderRadius: 20,
                      }}
                    >
                      {g.riwayat.length}x masalah
                    </div>
                    <Icon
                      name="chevron"
                      size={14}
                      color={theme.textMuted}
                      style={{ transform: isExpanded ? "rotate(90deg)" : "none" }}
                    />
                  </div>
                </div>

                {/* Detail table - tampil saat expanded */}
                {isExpanded && (
                  <div style={{ borderTop: `1px solid ${theme.border}` }}>
                    <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ background: theme.surfaceAlt }}>
                          <th style={{ padding: "8px 10px", textAlign: "left", color: theme.textMuted, fontWeight: 600 }}>
                            GPS
                          </th>
                          <th style={{ padding: "8px 10px", textAlign: "left", color: theme.textMuted, fontWeight: 600 }}>
                            CCTV
                          </th>
                          <th style={{ padding: "8px 10px", textAlign: "right", color: theme.textMuted, fontWeight: 600 }}>
                            Tanggal
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {g.riwayat.map((r) => (
                          <tr key={r.id} style={{ borderTop: `1px solid ${theme.border}` }}>
                            <td
                              style={{
                                padding: "8px 10px",
                                color: r.gpsStatus !== "Normal" ? theme.danger : theme.textMuted,
                                fontWeight: r.gpsStatus !== "Normal" ? 600 : 400,
                              }}
                            >
                              {r.gpsStatus}
                            </td>
                            <td
                              style={{
                                padding: "8px 10px",
                                color: r.cctvStatus !== "Normal" ? theme.danger : theme.textMuted,
                                fontWeight: r.cctvStatus !== "Normal" ? 600 : 400,
                              }}
                            >
                              {r.cctvStatus}
                            </td>
                            <td style={{ padding: "8px 10px", textAlign: "right", color: theme.textMuted }}>
                              {formatDate(r.tanggal)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            );
          })
        ) : (
          <Card style={{ padding: "20px 16px", textAlign: "center" }}>
            <div style={{ fontSize: 13, color: theme.textMuted }}>
              Belum ada riwayat kerusakan
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default RiwayatKerusakanScreen;