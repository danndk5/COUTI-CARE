import { useState } from "react";
import Card from "../components/Card";
import Input from "../components/Input";
import Btn from "../components/Btn";
import Icon from "../components/Icon";
import theme from "../styles/theme";
import { supabase } from "../lib/supabase";

const ROLES = [
  { value: "transportir", label: "Pemeriksa / Driver", icon: "car", desc: "Isi form pengecekan GPS & CCTV" },
  { value: "mekanik", label: "Mekanik", icon: "wrench", desc: "Perbaiki & laporkan temuan" },
  { value: "pertamina", label: "Pertamina / Depot", icon: "eye", desc: "Monitor & tugaskan perbaikan" },
];

const RegisterScreen = ({ onBack }) => {
  const [selectedRole, setSelectedRole] = useState(null);
  const [form, setForm] = useState({
    nama: "",
    perusahaan: "",
    email: "",
    pass: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const set = (k) => (v) => setForm((p) => ({ ...p, [k]: v }));

  const handleRegister = async () => {
    if (!form.nama || !form.perusahaan || !form.email || !form.pass) {
      setError("Semua field wajib diisi.");
      return;
    }
    if (form.pass.length < 8) {
      setError("Password minimal 8 karakter.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email,
        password: form.pass,
      });

      if (authError) {
        setError(authError.message);
        setLoading(false);
        return;
      }

      const { error: profileError } = await supabase.from("profiles").insert([
        {
          id: authData.user.id,
          nama: form.nama,
          perusahaan: form.perusahaan,
          role: selectedRole,
        },
      ]);

      if (profileError) {
        setError("Gagal membuat profil: " + profileError.message);
        setLoading(false);
        return;
      }

      setSuccess(true);
      setLoading(false);

      setTimeout(() => {
        onBack();
      }, 2000);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  // ── STEP 1: Pilih Role ──────────────────────────────────────────────────
  if (!selectedRole) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: theme.bg,
          padding: 24,
          paddingTop: 56,
        }}
      >
        <div
          onClick={onBack}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginBottom: 24,
            cursor: "pointer",
            color: theme.textSub,
            fontSize: 14,
          }}
        >
          <Icon name="arrow" size={18} color={theme.textSub} /> Kembali
        </div>

        <div style={{ fontSize: 22, fontWeight: 800, color: theme.text, marginBottom: 4 }}>
          Daftar Sebagai
        </div>
        <div style={{ fontSize: 13, color: theme.textMuted, marginBottom: 24 }}>
          Pilih peran Anda di sistem ini
        </div>

        {ROLES.map((r) => (
          <Card
            key={r.value}
            onClick={() => setSelectedRole(r.value)}
            style={{
              marginBottom: 12,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: "16px",
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                background: theme.primaryLight,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Icon name={r.icon} size={22} color={theme.primary} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: theme.text }}>
                {r.label}
              </div>
              <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>
                {r.desc}
              </div>
            </div>
            <Icon name="chevron" size={16} color={theme.textMuted} />
          </Card>
        ))}
      </div>
    );
  }

  // ── STEP 2: Form Daftar ────────────────────────────────────────────────
  const roleInfo = ROLES.find((r) => r.value === selectedRole);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: theme.bg,
        padding: 24,
        paddingTop: 56,
      }}
    >
      <div
        onClick={() => setSelectedRole(null)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 24,
          cursor: "pointer",
          color: theme.textSub,
          fontSize: 14,
        }}
      >
        <Icon name="arrow" size={18} color={theme.textSub} /> Ganti Peran
      </div>

      <div style={{ fontSize: 22, fontWeight: 800, color: theme.text, marginBottom: 4 }}>
        Daftar Akun
      </div>
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 12,
          fontWeight: 600,
          padding: "4px 10px",
          borderRadius: 20,
          background: theme.primaryLight,
          color: theme.primary,
          marginBottom: 24,
        }}
      >
        <Icon name={roleInfo.icon} size={13} color={theme.primary} />
        {roleInfo.label}
      </div>

      <Card>
        {success ? (
          <div style={{ textAlign: "center", padding: 16 }}>
            <div style={{ fontSize: 14, color: "#10B981", marginBottom: 12 }}>
              ✓ Akun berhasil dibuat!
            </div>
            <div style={{ fontSize: 12, color: theme.textMuted }}>
              Mengalihkan ke login...
            </div>
          </div>
        ) : (
          <>
            <Input
              label="Nama Lengkap"
              placeholder="Nama Anda"
              value={form.nama}
              onChange={set("nama")}
            />
            <Input
              label={selectedRole === "pertamina" ? "Unit / Depot" : "Perusahaan"}
              placeholder={selectedRole === "pertamina" ? "Depot ..." : "PT. ..."}
              value={form.perusahaan}
              onChange={set("perusahaan")}
            />
            <Input
              label="Email"
              placeholder="email@perusahaan.com"
              value={form.email}
              onChange={set("email")}
            />
            <Input
              label="Password"
              placeholder="Min. 8 karakter"
              value={form.pass}
              onChange={set("pass")}
              type="password"
            />

            {error && (
              <div
                style={{
                  fontSize: 13,
                  color: "#EF4444",
                  marginBottom: 8,
                  textAlign: "center",
                }}
              >
                {error}
              </div>
            )}

            <Btn onClick={handleRegister} variant="primary" disabled={loading}>
              {loading ? "Membuat Akun..." : "Buat Akun"}
            </Btn>
          </>
        )}
      </Card>
    </div>
  );
};

export default RegisterScreen;