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
import { useBreakpoint } from "./hooks/useBreakpoint";
import { MOBILE_MAX_WIDTH, DESKTOP_CONTENT_MAX_WIDTH } from "./styles/layout";

const App = () => {
  const [screen, setScreen] = useState("login");
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedInspeksiId, setSelectedInspeksiId] = useState(null);
  const [selectedTugasId, setSelectedTugasId] = useState(null);
  const isDesktop = useBreakpoint();

  const fetchRoleAndNavigate = async (userId) => {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();

    if (error || !profile) {
      await supabase.auth.signOut();
      // FIX BACK BUTTON: replaceState (bukan pushState) untuk screen "anchor"
      // (login/dashboard) — supaya back button tidak nyangkut di history lama
      window.history.replaceState({ screen: "login" }, "");
      setScreen("login");
      setRole(null);
      return;
    }

    setRole(profile.role);
    window.history.replaceState({ screen: "dashboard" }, "");
    setScreen("dashboard");
  };

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await fetchRoleAndNavigate(session.user.id);
      } else {
        // FIX BACK BUTTON: pastikan ada 1 history entry dasar sejak awal load
        window.history.replaceState({ screen: "login" }, "");
      }
      setLoading(false);
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_OUT") {
        // FIX BACK BUTTON: replaceState supaya back tidak bisa balik ke
        // screen yang butuh login setelah logout
        window.history.replaceState({ screen: "login" }, "");
        setScreen("login");
        setRole(null);
        setSelectedInspeksiId(null);
        setSelectedTugasId(null);
      }
      if (event === "SIGNED_IN" && session) {
        await fetchRoleAndNavigate(session.user.id);
      }
    });

    return () => subscription?.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // FIX BACK BUTTON: dengarkan tombol back fisik HP / tombol back browser.
  // Setiap kali itu ditekan, browser otomatis "pop" 1 entry dari history dan
  // fire event ini — kita tinggal sinkronkan state screen sesuai isinya.
  useEffect(() => {
    const handlePopState = (event) => {
      const state = event.state;
      if (state?.screen) {
        setScreen(state.screen);
        if ("selectedInspeksiId" in state) setSelectedInspeksiId(state.selectedInspeksiId);
        if ("selectedTugasId" in state) setSelectedTugasId(state.selectedTugasId);
      }
      // kalau state null/kosong, berarti sudah di entry paling awal —
      // biarkan browser/HP lanjut keluar dari web app, itu memang benar
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const handleLogin = (r) => {
    setRole(r);
    window.history.replaceState({ screen: "dashboard" }, "");
    setScreen("dashboard");
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    // onAuthStateChange SIGNED_OUT akan handle reset state & history
  };

  // FIX BACK BUTTON: nav() sekarang push history entry baru setiap navigasi,
  // signature TIDAK berubah — semua screen yang sudah pakai onNav={nav}
  // tidak perlu diubah sama sekali.
  const nav = (s) => {
    window.history.pushState({ screen: s }, "");
    setScreen(s);
  };

  const openDetail = (id) => {
    setSelectedInspeksiId(id);
    window.history.pushState({ screen: "detail", selectedInspeksiId: id }, "");
    setScreen("detail");
  };

  const openTugas = (id) => {
    setSelectedTugasId(id);
    window.history.pushState({ screen: "tugas-detail", selectedTugasId: id }, "");
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
    width: "100%",
    maxWidth: isDesktop ? "none" : MOBILE_MAX_WIDTH,
    margin: isDesktop ? 0 : "0 auto",
  };

  const innerStyle = isDesktop
    ? { maxWidth: DESKTOP_CONTENT_MAX_WIDTH, margin: "0 auto", width: "100%" }
    : undefined;

  if (loading) {
    return (
      <div style={{ ...containerStyle, display: "flex", justifyContent: "center", alignItems: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>
          <div style={{ fontSize: 14, color: "#64748B" }}>Memuat aplikasi...</div>
        </div>
      </div>
    );
  }

  const knownScreens = ["login", "register", "dashboard", "form", "history", "maintenance", "detail", "tugas-detail", "riwayat-kerusakan", "404"];
  const safeScreen = knownScreens.includes(screen) ? screen : "login";

  return (
    <div style={containerStyle}>
      <GlobalStyles />
      <div style={innerStyle}>
        {safeScreen === "login"        && <LoginScreen    onLogin={handleLogin} onGoRegister={() => nav("register")} />}
        {safeScreen === "register"     && <RegisterScreen onBack={() => window.history.back()} />}
        {safeScreen === "dashboard"    && renderDashboard()}
        {safeScreen === "form"         && <FormScreen onBack={() => window.history.back()} onNav={nav} />}
        {safeScreen === "history"      && <RiwayatScreen role={role} onNav={nav} onOpenDetail={openDetail} />}
        {safeScreen === "maintenance"  && <MaintenanceScreen role={role} onNav={nav} />}
        {safeScreen === "detail"       && <DetailScreen inspeksiId={selectedInspeksiId} onBack={() => window.history.back()} />}
        {safeScreen === "tugas-detail" && <TugasDetailScreen tugasId={selectedTugasId} onBack={() => window.history.back()} />}
        {safeScreen === "riwayat-kerusakan" && <RiwayatKerusakanScreen onBack={() => window.history.back()} />}
      </div>
    </div>
  );
};

export default App;