import { useState } from "react";
import BottomNav from "../components/BottomNav";
import Btn from "../components/Btn";
import Card from "../components/Card";
import Icon from "../components/Icon";
import Input from "../components/Input";
import SectionLabel from "../components/SectionLabel";
import theme from "../styles/theme";

const MaintenanceScreen = ({ role, onNav }) => {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ plat: "", kerusakan: "", tanggal: "" });
  const setF = (k) => (v) => setForm((p) => ({ ...p, [k]: v }));

  // Data dummy — nanti diganti data dari Firebase
  const laporan = [
    {
      plat: "B 5678 AB",
      kerusakan: "Segel GPS terlepas, perlu penggantian segel baru",
      pelapor: "Budi",
      tanggal: "2024-01-15",
      status: "Belum Diperbaiki",
    },
    {
      plat: "D 9012 CD",
      kerusakan: "Kabel CCTV kanan terkelupas",
      pelapor: "Citra",
      tanggal: "2024-01-12",
      status: "Sudah Diperbaiki",
    },
  ];

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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontWeight: 800, fontSize: 20, color: theme.text }}>Maintenance</div>
          {role === "transportir" && (
            <div
              onClick={() => setShowForm((v) => !v)}
              style={{
                width: 38, height: 38, borderRadius: 12,
                background: theme.primary,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer",
                boxShadow: "0 2px 8px rgba(37,99,235,0.25)",
              }}
            >
              <Icon name="plus" size={18} color="#fff" />
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: "16px" }}>
        {/* Form Laporan Baru */}
        {showForm && (
          <Card style={{ marginBottom: 20, border: `1.5px solid ${theme.primary}` }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: theme.primary, marginBottom: 14 }}>
              Laporan Kerusakan Baru
            </div>
            <Input label="Nomor Polisi"     placeholder="B 1234 XY" value={form.plat}     onChange={setF("plat")} />
            <Input label="Tanggal Kejadian" value={form.tanggal}    onChange={setF("tanggal")} type="date" placeholder="" />
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 12, color: theme.textSub, marginBottom: 6, fontWeight: 600 }}>
                Detail Kerusakan
              </label>
              <textarea
                placeholder="Jelaskan kerusakan yang ditemukan..."
                value={form.kerusakan}
                onChange={(e) => setF("kerusakan")(e.target.value)}
                style={{
                  width: "100%", padding: "10px 12px", borderRadius: 10,
                  border: `1.5px solid ${theme.border}`, background: theme.surface,
                  color: theme.text, fontSize: 13, fontFamily: "'DM Sans', sans-serif",
                  resize: "none", minHeight: 80, boxSizing: "border-box", outline: "none",
                }}
              />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Btn onClick={() => setShowForm(false)} variant="ghost" style={{ flex: 0.5, padding: "11px", fontSize: 13 }}>
                Batal
              </Btn>
              <Btn onClick={() => setShowForm(false)} variant="primary" style={{ fontSize: 13 }}>
                Kirim
              </Btn>
            </div>
          </Card>
        )}

        {/* Daftar Laporan */}
        <SectionLabel>Daftar Laporan</SectionLabel>
        {laporan.map((l, i) => (
          <Card key={i} style={{ marginBottom: 10 }}>
            <div
              style={{
                display: "flex", justifyContent: "space-between",
                alignItems: "flex-start", marginBottom: 8,
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 14, color: theme.text }}>{l.plat}</div>
              <span
                style={{
                  fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 20,
                  background: l.status === "Sudah Diperbaiki" ? theme.successLight : theme.warningLight,
                  color:      l.status === "Sudah Diperbaiki" ? theme.success      : theme.warning,
                }}
              >
                {l.status}
              </span>
            </div>
            <div style={{ fontSize: 13, color: theme.textSub, lineHeight: 1.5 }}>{l.kerusakan}</div>
            <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 8 }}>
              👤 {l.pelapor} · 📅 {l.tanggal}
            </div>
            {role === "pertamina" && l.status === "Belum Diperbaiki" && (
              <div style={{ marginTop: 10 }}>
                <Btn onClick={() => {}} variant="outline" style={{ fontSize: 12, padding: "9px" }}>
                  <Icon name="check" size={14} color={theme.primary} /> Tandai Sudah Diperbaiki
                </Btn>
              </div>
            )}
          </Card>
        ))}
      </div>

      <BottomNav active="maintenance" onNav={onNav} role={role} />
    </div>
  );
};

export default MaintenanceScreen;