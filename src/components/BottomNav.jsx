import Icon from "./Icon";
import theme from "../styles/theme";

const BottomNav = ({ active, onNav, role }) => {
  // role teknisi = gabungan transportir (driver) + mekanik (sementara masih 2 string lama,
  // belum dimigrasi ke "teknisi" tunggal — lihat catatan migrasi role)
  const isTeknisi = role === "transportir" || role === "mekanik";

  const navItems = [
    { id: "dashboard", label: "Beranda", icon: "home" },
    ...(isTeknisi ? [{ id: "form", label: "Cek Baru", icon: "plus" }] : []),
    ...(isTeknisi ? [{ id: "dashboard-tugas", label: "Tugas Perbaikan", icon: "wrench" }] : []),
    { id: "history", label: "Riwayat", icon: "history" },
    // Maintenance HANYA untuk role selain teknisi (misal pertamina), sesuai
    // instruksi: tombol Maintenance dihilangkan dari nav teknisi.
    ...(!isTeknisi ? [{ id: "maintenance", label: "Maintenance", icon: "wrench" }] : []),
  ];

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
        const isActive = active === n.id;
        const isCenter = n.id === "form";
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
            {isCenter ? (
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