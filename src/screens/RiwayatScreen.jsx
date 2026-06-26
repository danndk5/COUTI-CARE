import { useState, useEffect, useCallback } from "react";
import Badge from "../components/Badge";
import BottomNav from "../components/BottomNav";
import Btn from "../components/Btn";
import Card from "../components/Card";
import theme from "../styles/theme";
import { supabase } from "../lib/supabase";
import { formatDate, formatTime } from "../lib/dateHelper";
import { getStatusFromInspeksi } from "../lib/inspeksiHelper";
import { useBreakpoint } from "../hooks/useBreakpoint";
import { DESKTOP_GRID_GAP } from "../styles/layout";

const RiwayatScreen = ({ role, onNav, onOpenDetail }) => {
  const isDesktop = useBreakpoint();

  const [filterDate, setFilterDate] = useState("");
  const [filterPlat, setFilterPlat] = useState("");
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const isTransportir = role === "transportir";

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;

      if (!user) {
        setError("Sesi tidak ditemukan. Silakan login ulang.");
        return;
      }

      let query = supabase.from("inspeksi").select("*");

      if (isTransportir) {
        query = query.eq("user_id", user.id);
      }

      const { data: inspeksiData, error: fetchError } = await query.order(
        "created_at",
        { ascending: false }
      );

      if (fetchError) throw fetchError;

      const mapped = (inspeksiData ?? []).map((item) => ({
        id: item.id,
        plat: item.nomor_polisi,
        armada: item.nama_armada,
        pemeriksa: item.nama_pemeriksa,
        perusahaan: item.perusahaan_transportir,
        tanggal: item.created_at,
        status: getStatusFromInspeksi(item),
      }));

      setData(mapped);
    } catch (err) {
      setError("Gagal memuat data. Silakan coba lagi.");
      console.error("Error loading riwayat:", err);
    } finally {
      setLoading(false);
    }
  }, [isTransportir]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredData = data.filter((d) => {
    const matchDate = filterDate
      ? formatDateLocal(d.tanggal) === filterDate
      : true;
    const matchPlat = filterPlat
      ? d.plat?.toLowerCase().includes(filterPlat.toLowerCase())
      : true;
    return matchDate && matchPlat;
  });

  return (
    <div style={{ minHeight: "100vh", background: theme.bg, paddingBottom: 80 }}>
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
          style={{ fontWeight: 800, fontSize: 20, color: theme.text, marginBottom: 14 }}
        >
          Riwayat
        </div>
        <div style={{
          display: "flex",
          gap: 8,
          flexWrap: isDesktop ? "nowrap" : "nowrap",
        }}>
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            style={{
              flex: isDesktop ? "0 0 auto" : 1,
              width: isDesktop ? 180 : undefined,
              padding: "9px 12px",
              borderRadius: 10,
              border: `1.5px solid ${theme.border}`,
              background: theme.surface,
              color: theme.text,
              fontSize: 12,
              fontFamily: "'DM Sans', sans-serif",
              outline: "none",
            }}
          />
          <input
            placeholder="Cari plat..."
            value={filterPlat}
            onChange={(e) => setFilterPlat(e.target.value)}
            style={{
              flex: isDesktop ? "0 0 auto" : 1,
              width: isDesktop ? 200 : undefined,
              padding: "9px 12px",
              borderRadius: 10,
              border: `1.5px solid ${theme.border}`,
              background: theme.surface,
              color: theme.text,
              fontSize: 12,
              fontFamily: "'DM Sans', sans-serif",
              outline: "none",
            }}
          />
        </div>
        {(filterDate || filterPlat) && (
          <div
            onClick={() => {
              setFilterDate("");
              setFilterPlat("");
            }}
            style={{
              marginTop: 10,
              fontSize: 12,
              color: theme.primary,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            ✕ Hapus filter
          </div>
        )}
      </div>

      {/* List */}
      <div style={{ padding: isDesktop ? "20px 32px" : "16px" }}>
        {loading ? (
          <Card style={{ padding: "20px 16px", textAlign: "center" }}>
            <div style={{ fontSize: 13, color: theme.textMuted }}>Memuat data...</div>
          </Card>
        ) : error ? (
          <Card style={{ padding: "20px 16px", textAlign: "center" }}>
            <div style={{ fontSize: 13, color: theme.danger ?? "#e53e3e", marginBottom: 12 }}>
              ⚠️ {error}
            </div>
            <Btn onClick={loadData} variant="ghost" style={{ fontSize: 12 }}>
              Coba Lagi
            </Btn>
          </Card>
        ) : filteredData.length > 0 ? (
          <div style={{
            display: "grid",
            gridTemplateColumns: isDesktop ? "repeat(3, 1fr)" : "1fr",
            gap: isDesktop ? DESKTOP_GRID_GAP : 0,
          }}>
            {filteredData.map((d) => (
              <Card key={d.id} style={{ marginBottom: isDesktop ? 0 : 10 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: 10,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: theme.text }}>
                      {d.plat}
                    </div>
                    <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>
                      {d.armada}
                    </div>
                    <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 3 }}>
                      👤 {d.pemeriksa} · {d.perusahaan}
                    </div>
                    <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 2 }}>
                      {formatDate(d.tanggal)} · {formatTime(d.tanggal)}
                    </div>
                  </div>
                  <Badge status={d.status} />
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    borderTop: `1px solid ${theme.border}`,
                    paddingTop: 10,
                  }}
                >
                  <Btn
                    onClick={() => onOpenDetail(d.id)}
                    variant="ghost"
                    icon="eye"
                    style={{ fontSize: 12, padding: "8px", flex: 1 }}
                  >
                    Lihat Detail
                  </Btn>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card style={{ padding: "20px 16px", textAlign: "center" }}>
            <div style={{ fontSize: 13, color: theme.textMuted }}>
              {filterDate || filterPlat
                ? "Tidak ada data sesuai filter"
                : "Belum ada riwayat inspeksi"}
            </div>
          </Card>
        )}
      </div>

      <BottomNav active="history" onNav={onNav} role={role} />
    </div>
  );
};

/**
 * FIX timezone bug: ambil bagian tanggal (YYYY-MM-DD) sesuai zona lokal browser,
 * bukan UTC. Dengan toISOString() tanggal bisa "mundur" 1 hari untuk WIB (UTC+7).
 *
 * Contoh: "2025-01-15T00:30:00+07:00" → toISOString() → "2025-01-14T17:30:00Z"
 * → slice(0,10) → "2025-01-14" (SALAH), padahal lokal → "2025-01-15" (BENAR)
 */
const formatDateLocal = (isoString) => {
  const d = new Date(isoString);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export default RiwayatScreen;