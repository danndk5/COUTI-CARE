import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

/**
 * ResetPasswordScreen
 *
 * Dibuka dari link email Supabase yang formatnya:
 *   https://yourdomain.com/?screen=reset-password#access_token=...&type=recovery
 *
 * Supabase JS client v2 secara otomatis mendeteksi token recovery di URL hash
 * dan men-trigger event "PASSWORD_RECOVERY" pada onAuthStateChange.
 * Kita manfaatkan event itu untuk mengaktifkan form.
 */
export default function ResetPasswordScreen({ navigate }) {
  const [ready, setReady] = useState(false);      // token recovery terdeteksi
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState({});
  const [globalError, setGlobalError] = useState("");

  useEffect(() => {
    // Supabase v2: onAuthStateChange menangkap "PASSWORD_RECOVERY" saat
    // access_token recovery ada di URL hash — kita tidak perlu parsing manual.
    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "PASSWORD_RECOVERY") {
          setReady(true);
        }
      }
    );

    // Fallback: kalau sudah ada session aktif saat komponen mount
    // (misal: Supabase sudah proses token sebelum listener terpasang)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
    });

    return () => {
      listener?.subscription?.unsubscribe();
    };
  }, []);

  const validate = () => {
    const errs = {};
    if (!password) {
      errs.password = "Password baru tidak boleh kosong.";
    } else if (password.length < 8) {
      errs.password = "Password minimal 8 karakter.";
    }
    if (!confirmPassword) {
      errs.confirmPassword = "Konfirmasi password tidak boleh kosong.";
    } else if (password !== confirmPassword) {
      errs.confirmPassword = "Password tidak cocok.";
    }
    return errs;
  };

  const handleSubmit = async () => {
    setGlobalError("");
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setLoading(true);
    try {
      const { error: sbError } = await supabase.auth.updateUser({
        password,
      });

      if (sbError) {
        setGlobalError(
          sbError.message === "Auth session missing!"
            ? "Sesi tidak ditemukan. Link reset mungkin sudah kadaluarsa. Silakan minta link baru."
            : "Gagal memperbarui password. Coba lagi atau minta link reset baru."
        );
        return;
      }

      setSuccess(true);
      // Arahkan ke login setelah 3 detik
      setTimeout(() => navigate("login"), 3000);
    } catch (err) {
      console.error("updateUser error:", err);
      setGlobalError("Terjadi kesalahan. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  // ── Tampilan: token belum terdeteksi ──────────────────────────────────────
  if (!ready) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.header}>
            <h2 style={styles.title}>Reset Password</h2>
          </div>
          <div style={styles.waitingBox}>
            <p style={styles.waitingText}>
              Memverifikasi link reset password…
            </p>
            <p style={styles.waitingSubtext}>
              Jika halaman ini tidak berubah dalam beberapa detik, link
              mungkin sudah kadaluarsa.{" "}
              <button
                style={styles.linkBtn}
                onClick={() => navigate("forgot-password")}
              >
                Minta link baru
              </button>
              .
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Tampilan: berhasil ───────────────────────────────────────────────────
  if (success) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.successBox}>
            <div style={styles.successIcon}>✅</div>
            <p style={styles.successTitle}>Password berhasil diubah!</p>
            <p style={styles.successDesc}>
              Kamu akan diarahkan ke halaman login dalam beberapa detik…
            </p>
            <button
              onClick={() => navigate("login")}
              style={styles.submitBtn}
            >
              Login Sekarang
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Tampilan: form set password baru ─────────────────────────────────────
  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <h2 style={styles.title}>Buat Password Baru</h2>
        </div>
        <p style={styles.desc}>
          Masukkan password baru untuk akun kamu.
        </p>

        {globalError ? (
          <div style={styles.alertBox}>
            <p style={styles.alertText}>{globalError}</p>
            <button
              style={styles.linkBtn}
              onClick={() => navigate("forgot-password")}
            >
              Minta link reset baru
            </button>
          </div>
        ) : null}

        {/* Password baru */}
        <div style={styles.field}>
          <label style={styles.label}>Password Baru</label>
          <div style={styles.inputWrapper}>
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errors.password) setErrors((p) => ({ ...p, password: "" }));
              }}
              placeholder="Minimal 8 karakter"
              style={{
                ...styles.input,
                borderColor: errors.password ? "#ef4444" : "#d1d5db",
              }}
              disabled={loading}
              autoFocus
            />
            <button
              style={styles.eyeBtn}
              onClick={() => setShowPassword((v) => !v)}
              tabIndex={-1}
              type="button"
            >
              {showPassword ? "🙈" : "👁️"}
            </button>
          </div>
          {errors.password ? (
            <p style={styles.errorText}>{errors.password}</p>
          ) : null}
        </div>

        {/* Konfirmasi password */}
        <div style={styles.field}>
          <label style={styles.label}>Konfirmasi Password</label>
          <input
            type={showPassword ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              if (errors.confirmPassword)
                setErrors((p) => ({ ...p, confirmPassword: "" }));
            }}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="Ulangi password baru"
            style={{
              ...styles.input,
              borderColor: errors.confirmPassword ? "#ef4444" : "#d1d5db",
            }}
            disabled={loading}
          />
          {errors.confirmPassword ? (
            <p style={styles.errorText}>{errors.confirmPassword}</p>
          ) : null}
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
          {loading ? "Menyimpan..." : "Simpan Password Baru"}
        </button>
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
    marginBottom: "16px",
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
    marginBottom: "18px",
  },
  label: {
    display: "block",
    fontSize: "14px",
    fontWeight: 600,
    color: "#374151",
    marginBottom: "6px",
  },
  inputWrapper: {
    position: "relative",
    display: "flex",
    alignItems: "center",
  },
  input: {
    width: "100%",
    padding: "10px 40px 10px 12px",
    fontSize: "15px",
    borderRadius: "8px",
    border: "1.5px solid #d1d5db",
    outline: "none",
    boxSizing: "border-box",
  },
  eyeBtn: {
    position: "absolute",
    right: "10px",
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: "16px",
    padding: 0,
    lineHeight: 1,
  },
  errorText: {
    color: "#ef4444",
    fontSize: "12px",
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
    cursor: "pointer",
  },
  waitingBox: {
    textAlign: "center",
    padding: "16px 0",
  },
  waitingText: {
    fontSize: "15px",
    color: "#374151",
    marginBottom: "8px",
  },
  waitingSubtext: {
    fontSize: "13px",
    color: "#9ca3af",
    lineHeight: 1.5,
  },
  alertBox: {
    background: "#fef2f2",
    border: "1px solid #fecaca",
    borderRadius: "8px",
    padding: "12px 14px",
    marginBottom: "18px",
  },
  alertText: {
    color: "#b91c1c",
    fontSize: "13px",
    margin: "0 0 6px 0",
  },
  linkBtn: {
    background: "none",
    border: "none",
    color: "#2563eb",
    cursor: "pointer",
    fontSize: "13px",
    padding: 0,
    textDecoration: "underline",
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
};