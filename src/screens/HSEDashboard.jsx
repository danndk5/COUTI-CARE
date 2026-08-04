import { useState, useEffect, useMemo } from "react";
import BottomNav from "../components/BottomNav";
import Card from "../components/Card";
import Icon from "../components/Icon";
import SectionLabel from "../components/SectionLabel";
import ThemeToggle from "../components/ThemeToggle";
import { useTheme } from "../context/ThemeContext";
import { supabase } from "../lib/supabase";

// Lebar tampilan dikunci seukuran HP — role ini cuma dipakai di ponsel
const FRAME_WIDTH = 430;

// ── Helper: label & warna status ──────────────────────────────────────────────
const statusInfo = (status, theme) => {
  if (status === "tidak_lulus") return { label: "Perlu Tindak Lanjut", bg: theme.dangerLight,  color: theme.danger };
  if (status === "selesai")     return { label: "Selesai",             bg: theme.successLight, color: theme.success };
  if (status === "lulus")       return { label: "Lulus",               bg: theme.successLight, color: theme.success };
  return { label: status || "-", bg: theme.surfaceAlt, color: theme.textMuted };
};

// ── Helper: hitung batas tanggal awal berdasarkan periode filter ──────────────
// Kalender, bukan rolling — "Minggu Ini" mulai dari Senin minggu berjalan,
// "Bulan Ini" mulai dari tanggal 1 bulan berjalan, "6 Bulan Ini" mulai dari
// tanggal 1, 6 bulan ke belakang (termasuk bulan berjalan).
const getRangeStart = (mode) => {
  const now = new Date();

  if (mode === "minggu") {
    const day = now.getDay(); // 0 = Minggu, 1 = Senin, ...
    const diffKeSenin = day === 0 ? 6 : day - 1;
    const start = new Date(now);
    start.setDate(now.getDate() - diffKeSenin);
    start.setHours(0, 0, 0, 0);
    return start;
  }
  if (mode === "bulan") {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }
  if (mode === "6bulan") {
    return new Date(now.getFullYear(), now.getMonth() - 5, 1);
  }
  return null; // "semua"
};

const FILTER_OPTIONS = [
  { value: "semua",  label: "Semua"        },
  { value: "minggu", label: "Minggu Ini"   },
  { value: "bulan",  label: "Bulan Ini"    },
  { value: "6bulan", label: "6 Bulan Ini"  },
  { value: "custom", label: "Kustom"       },
];

// ── Helper: sisa hari sampai tanggal tertentu (negatif = sudah lewat) ─────────
const sisaHari = (tanggal) => {
  if (!tanggal) return null;
  const target = new Date(tanggal);
  target.setHours(0, 0, 0, 0);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((target - now) / (1000 * 60 * 60 * 24));
};

const formatTanggalSingkat = (val) => {
  if (!val) return "-";
  try { return new Date(val).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }); }
  catch { return val; }
};

// ── ExpiryBanner — peringatan masa berlaku Head Truck / Tangki ────────────────
const ExpiryBanner = ({ theme, items, onClick }) => {
  if (items.length === 0) return null;

  return (
    <div
      onClick={onClick}
      style={{
        marginBottom: 20, padding: "14px 16px", borderRadius: 14, cursor: "pointer",
        background: theme.dangerLight, border: `1.5px solid ${theme.danger}`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 18 }}>⚠️</span>
        <div style={{ fontWeight: 700, fontSize: 13, color: theme.danger }}>
          {items.length} Kendaraan Perlu Perhatian Masa Berlaku
        </div>
      </div>
      {items.slice(0, 3).map((k) => (
        <div key={k.nomor_polisi + k._jenis} style={{ fontSize: 12, color: theme.danger, marginBottom: 3 }}>
          • {k.nomor_polisi} — {k._jenis} {k._sisaHari < 0 ? `sudah lewat ${Math.abs(k._sisaHari)} hari` : `${k._sisaHari} hari lagi`}
        </div>
      ))}
      {items.length > 3 && (
        <div style={{ fontSize: 11, color: theme.danger, marginTop: 4, fontWeight: 600 }}>
          +{items.length - 3} kendaraan lainnya — ketuk untuk lihat semua
        </div>
      )}
    </div>
  );
};

