import { useState, useEffect } from "react";
import Icon from "../components/Icon";
import { supabase } from "../lib/supabase";

// ── Palet warna dark, khusus dipakai di halaman P1 saja ────────────────────
// (tidak mengubah theme.js, jadi role lain tetap light theme seperti biasa)
const C = {
  bg:          "#0B0F14",
  surface:     "#12161C",
  surfaceAlt:  "#1A1F26",
  border:      "#232830",
  text:        "#F1F5F9",
  textMuted:   "#94A3B8",
  primary:     "#3B82F6",
  badgeBg:     "#1E293B",
  badgeText:   "#93C5FD",
  totalBg:     "#23262B",
  totalText:   "#F1F5F9",
  dangerBg:    "#341518",
  dangerText:  "#F87171",
  successBg:   "#12291C",
  successText: "#4ADE80",
};

// Lebar tampilan dikunci seukuran HP — akun P1 memang cuma dipakai di ponsel
const FRAME_WIDTH = 430;

// ── List kendaraan (sub-view dari stat card) — versi dark ──────────────────
const KendaraanList = ({ title, items, onBack }) => (
  <div style={{ minHeight: "100vh", background: C.bg }}>
    <div style={{ maxWidth: FRAME_WIDTH, margin: "0 auto" }}>
    <div style={{ background: C.surface, padding: "48px 16px 16px", borderBottom: `1px solid ${C.border}` }}>
      <div onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14, cursor: "pointer", color: C.textMuted, fontSize: 13 }}>
        <Icon name="arrow" size={16} color={C.textMuted} /> Kembali
      </div>
      <div style={{ fontWeight: 800, fontSize: 18, color: C.text }}>{title}</div>
      <div style={{ fontSize: 13, color: C.textMuted, marginTop: 2 }}>{items.length} kendaraan</div>
    </div>
    <div style={{ padding: "20px 16px 40px" }}>
      {items.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", background: C.surface, borderRadius: 14, border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
          <div style={{ fontSize: 14, color: C.textMuted }}>Belum ada data</div>
        </div>
      ) : items.map((i) => (
        <div key={i.id} style={{ marginBottom: 12, padding: "14px 16px", background: C.surface, borderRadius: 14, border: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: C.badgeBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Icon name="car" size={20} color={C.badgeText} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: C.text }}>{i.nomor_polisi}</div>
              <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{i.transportir}</div>
              <div style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>
                {i.kapasitas_mt} · {i.jumlah_kompartemen} kompartemen · {i.kategori_mt === "merah_putih" ? "MT Merah Putih" : "MT Industri"}
              </div>
              <div style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>
                {new Date(i.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
              </div>
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20,
              background: i.status === "selesai" ? C.successBg : C.dangerBg,
              color: i.status === "selesai" ? C.successText : C.dangerText }}>
              {i.status === "selesai" ? "Selesai" : "Perlu Tindak Lanjut"}
            </div>
          </div>
        </div>
      ))}
    </div>
    </div>
  </div>
);

// ── Nav khusus P1 (dark) — dibuat lokal, tidak pakai BottomNav.jsx bersama ──
const NAV_ITEMS = [
  { id: "dashboard",     label: "Beranda",       icon: "home"    },
  { id: "form",          label: "Pengecekan",    icon: "plus"    },
  { id: "tindak-lanjut", label: "Tindak Lanjut", icon: "wrench"  },
  { id: "history",       label: "Riwayat",       icon: "history" },
];

const P1NavDark = ({ active, onNav }) => {
  return (
    <div style={{
      position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
      width: "100%", maxWidth: FRAME_WIDTH, background: C.surface, borderTop: `1px solid ${C.border}`,
      display: "flex", zIndex: 100,
    }}>
      {NAV_ITEMS.map((n) => {
        const isActive = active === n.id;
        return (
          <div key={n.id} onClick={() => onNav(n.id)} style={{
            flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
            padding: "10px 4px 14px", cursor: "pointer",
            color: isActive ? C.primary : C.textMuted,
          }}>
            <Icon name={n.icon} size={20} color={isActive ? C.primary : C.textMuted} />
            <div style={{ fontSize: 10, marginTop: 4, fontWeight: isActive ? 700 : 400 }}>{n.label}</div>
          </div>
        );
      })}
    </div>
  );
};

