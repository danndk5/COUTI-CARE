import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function ForgotPasswordScreen({ navigate }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    const trimmed = email.trim().toLowerCase();

    if (!trimmed) {
      setError("Email tidak boleh kosong.");
      return;
    }
    // Basic email format check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Format email tidak valid.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      // redirectTo harus terdaftar di Supabase Auth → Redirect URLs
      // Ganti dengan URL produksi atau localhost sesuai environment
      const redirectTo = `${window.location.origin}/?screen=reset-password`;

      const { error: sbError } = await supabase.auth.resetPasswordForEmail(
        trimmed,
        { redirectTo }
      );

      // Selalu tampilkan pesan sukses generik — jangan bocorkan apakah
      // email terdaftar atau tidak (mencegah enumerasi akun)
      if (sbError) {
        // Log untuk debugging, tapi UI tetap tampilkan pesan generik
        console.error("resetPasswordForEmail error:", sbError.message);
      }

      setSubmitted(true);
    } catch (err) {
      console.error("Unexpected error:", err);
      // Tetap tampilkan pesan generik
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {/* Header */}
        <div style={styles.header}>
          <button
            style={styles.backBtn}
            onClick={() => navigate("login")}
            aria-label="Kembali ke login"
          >
            ←
          </button>
          <h2 style={styles.title}>Lupa Password</h2>
        </div>

        {!submitted ? (
          <>
            <p style={styles.desc}>
              Masukkan email akun kamu. Kami akan mengirimkan link untuk
              mereset password.
            </p>

            <div style={styles.field}>
              <label style={styles.label}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError("");
                }}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                placeholder="nama@email.com"
                style={{
                  ...styles.input,
                  borderColor: error ? "#ef4444" : "#d1d5db",
                }}
                disabled={loading}
                autoFocus
              />
              {error ? <p style={styles.errorText}>{error}</p> : null}
            </div>

            <button
              onClick={handleSubmit}
              disabled={loading}
              style={{
                ...styles.submitBtn,
                opacity: loading ? 0.7 : 1,
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Mengirim..." : "Kirim Link Reset"}
            </button>
          </>
        ) : (
          <div style={styles.successBox}>
            <div style={styles.successIcon}>✉️</div>
            <p style={styles.successTitle}>Cek email kamu</p>
            <p style={styles.successDesc}>
              Jika email yang kamu masukkan terdaftar, link untuk mereset
              password sudah dikirimkan. Silakan cek inbox (atau folder spam)
              kamu.
            </p>
            <button
              onClick={() => navigate("login")}
              style={styles.backToLoginBtn}
            >
              Kembali ke Login
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f3f4f6",
    padding: "16px",
  },
  card: {
    background: "#fff",
    borderRadius: "16px",
    padding: "28px 24px",
    width: "100%",
    maxWidth: "400px",
    boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginBottom: "20px",
  },
  backBtn: {
    background: "none",
    border: "none",
    fontSize: "22px",
    cursor: "pointer",
    color: "#374151",
    padding: "0 4px",
    lineHeight: 1,
  },
  title: {
    margin: 0,
    fontSize: "20px",
    fontWeight: 700,
    color: "#111827",
  },
  desc: {
    fontSize: "14px",
    color: "#6b7280",
    marginBottom: "20px",
    lineHeight: 1.5,
  },
  field: {
    marginBottom: "20px",
  },
  label: {
    display: "block",
    fontSize: "14px",
    fontWeight: 600,
    color: "#374151",
    marginBottom: "6px",
  },
  input: {
    width: "100%",
    padding: "10px 12px",
    fontSize: "15px",
    borderRadius: "8px",
    border: "1.5px solid #d1d5db",
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.15s",
  },
  errorText: {
    color: "#ef4444",
    fontSize: "12px",
    marginTop: "5px",
    margin: "5px 0 0 0",
  },
  submitBtn: {
    width: "100%",
    padding: "12px",
    background: "#2563eb",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    fontSize: "15px",
    fontWeight: 600,
  },
  successBox: {
    textAlign: "center",
    padding: "8px 0",
  },
  successIcon: {
    fontSize: "48px",
    marginBottom: "12px",
  },
  successTitle: {
    fontSize: "18px",
    fontWeight: 700,
    color: "#111827",
    margin: "0 0 8px 0",
  },
  successDesc: {
    fontSize: "14px",
    color: "#6b7280",
    lineHeight: 1.6,
    margin: "0 0 24px 0",
  },
  backToLoginBtn: {
    width: "100%",
    padding: "12px",
    background: "#f3f4f6",
    color: "#374151",
    border: "none",
    borderRadius: "8px",
    fontSize: "15px",
    fontWeight: 600,
    cursor: "pointer",
  },
};