// ── ExpiryListModal — daftar lengkap kendaraan yang perlu perhatian ───────────
const ExpiryListModal = ({ theme, items, onClose }) => (
  <div
    onClick={onClose}
    style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 999,
      display: "flex", alignItems: "flex-end", justifyContent: "center",
    }}
  >
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        width: "100%", maxWidth: FRAME_WIDTH, maxHeight: "80vh", overflowY: "auto",
        background: theme.surface, borderRadius: "20px 20px 0 0", padding: 20,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontWeight: 800, fontSize: 16, color: theme.text }}>Masa Berlaku Perlu Perhatian</div>
        <div onClick={onClose} style={{ cursor: "pointer", fontSize: 18, color: theme.textMuted }}>✕</div>
      </div>
      {items.map((k) => (
        <div key={k.nomor_polisi + k._jenis} style={{
          marginBottom: 10, padding: "10px 12px", borderRadius: 10,
          background: k._sisaHari < 0 ? theme.dangerLight : "#FEF3C7",
        }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: theme.text }}>{k.nomor_polisi}</div>
          <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>
            {k._jenis} — berlaku sampai {formatTanggalSingkat(k._tanggal)}
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, marginTop: 3, color: k._sisaHari < 0 ? theme.danger : "#D97706" }}>
            {k._sisaHari < 0 ? `⛔ Sudah lewat ${Math.abs(k._sisaHari)} hari` : `⏳ ${k._sisaHari} hari lagi`}
          </div>
        </div>
      ))}
    </div>
  </div>
);

// ── FilterBar ──────────────────────────────────────────────────────────────
// Helper: deteksi apakah latar tema saat ini gelap (dari luminance theme.bg),
// dipakai untuk memaksa color-scheme pada <input type="date"> supaya ikon
// kalender & teks placeholder-nya ikut terang saat mode gelap aktif —
// browser secara default merender ikon itu gelap dan nyaris tak terlihat
// di atas latar gelap kalau color-scheme tidak diset.
const getIsDarkBg = (hex) => {
  if (!hex || hex[0] !== "#" || hex.length < 7) return false;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.5;
};

const FilterBar = ({ theme, filterMode, setFilterMode, customStart, setCustomStart, customEnd, setCustomEnd }) => {
  const isDarkBg = getIsDarkBg(theme.bg);
  const dateInputStyle = {
    width: "100%", padding: "8px 10px", borderRadius: 8, border: `1.5px solid ${theme.border}`,
    background: theme.surfaceAlt || theme.surface, color: theme.text, fontSize: 12, boxSizing: "border-box",
    fontFamily: "'DM Sans', sans-serif", outline: "none",
    colorScheme: isDarkBg ? "dark" : "light",
  };

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
        {FILTER_OPTIONS.map((opt) => (
          <div
            key={opt.value}
            onClick={() => setFilterMode(opt.value)}
            style={{
              flexShrink: 0, padding: "7px 14px", borderRadius: 20, cursor: "pointer",
              fontSize: 12, fontWeight: 700, whiteSpace: "nowrap",
              background: filterMode === opt.value ? theme.primary : theme.surface,
              color: filterMode === opt.value ? "#fff" : theme.textMuted,
              border: `1.5px solid ${filterMode === opt.value ? theme.primary : theme.border}`,
            }}
          >
            {opt.label}
          </div>
        ))}
      </div>

      {filterMode === "custom" && (
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 4 }}>Dari</div>
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              style={dateInputStyle}
            />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 4 }}>Sampai</div>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              style={dateInputStyle}
            />
          </div>
        </div>
      )}
    </div>
  );
};

// ── SearchBar — cari cepat nomor polisi dari beranda ──────────────────────────
const SearchBar = ({ theme, value, onChange }) => (
  <div style={{
    display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 12,
    background: theme.surface, border: `1px solid ${theme.border}`, marginBottom: 20,
  }}>
    <Icon name="search" size={16} color={theme.textMuted} />
    <input
      type="text"
      placeholder="Cari nomor polisi..."
      value={value}
      onChange={(e) => onChange(e.target.value.toUpperCase())}
      style={{
        flex: 1, border: "none", outline: "none", background: "transparent",
        color: theme.text, fontSize: 13, fontFamily: "'DM Sans', sans-serif",
      }}
    />
    {value && (
      <div onClick={() => onChange("")} style={{ cursor: "pointer", color: theme.textMuted, fontSize: 14 }}>✕</div>
    )}
  </div>
);

