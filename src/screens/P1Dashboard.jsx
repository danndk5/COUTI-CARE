import { useState, useEffect } from "react";
import Icon from "../components/Icon";
import ThemeToggle from "../components/ThemeToggle";
import { useTheme } from "../context/ThemeContext";
import { supabase } from "../lib/supabase";
import { useBackableView, goBack } from "../hooks/useBackableView";

// Lebar tampilan dikunci seukuran HP — akun P1 memang cuma dipakai di ponsel
const FRAME_WIDTH = 430;

// ── List kendaraan (sub-view dari stat card) ────────────────────────────────
// onBack di sini sudah dibungkus goBack() oleh pemanggilnya (lihat P1Dashboard),
// supaya konsisten dengan tombol kembali fisik HP (sama-sama lewat history.back()).
const KendaraanList = ({ title, items, onBack, theme }) => (
  <div style={{ minHeight: "100vh", background: theme.bg }}>
    <div style={{ maxWidth: FRAME_WIDTH, margin: "0 auto" }}>
      <div style={{ background: theme.surface, padding: "48px 16px 16px", borderBottom: `1px solid ${theme.border}` }}>
        <div onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14, cursor: "pointer", color: theme.textMuted, fontSize: 13 }}>
          <Icon name="arrow" size={16} color={theme.textMuted} /> Kembali
        </div>
        <div style={{ fontWeight: 800, fontSize: 18, color: theme.text }}>{title}</div>
        <div style={{ fontSize: 13, color: theme.textMuted, marginTop: 2 }}>{items.length} kendaraan</div>
      </div>
      <div style={{ padding: "20px 16px 40px" }}>
        {items.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", background: theme.surface, borderRadius: 14, border: `1px solid ${theme.border}` }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
            <div style={{ fontSize: 14, color: theme.textMuted }}>Belum ada data</div>
          </div>
        ) : items.map((i) => (
          <div key={i.id} style={{ marginBottom: 12, padding: "14px 16px", background: theme.surface, borderRadius: 14, border: `1px solid ${theme.border}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: theme.primaryLight, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon name="car" size={20} color={theme.primary} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: theme.text }}>{i.nomor_polisi}</div>
                <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>{i.transportir}</div>
                <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 1 }}>
                  {i.kapasitas_mt} · {i.jumlah_kompartemen} kompartemen · {i.kategori_mt === "merah_putih" ? "MT Merah Putih" : "MT Industri"}
                </div>
                <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 1 }}>
                  {new Date(i.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                </div>
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20,
                background: i.status === "selesai" ? theme.successLight : theme.dangerLight,
                color: i.status === "selesai" ? theme.success : theme.danger }}>
                {i.status === "selesai" ? "Selesai" : "Perlu Tindak Lanjut"}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

// ── Nav khusus P1 (selalu tab bawah, dikunci lebar HP) ──────────────────────
// Item "Riwayat" dihapus sesuai permintaan.
const NAV_ITEMS = [
  { id: "dashboard",     label: "Beranda",       icon: "home"    },
  { id: "form",          label: "Pengecekan",    icon: "plus"    },
  { id: "tindak-lanjut", label: "Tindak Lanjut", icon: "wrench"  },
];

const P1Nav = ({ active, onNav, theme }) => (
  <div style={{
    position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
    width: "100%", maxWidth: FRAME_WIDTH, background: theme.surface, borderTop: `1px solid ${theme.border}`,
    display: "flex", zIndex: 100,
  }}>
    {NAV_ITEMS.map((n) => {
      const isActive = active === n.id;
      return (
        <div key={n.id} onClick={() => onNav(n.id)} style={{
          flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
          padding: "10px 4px 14px", cursor: "pointer",
          color: isActive ? theme.primary : theme.textMuted,
        }}>
          <Icon name={n.icon} size={20} color={isActive ? theme.primary : theme.textMuted} />
          <div style={{ fontSize: 10, marginTop: 4, fontWeight: isActive ? 700 : 400 }}>{n.label}</div>
        </div>
      );
    })}
  </div>
);

// ── P1Dashboard ──────────────────────────────────────────────────────────────
const P1Dashboard = ({ role, onNav, onLogout }) => {
  const { theme } = useTheme();
  const [currentUser, setCurrentUser] = useState(null);
  const [inspeksiAll, setInspeksiAll] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [view,        setView]        = useState("dashboard");

  // Fix tombol kembali HP: setiap kali "view" pindah dari dashboard ke sub-view
  // (all/perlu/selesai), daftarkan satu langkah history yang bisa "ditangkap"
  // tombol kembali fisik — supaya kembali cuma menutup sub-view ini dulu,
  // bukan langsung lompat ke luar dashboard. Pola sama persis dengan
  // PhotoLightbox di HSEFormScreen.jsx.
  useBackableView(view !== "dashboard", () => setView("dashboard"));

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data: profile } = await supabase.from("profiles").select("nama").eq("id", user.id).single();
      setCurrentUser(profile);
      const { data } = await supabase
        .from("inspeksi_p1")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      setInspeksiAll(data || []);
      setLoading(false);
    };
    load();
  }, []);

  const perluTindak = inspeksiAll.filter(i => i.status !== "selesai");
  const sudahTindak = inspeksiAll.filter(i => i.status === "selesai");
  const perluTindakPreview = perluTindak.slice(0, 3);
  const displayName = currentUser?.nama || "P1 Officer";

  // onBack dari tiap sub-view dibungkus goBack() supaya tombol "Kembali" di layar
  // dan tombol kembali fisik HP sama-sama lewat window.history.back() — history
  // stack jadi konsisten, tidak ada state "nyangkut" dari pushState di useBackableView.
  if (view === "all")     return <KendaraanList title="Total Diperiksa"       items={inspeksiAll}  onBack={() => goBack(() => setView("dashboard"))} theme={theme} />;
  if (view === "perlu")   return <KendaraanList title="Perlu Ditindaklanjuti" items={perluTindak}  onBack={() => goBack(() => setView("dashboard"))} theme={theme} />;
  if (view === "selesai") return <KendaraanList title="Sudah Ditindaklanjuti" items={sudahTindak}  onBack={() => goBack(() => setView("dashboard"))} theme={theme} />;

  const STATS = [
    { val: inspeksiAll.length, label: "Total",        view: "all",     bg: theme.primaryLight, text: theme.primary },
    { val: perluTindak.length, label: "Perlu tindak", view: "perlu",   bg: theme.dangerLight,   text: theme.danger  },
    { val: sudahTindak.length, label: "Selesai",      view: "selesai", bg: theme.successLight,  text: theme.success },
  ];

  return (
    <div style={{ minHeight: "100vh", background: theme.bg }}>
    <div style={{
      maxWidth: FRAME_WIDTH, margin: "0 auto",
      minHeight: "100vh", display: "flex", flexDirection: "column",
      paddingBottom: 80,
    }}>
      {/* Header */}
      <div style={{ padding: "48px 20px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 13, color: theme.textMuted }}>Selamat datang,</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: theme.text, marginTop: 2 }}>{displayName}</div>
            <div style={{ display: "inline-block", marginTop: 8, fontSize: 12, fontWeight: 600, padding: "4px 12px", borderRadius: 20, background: theme.primaryLight, color: theme.primary }}>
              P1 · Cek Random
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ThemeToggle />
            <div onClick={onLogout} style={{ cursor: "pointer", padding: 10, borderRadius: 12, background: theme.surfaceAlt, border: `1px solid ${theme.border}` }}>
              <Icon name="logout" size={18} color={theme.textMuted} />
            </div>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, padding: "0 20px 32px" }}>

        {/* Ringkasan angka */}
        {!loading && (
          <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
            {STATS.map((s) => (
              <div key={s.view} onClick={() => setView(s.view)} style={{
                flex: 1, textAlign: "center", padding: "16px 8px",
                background: s.bg, borderRadius: 14, cursor: "pointer",
              }}>
                <div style={{ fontWeight: 800, fontSize: 26, color: s.text }}>{s.val}</div>
                <div style={{ fontSize: 11, color: s.text, marginTop: 3, fontWeight: 600, opacity: 0.85 }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Perlu tindak lanjut — preview */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: theme.text }}>Perlu tindak lanjut</div>
          {perluTindak.length > 0 && (
            <div onClick={() => setView("perlu")} style={{ fontSize: 12, fontWeight: 600, color: theme.primary, cursor: "pointer" }}>
              Lihat semua
            </div>
          )}
        </div>

        {!loading && perluTindakPreview.length === 0 && (
          <div style={{ padding: "28px 16px", textAlign: "center", background: theme.surface, borderRadius: 14, border: `1px solid ${theme.border}` }}>
            <div style={{ fontSize: 26, marginBottom: 8 }}>✅</div>
            <div style={{ fontSize: 13, color: theme.textMuted }}>Semua temuan sudah ditindaklanjuti</div>
          </div>
        )}

        {perluTindakPreview.length > 0 && (
          <div style={{ background: theme.surface, borderRadius: 14, border: `1px solid ${theme.border}`, overflow: "hidden" }}>
            {perluTindakPreview.map((i, idx) => (
              <div
                key={i.id}
                onClick={() => setView("perlu")}
                style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "14px 14px",
                  cursor: "pointer",
                  borderBottom: idx < perluTindakPreview.length - 1 ? `1px solid ${theme.border}` : "none",
                }}
              >
                <Icon name="alert" size={18} color={theme.danger} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: theme.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {i.nomor_polisi}
                  </div>
                  <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {i.transportir}
                  </div>
                </div>
                <Icon name="chevron" size={14} color={theme.textMuted} />
              </div>
            ))}
          </div>
        )}
      </div>

      <P1Nav active="dashboard" onNav={onNav} theme={theme} />
    </div>
    </div>
  );
};

export default P1Dashboard;