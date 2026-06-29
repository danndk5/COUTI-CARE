import { useState } from "react";
import Card from "../components/Card";
import Input from "../components/Input";
import Btn from "../components/Btn";
import Icon from "../components/Icon";
import theme from "../styles/theme";
import { supabase } from "../lib/supabase";

const LoginScreen = ({ onLogin, onGoRegister, onForgotPassword }) => {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    if (!email || !pass) {
      setError("Email dan password wajib diisi.");
      return;
    }
    setLoading(true);
    setError("");

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password: pass,
    });

    if (authError) {
      setError("Email atau password salah.");
      setLoading(false);
      return;
    }

    // Ambil role dari tabel profiles
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single();

    const role = profile?.role || "transportir";
    onLogin(role);
    setLoading(false);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: theme.bg,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: 24,
      }}
    >
      {/* Logo & Title */}
      <div style={{ textAlign: "center", marginBottom: 36 }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 68,
            height: 68,
            borderRadius: 20,
            background: theme.primary,
            marginBottom: 18,
            boxShadow: "0 6px 24px rgba(37,99,235,0.3)",
          }}
        >
          <Icon name="gps" size={30} color="#fff" />
        </div>
        <div style={{ fontSize: 24, fontWeight: 800, color: theme.text }}>
          GPS & CCTV
        </div>
        <div style={{ fontSize: 13, color: theme.textMuted, marginTop: 4 }}>
          Sistem Pemantauan Armada
        </div>
      </div>

      {/* Login Form */}
      <Card style={{ marginBottom: 16 }}>
        <div
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: theme.text,
            marginBottom: 18,
          }}
        >
          Masuk
        </div>
        <Input
          label="Email"
          placeholder="email@perusahaan.com"
          value={email}
          onChange={setEmail}
        />
        <Input
          label="Password"
          placeholder="••••••••"
          value={pass}
          onChange={setPass}
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

        <div style={{ marginTop: 4 }}>
          <Btn onClick={handleLogin} variant="primary" disabled={loading}>
            {loading ? "Memuat..." : "Masuk"}
          </Btn>
        </div>

        <div style={{ textAlign: "center", marginTop: 12 }}>
          <span
            onClick={onForgotPassword}
            style={{ color: theme.primary, fontSize: 13, cursor: "pointer" }}
          >
            Lupa password?
          </span>
        </div>

        <div
          style={{
            textAlign: "center",
            fontSize: 13,
            color: theme.textMuted,
            marginTop: 16,
          }}
        >
          Belum punya akun?{" "}
          <span
            onClick={onGoRegister}
            style={{ color: theme.primary, fontWeight: 700, cursor: "pointer" }}
          >
            Daftar
          </span>
        </div>
      </Card>
    </div>
  );
};

export default LoginScreen;