// ── TrendChart — grafik batang Lulus vs Tidak Lulus per bulan ─────────────────
const TrendChart = ({ theme, data }) => {
  if (data.length === 0) return null;
  const maxVal = Math.max(1, ...data.map((d) => Math.max(d.lulus, d.tidakLulus)));

  return (
    <div style={{ marginBottom: 28, padding: 16, borderRadius: 14, background: theme.surface, border: `1px solid ${theme.border}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: theme.text }}>📊 Tren Lulus vs Tidak Lulus</div>
        <div style={{ display: "flex", gap: 12, fontSize: 11, fontWeight: 600 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 9, height: 9, borderRadius: 2, background: theme.success, flexShrink: 0 }} />
            <span style={{ color: theme.text }}>Lulus</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 9, height: 9, borderRadius: 2, background: theme.danger, flexShrink: 0 }} />
            <span style={{ color: theme.text }}>Tidak Lulus</span>
          </div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 100 }}>
        {data.map((d) => (
          <div key={d.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%", justifyContent: "flex-end" }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: "100%" }}>
              <div style={{
                width: 10, borderRadius: "3px 3px 0 0", background: theme.success,
                height: `${(d.lulus / maxVal) * 100}%`, minHeight: d.lulus > 0 ? 3 : 0,
              }} title={`Lulus: ${d.lulus}`} />
              <div style={{
                width: 10, borderRadius: "3px 3px 0 0", background: theme.danger,
                height: `${(d.tidakLulus / maxVal) * 100}%`, minHeight: d.tidakLulus > 0 ? 3 : 0,
              }} title={`Tidak Lulus: ${d.tidakLulus}`} />
            </div>
            <div style={{ fontSize: 10, fontWeight: 600, color: theme.textMuted, marginTop: 6, textAlign: "center" }}>{d.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── StatCard ─────────────────────────────────────────────────────────────────
const StatCard = ({ value, label, bg, color, onClick }) => (
  <div
    onClick={onClick}
    style={{
      background: bg, borderRadius: 14, padding: "18px 10px",
      textAlign: "center", cursor: "pointer", flex: 1,
      boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
    }}
  >
    <div style={{ fontSize: 28, fontWeight: 800, color }}>{value}</div>
    <div style={{ fontSize: 10, color, fontWeight: 600, marginTop: 4, opacity: 0.85, lineHeight: 1.3 }}>
      {label}
    </div>
  </div>
);

// ── InspeksiList ──────────────────────────────────────────────────────────────
const InspeksiList = ({ title, items, onBack, theme }) => (
  <div style={{ minHeight: "100vh", background: theme.bg }}>
    <div style={{ maxWidth: FRAME_WIDTH, margin: "0 auto" }}>
      <div style={{ background: theme.surface, padding: "48px 16px 16px", borderBottom: `1px solid ${theme.border}`, boxShadow: theme.shadow }}>
        <div onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14, cursor: "pointer", color: theme.textSub, fontSize: 13 }}>
          <Icon name="arrow" size={16} color={theme.textSub} /> Kembali
        </div>
        <div style={{ fontWeight: 800, fontSize: 18, color: theme.text }}>{title}</div>
        <div style={{ fontSize: 13, color: theme.textMuted, marginTop: 2 }}>{items.length} kendaraan</div>
      </div>
      <div style={{ padding: "20px 16px", paddingBottom: 40 }}>
        {items.length === 0 ? (
          <Card style={{ padding: 32, textAlign: "center", background: theme.surface, borderColor: theme.border }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
            <div style={{ fontSize: 14, color: theme.textMuted }}>Belum ada data</div>
          </Card>
        ) : (
          items.map((insp) => {
            const si = statusInfo(insp.status, theme);
            return (
              <Card key={insp.id} style={{ marginBottom: 12, padding: "14px 16px", background: theme.surface, borderColor: theme.border }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 12, background: theme.primaryLight,
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}>
                    <Icon name="car" size={20} color={theme.primary} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: theme.text }}>{insp.nomor_polisi}</div>
                    <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>{insp.transportir}</div>
                    <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 1 }}>
                      {insp.kapasitas_mt} · {insp.jumlah_kompartemen} kompartemen · {insp.kategori_mt === "merah_putih" ? "MT Merah Putih" : "MT Industri"}
                    </div>
                    <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 1 }}>
                      {new Date(insp.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                    </div>
                  </div>
                  <div style={{
                    fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20,
                    background: si.bg, color: si.color,
                  }}>
                    {si.label}
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  </div>
);

// ── HSEDashboard ──────────────────────────────────────────────────────────────
const HSEDashboard = ({ role, onNav, onLogout }) => {
  const { theme } = useTheme();
  const [view,        setView]        = useState("dashboard");
  const [currentUser, setCurrentUser] = useState(null);
  const [inspeksiAll, setInspeksiAll] = useState([]);
  const [loading,     setLoading]     = useState(true);

  // Filter periode — mempengaruhi angka & daftar di beranda
  const [filterMode,   setFilterMode]   = useState("semua");
  const [customStart,  setCustomStart]  = useState("");
  const [customEnd,    setCustomEnd]    = useState("");

  // Cari nomor polisi cepat
  const [searchQuery, setSearchQuery] = useState("");

  // Peringatan masa berlaku Head Truck / Tangki
  const [expiryItems,     setExpiryItems]     = useState([]);
  const [showExpiryModal, setShowExpiryModal] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: profile } = await supabase
        .from("profiles").select("nama, perusahaan").eq("id", user.id).single();
      setCurrentUser(profile);

      const { data: inspeksiData } = await supabase
        .from("inspeksi_hse")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      setInspeksiAll(inspeksiData || []);

      // Cek masa berlaku Head Truck & Tangki dari data master kendaraan
      const { data: kendaraanData } = await supabase
        .from("kendaraan")
        .select("nomor_polisi, masa_berlaku_head_truck, masa_berlaku_tangki");

      const warnList = [];
      (kendaraanData || []).forEach((k) => {
        [
          { field: k.masa_berlaku_head_truck, jenis: "Head Truck" },
          { field: k.masa_berlaku_tangki,      jenis: "Tangki"     },
        ].forEach(({ field, jenis }) => {
          if (!field) return;
          const sisa = sisaHari(field);
          if (sisa <= 30) {
            warnList.push({ nomor_polisi: k.nomor_polisi, _jenis: jenis, _tanggal: field, _sisaHari: sisa });
          }
        });
      });
      warnList.sort((a, b) => a._sisaHari - b._sisaHari);
      setExpiryItems(warnList);

      setLoading(false);
    };
    loadData();
  }, []);

  // Terapkan filter periode ke seluruh data
  const inspeksiFiltered = useMemo(() => {
    let result = inspeksiAll;

    if (filterMode === "custom") {
      if (customStart || customEnd) {
        const start = customStart ? new Date(customStart + "T00:00:00") : null;
        const end   = customEnd   ? new Date(customEnd   + "T23:59:59") : null;
        result = result.filter((i) => {
          const t = new Date(i.created_at);
          if (start && t < start) return false;
          if (end && t > end) return false;
          return true;
        });
      }
    } else if (filterMode !== "semua") {
      const start = getRangeStart(filterMode);
      result = result.filter((i) => new Date(i.created_at) >= start);
    }

    if (searchQuery.trim()) {
      result = result.filter((i) => i.nomor_polisi?.toUpperCase().includes(searchQuery.trim()));
    }

    return result;
  }, [inspeksiAll, filterMode, customStart, customEnd, searchQuery]);

  // Data grafik tren — kelompokkan per bulan (maks 6 bulan terakhir yang ada datanya)
  const trendData = useMemo(() => {
    const map = {};
    inspeksiFiltered.forEach((i) => {
      const d = new Date(i.created_at);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (!map[key]) {
        map[key] = { label: d.toLocaleDateString("id-ID", { month: "short" }), lulus: 0, tidakLulus: 0, sortKey: d.getFullYear() * 12 + d.getMonth() };
      }
      if (i.status === "lulus" || i.status === "selesai") map[key].lulus += 1;
      if (i.status === "tidak_lulus") map[key].tidakLulus += 1;
    });
    return Object.values(map).sort((a, b) => a.sortKey - b.sortKey).slice(-6);
  }, [inspeksiFiltered]);

  // Status yang tersimpan: "lulus" | "tidak_lulus" | "selesai"
  const perluTindak = inspeksiFiltered.filter((i) => i.status === "tidak_lulus");
  const sudahBeres  = inspeksiFiltered.filter((i) => i.status === "lulus" || i.status === "selesai");

  if (view === "list-all")     return <InspeksiList title="Total Diperiksa"        items={inspeksiFiltered} onBack={() => setView("dashboard")} theme={theme} />;
  if (view === "list-perlu")   return <InspeksiList title="Perlu Ditindaklanjuti"   items={perluTindak}      onBack={() => setView("dashboard")} theme={theme} />;
  if (view === "list-selesai") return <InspeksiList title="Sudah Ditindaklanjuti"   items={sudahBeres}       onBack={() => setView("dashboard")} theme={theme} />;

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: theme.bg, display: "flex", justifyContent: "center", alignItems: "center" }}>
        <div style={{ color: theme.textMuted }}>Memuat data...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: theme.bg }}>
    <div style={{ maxWidth: FRAME_WIDTH, margin: "0 auto", minHeight: "100vh", paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ background: theme.surface, padding: "48px 20px 20px", borderBottom: `1px solid ${theme.border}`, boxShadow: theme.shadow }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 13, color: theme.textMuted }}>Selamat datang,</div>
            <div style={{ fontSize: 19, fontWeight: 800, color: theme.text }}>{currentUser?.nama || "HSE"}</div>
            <div style={{ display: "inline-block", marginTop: 4, fontSize: 11, fontWeight: 600, padding: "2px 10px", borderRadius: 20, background: "#FEF3C7", color: "#D97706" }}>
              HSE
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ThemeToggle />
            <div onClick={onLogout} style={{ cursor: "pointer", padding: 10, borderRadius: 12, background: theme.surfaceAlt }}>
              <Icon name="logout" size={18} color={theme.textSub} />
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: "24px 16px" }}>
        {/* Peringatan masa berlaku */}
        <ExpiryBanner theme={theme} items={expiryItems} onClick={() => setShowExpiryModal(true)} />

        {/* Cari nomor polisi */}
        <SearchBar theme={theme} value={searchQuery} onChange={setSearchQuery} />

        <SectionLabel>Filter Periode</SectionLabel>
        <FilterBar
          theme={theme}
          filterMode={filterMode}
          setFilterMode={setFilterMode}
          customStart={customStart}
          setCustomStart={setCustomStart}
          customEnd={customEnd}
          setCustomEnd={setCustomEnd}
        />

        {/* Grafik tren */}
        <TrendChart theme={theme} data={trendData} />

        <SectionLabel>Ringkasan Uji Kedap</SectionLabel>
        <div style={{ display: "flex", gap: 10, marginBottom: 28 }}>
          <StatCard value={inspeksiFiltered.length} label={"Total\nDiperiksa"}         bg={theme.primaryLight} color={theme.primary}  onClick={() => setView("list-all")} />
          <StatCard value={perluTindak.length}      label={"Perlu\nDitindaklanjuti"}   bg={theme.dangerLight}  color={theme.danger}   onClick={() => setView("list-perlu")} />
          <StatCard value={sudahBeres.length}       label={"Sudah\nDitindaklanjuti"}   bg={theme.successLight} color={theme.success}  onClick={() => setView("list-selesai")} />
        </div>

        <div style={{ padding: "14px 16px", borderRadius: 14, background: theme.surface, border: `1px solid ${theme.border}`, fontSize: 13, color: theme.textMuted, lineHeight: 1.6 }}>
          <div style={{ fontWeight: 700, color: theme.text, marginBottom: 4 }}>💡 Panduan</div>
          <div>• Gunakan filter periode untuk melihat data per minggu/bulan/6 bulan/kustom</div>
          <div>• Klik angka untuk lihat daftar kendaraan</div>
          <div>• Gunakan <b>Pengecekan</b> untuk uji kedap baru</div>
          <div>• Gunakan <b>Tindak Lanjut</b> untuk tangani temuan</div>
        </div>
      </div>

      <BottomNav active="dashboard" onNav={onNav} role={role} themeOverride={theme} forceMobile />
    </div>

    {showExpiryModal && (
      <ExpiryListModal theme={theme} items={expiryItems} onClose={() => setShowExpiryModal(false)} />
    )}
    </div>
  );
};

export default HSEDashboard;