import { useState, useEffect } from "react";
import GlobalStyles from "./styles/GlobalStyles";
import LoginScreen        from "./screens/LoginScreen";
import RegisterScreen     from "./screens/RegisterScreen";
import DashboardScreen    from "./screens/DashboardScreen";
import PertaminaDashboard from "./screens/PertaminaDashboard";
import MekanikDashboard   from "./screens/MekanikDashboard";
import FormScreen         from "./screens/FormScreen";
import RiwayatScreen      from "./screens/RiwayatScreen";
import MaintenanceScreen  from "./screens/MaintenanceScreen";
import DetailScreen       from "./screens/DetailScreen";
import TugasDetailScreen  from "./screens/TugasDetailScreen";
import { supabase } from "./lib/supabase";
import RiwayatKerusakanScreen from "./screens/RiwayatKerusakanScreen";

const App = () => {
  const [screen, setScreen] = useState("login");
  const [role, setRole] = useState(null); // FIX: null bukan "transportir" supaya tidak ada default yang salah
  const [loading, setLoading] = useState(true);
  const [selectedInspeksiId, setSelectedInspeksiId] = useState(null);
  const [selectedTugasId, setSelectedTugasId] = useState(null);

  // FIX: pisah fungsi fetchRole supaya bisa dipanggil dari checkSession & onAuthStateChange
  const fetchRoleAndNavigate = async (userId) => {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();

    if (error || !profile) {
      // Gagal ambil profile → logout paksa, jangan biarkan masuk dengan role null
      await supabase.auth.signOut();
      setScreen("login");
      setRole(null);
      return;
    }

    setRole(profile.role);
    setScreen("dashboard");
  };

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await fetchRoleAndNavigate(session.user.id);
      }
      setLoading(false);
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_OUT") {
        // FIX: clear semua state saat logout
        setScreen("login");
        setRole(null);
        setSelectedInspeksiId(null);
        setSelectedTugasId(null);
      }
      // FIX: handle SIGNED_IN (misal login di tab lain / session refresh)
      if (event === "SIGNED_IN" && session) {
        await fetchRoleAndNavigate(session.user.id);
      }
    });

    return () => subscription?.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLogin = (r) => {
    setRole(r);
    setScreen("dashboard");
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    // onAuthStateChange SIGNED_OUT akan handle reset state
  };

  const nav = (s) => setScreen(s);

  const openDetail = (id) => {
    setSelectedInspeksiId(id);
    setScreen("detail");
  };

  const openTugas = (id) => {
    setSelectedTugasId(id);
    setScreen("tugas-detail");
  };

  const renderDashboard = () => {
    if (role === "pertamina") {
      return (
        <PertaminaDashboard
          onNav={nav}
          onLogout={handleLogout}
          onOpenDetail={openDetail}
        />
      );
    }
    if (role === "mekanik") {
      return (
        <MekanikDashboard
          onNav={nav}
          onLogout={handleLogout}
          onOpenTugas={openTugas}
        />
      );
    }
    // FIX: "transportir" dan "driver" keduanya masuk DashboardScreen
    // Kalau ada role lain yang tidak dikenali, juga masuk sini (aman)
    return (
      <DashboardScreen
        role={role}
        onNav={nav}
        onLogout={handleLogout}
        onOpenDetail={openDetail}
      />
    );
  };

  const containerStyle = {
    fontFamily: "'DM Sans', sans-serif",
    background: "#F8FAFC",
    minHeight: "100vh",
    maxWidth: 430,
    margin: "0 auto",
  };

  if (loading) {
    return (
      <div style={{ ...containerStyle, display: "flex", justifyContent: "center", alignItems: "center" }}>
        {/* FIX: loading lebih informatif */}
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>
          <div style={{ fontSize: 14, color: "#64748B" }}>Memuat aplikasi...</div>
        </div>
      </div>
    );
  }

  // FIX: fallback kalau screen tidak match → redirect ke login
  const knownScreens = ["login", "register", "dashboard", "form", "history", "maintenance", "detail", "tugas-detail", "riwayat-kerusakan", "404"];
  const safeScreen = knownScreens.includes(screen) ? screen : "login";

  return (
    <div style={containerStyle}>
      <GlobalStyles />

      {safeScreen === "login"        && <LoginScreen    onLogin={handleLogin} onGoRegister={() => setScreen("register")} />}
      {safeScreen === "register"     && <RegisterScreen onBack={() => setScreen("login")} />}
      {safeScreen === "dashboard"    && renderDashboard()}
      {safeScreen === "form"         && <FormScreen onBack={() => setScreen("dashboard")} onNav={nav} />}
      {safeScreen === "history"      && <RiwayatScreen role={role} onNav={nav} onOpenDetail={openDetail} />}
      {safeScreen === "maintenance"  && <MaintenanceScreen role={role} onNav={nav} />}
      {safeScreen === "detail"       && <DetailScreen inspeksiId={selectedInspeksiId} onBack={() => setScreen("dashboard")} />}
      {safeScreen === "tugas-detail" && <TugasDetailScreen tugasId={selectedTugasId} onBack={() => setScreen("dashboard")} />}
      {safeScreen === "riwayat-kerusakan" && <RiwayatKerusakanScreen onBack={() => setScreen("dashboard")} />}
    </div>
  );
};

export default App;