import Icon from "./Icon";
import theme from "../styles/theme";

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

const BottomNav = ({ active, onNav, role }) => {
  // Normalisasi role lama supaya backward compatible
  let normalizedRole = role;
  if (role === "transportir" || role === "mekanik") normalizedRole = "teknisi";
  if (role === "pertamina") normalizedRole = "depot";

  const navItems = NAV_ITEMS[normalizedRole] ?? NAV_ITEMS.teknisi;

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