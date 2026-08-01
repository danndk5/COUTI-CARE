import Icon from "./Icon";
import theme from "../styles/theme";
import { useBreakpoint } from "../hooks/useBreakpoint";
import { SIDEBAR_WIDTH } from "../styles/layout";

// Label tampilan per role — dipakai di header sidebar desktop
const ROLE_LABELS = {
  depot:   "Depot · Monitor & Audit",
  hse:     "HSE · Uji Kedap",
  p1:      "P1 · Cek Random",
  teknisi: "Teknisi/Transportir",
};

// Label singkat untuk footer sidebar (di bawah avatar)
const FOOTER_ROLE_LABELS = {
  depot:   "Depot Admin",
  hse:     "HSE",
  p1:      "P1",
  teknisi: "Teknisi/Transportir",
};

// Nama brand default per role (dipakai kalau prop userName tidak dikirim)
const DEFAULT_USER_NAME = {
  depot:   "Pertamina",
  hse:     "HSE Officer",
  p1:      "P1 Officer",
  teknisi: "Teknisi",
};

// Helper terpusat — gunakan ini di semua file lain, jangan cek role string langsung
export const isTeknisi = (role) => role === "teknisi" || role === "transportir" || role === "mekanik";
export const isDepot   = (role) => role === "depot"   || role === "pertamina";
export const isHSE     = (role) => role === "hse";
export const isP1      = (role) => role === "p1";

const NAV_ITEMS = {
  // Beranda | Pengecekan | Tindak Lanjut | Riwayat
  teknisi: [
    { id: "dashboard",      label: "Beranda",        icon: "home"    },
    { id: "form",           label: "Pengecekan",     icon: "plus",  center: true },
    { id: "tindak-lanjut",  label: "Tindak Lanjut",  icon: "wrench" },
    { id: "history",        label: "Riwayat",        icon: "history" },
  ],
  // Beranda | Riwayat | Maintenance
  depot: [
    { id: "dashboard",   label: "Beranda",     icon: "home"    },
    { id: "history",     label: "Riwayat",     icon: "history" },
    { id: "maintenance", label: "Maintenance", icon: "wrench"  },
  ],
  // Beranda | Pengecekan | Tindak Lanjut | Riwayat
  hse: [
    { id: "dashboard",      label: "Beranda",        icon: "home"    },
    { id: "form",           label: "Pengecekan",     icon: "plus",  center: true },
    { id: "tindak-lanjut",  label: "Tindak Lanjut",  icon: "wrench" },
    { id: "history",        label: "Riwayat",        icon: "history" },
  ],
  // Beranda | Pengecekan | Tindak Lanjut | Riwayat
  p1: [
    { id: "dashboard",      label: "Beranda",        icon: "home"    },
    { id: "form",           label: "Pengecekan",     icon: "plus",  center: true },
    { id: "tindak-lanjut",  label: "Tindak Lanjut",  icon: "wrench" },
    { id: "history",        label: "Riwayat",        icon: "history" },
  ],
};

const BottomNav = ({ active, onNav, role, userName, badges = {} }) => {
  const isDesktop = useBreakpoint();

  // Normalisasi role lama supaya backward compatible
  let normalizedRole = role;
  if (role === "transportir" || role === "mekanik") normalizedRole = "teknisi";
  if (role === "pertamina") normalizedRole = "depot";

  const navItems = NAV_ITEMS[normalizedRole] ?? NAV_ITEMS.teknisi;
  const displayName = userName || DEFAULT_USER_NAME[normalizedRole] || "Pengguna";
  const initials = displayName.slice(0, 2).toUpperCase();

  // ── Mode desktop: sidebar kiri ───────────────────────────────────────
  if (isDesktop) {
    return (
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: SIDEBAR_WIDTH,
          height: "100vh",
          background: "#0B1220",
          display: "flex",
          flexDirection: "column",
          padding: "28px 14px",
          zIndex: 100,
          boxShadow: "2px 0 12px rgba(0,0,0,0.12)",
        }}
      >
        {/* Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 8px 26px" }}>
          <div
            style={{
              width: 36, height: 36, borderRadius: 10,
              background: `linear-gradient(135deg, ${theme.primary}, #60A5FA)`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 800, color: "#fff", fontSize: 15, flexShrink: 0,
            }}
          >
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {displayName}
            </div>
            <div style={{ fontSize: 10.5, color: "#94A3B8", marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {ROLE_LABELS[normalizedRole] ?? ""}
            </div>
          </div>
        </div>

        <div style={{ fontSize: 10.5, fontWeight: 700, color: "#475569", letterSpacing: "0.06em", textTransform: "uppercase", padding: "0 10px 10px" }}>
          Menu Utama
        </div>

        {navItems.map((n) => {
          const isActive = active === n.id || (n.id === "dashboard" && active === "dashboard");
          const isCta = !!n.center; // item "Pengecekan" — tonjolkan sebagai aksi utama
          return (
            <div
              key={n.id}
              onClick={() => onNav(n.id)}
              style={{
                display: "flex", alignItems: "center", gap: 11,
                padding: "10px 12px", borderRadius: 10, marginBottom: 3,
                cursor: "pointer",
                background: isCta ? theme.primary : isActive ? theme.primary : "transparent",
                color: isCta ? "#fff" : isActive ? "#fff" : "#94A3B8",
                fontSize: 13.5, fontWeight: isActive || isCta ? 700 : 600,
                transition: "background 0.15s, color 0.15s",
              }}
            >
              <Icon name={n.icon} size={17} color={isCta ? "#fff" : isActive ? "#fff" : "#94A3B8"} />
              {n.label}
            </div>
          );
        })}
      </div>
    );
  }

  // ── Mode mobile: bottom nav (tidak berubah) ─────────────────────────
  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: "50%",
        transform: "translateX(-50%)",
        width: "100%",
        maxWidth: 430,
        background: theme.surface,
        borderTop: `1px solid ${theme.border}`,
        display: "flex",
        zIndex: 100,
        boxShadow: "0 -2px 12px rgba(0,0,0,0.06)",
      }}
    >
      {navItems.map((n) => {
        const isActive = active === n.id || (n.id === "dashboard" && active === "dashboard");
        return (
          <div
            key={n.id}
            onClick={() => onNav(n.id)}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              padding: "10px 4px 14px",
              cursor: "pointer",
              color: isActive ? theme.primary : theme.textMuted,
            }}
          >
            {n.center ? (
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 14,
                  background: theme.primary,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginTop: -22,
                  boxShadow: "0 4px 14px rgba(37,99,235,0.35)",
                }}
              >
                <Icon name="plus" size={20} color="#fff" />
              </div>
            ) : (
              <Icon
                name={n.icon}
                size={20}
                color={isActive ? theme.primary : theme.textMuted}
              />
            )}
            <div
              style={{
                fontSize: 10,
                marginTop: 4,
                fontWeight: isActive ? 700 : 400,
                textAlign: "center",
              }}
            >
              {n.label}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default BottomNav;