// ── P1Dashboard ───────────────────────────────────────────────────────────
const P1Dashboard = ({ role, onNav, onLogout }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [inspeksiAll, setInspeksiAll] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [view,        setView]        = useState("dashboard");

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

  if (view === "all")     return <KendaraanList title="Total Diperiksa"       items={inspeksiAll}  onBack={() => setView("dashboard")} />;
  if (view === "perlu")   return <KendaraanList title="Perlu Ditindaklanjuti" items={perluTindak}  onBack={() => setView("dashboard")} />;
  if (view === "selesai") return <KendaraanList title="Sudah Ditindaklanjuti" items={sudahTindak}  onBack={() => setView("dashboard")} />;

  const STATS = [
    { val: inspeksiAll.length, label: "Total",        view: "all",     bg: C.totalBg,   text: C.totalText   },
    { val: perluTindak.length, label: "Perlu tindak", view: "perlu",   bg: C.dangerBg,  text: C.dangerText  },
    { val: sudahTindak.length, label: "Selesai",      view: "selesai", bg: C.successBg, text: C.successText },
  ];

  return (
    <div style={{ minHeight: "100vh", background: C.bg }}>
    <div style={{
      maxWidth: FRAME_WIDTH, margin: "0 auto",
      minHeight: "100vh", display: "flex", flexDirection: "column",
      paddingBottom: 80,
    }}>
      {/* Header */}
      <div style={{ padding: "48px 20px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 13, color: C.textMuted }}>Selamat datang,</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: C.text, marginTop: 2 }}>{displayName}</div>
            <div style={{ display: "inline-block", marginTop: 8, fontSize: 12, fontWeight: 600, padding: "4px 12px", borderRadius: 20, background: C.badgeBg, color: C.badgeText }}>
              P1 · Cek Random
            </div>
          </div>
          <div onClick={onLogout} style={{ cursor: "pointer", padding: 10, borderRadius: 12, background: C.surfaceAlt, border: `1px solid ${C.border}` }}>
            <Icon name="logout" size={18} color={C.textMuted} />
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
            <div style={{ fontSize: 14, fontWeight: 800, color: C.text }}>Perlu tindak lanjut</div>
            {perluTindak.length > 0 && (
              <div onClick={() => setView("perlu")} style={{ fontSize: 12, fontWeight: 600, color: C.primary, cursor: "pointer" }}>
                Lihat semua
              </div>
            )}
          </div>

          {!loading && perluTindakPreview.length === 0 && (
            <div style={{ padding: "28px 16px", textAlign: "center", background: C.surface, borderRadius: 14, border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 26, marginBottom: 8 }}>✅</div>
              <div style={{ fontSize: 13, color: C.textMuted }}>Semua temuan sudah ditindaklanjuti</div>
            </div>
          )}

          {perluTindakPreview.length > 0 && (
            <div style={{ background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`, overflow: "hidden" }}>
              {perluTindakPreview.map((i, idx) => (
                <div
                  key={i.id}
                  onClick={() => setView("perlu")}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "14px 14px",
                    cursor: "pointer",
                    borderBottom: idx < perluTindakPreview.length - 1 ? `1px solid ${C.border}` : "none",
                  }}
                >
                  <Icon name="alert" size={18} color={C.dangerText} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {i.nomor_polisi}
                    </div>
                    <div style={{ fontSize: 11, color: C.textMuted, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {i.transportir}
                    </div>
                  </div>
                  <Icon name="chevron" size={14} color={C.textMuted} />
                </div>
              ))}
            </div>
          )}
      </div>

      <P1NavDark active="dashboard" onNav={onNav} />
    </div>
    </div>
  );
};

export default P1Dashboard;