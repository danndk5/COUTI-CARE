import { useState, useEffect, useRef } from "react";
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
import DetailKategoriScreen    from "./screens/DetailKategoriScreen";
import FilteredInspeksiScreen  from "./screens/FilteredInspeksiScreen";
import ForgotPasswordScreen from "./screens/ForgotPasswordScreen";
import ResetPasswordScreen from "./screens/ResetPasswordScreen";
import { supabase } from "./lib/supabase";
import RiwayatKerusakanScreen from "./screens/RiwayatKerusakanScreen";
import { useBreakpoint } from "./hooks/useBreakpoint";
import { MOBILE_MAX_WIDTH, DESKTOP_CONTENT_MAX_WIDTH } from "./styles/layout";
import theme from "./styles/theme"; // FIX EXIT CONFIRM: dipakai untuk styling modal konfirmasi keluar

const App = () => {
  const [screen, setScreen] = useState("login");
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedInspeksiId, setSelectedInspeksiId] = useState(null);
  const [selectedTugasId, setSelectedTugasId] = useState(null);
  const [detailKategoriType,  setDetailKategoriType]  = useState(null); // "health" | "date"
  const [detailKategoriValue, setDetailKategoriValue] = useState(null); // "Baik" / "2025-06-01" / dll
  const [filteredInspFilter,  setFilteredInspFilter]  = useState(null); // "all" | "normal" | "abnormal"
  const [initialTab, setInitialTab] = useState("beranda");
  const [showExitConfirm, setShowExitConfirm] = useState(false); // FIX EXIT CONFIRM
  const isDesktop = useBreakpoint();

  // FIX BACK BUTTON + EXIT CONFIRM: ref supaya handler popstate (terdaftar
  // sekali via useEffect deps []) selalu baca nilai TERBARU, bukan nilai
  // saat effect pertama jalan.
  const screenRef = useRef(screen);
  useEffect(() => { screenRef.current = screen; }, [screen]);

  // FIX EXIT CONFIRM: flag penanda "user sudah klik Ya, Keluar", supaya
  // proses back() berikutnya tidak ditahan lagi oleh guard.
  const allowExitRef = useRef(false);

  const fetchRoleAndNavigate = async (userId) => {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();

    if (error || !profile) {
      await supabase.auth.signOut();
      enterLogin();
      setRole(null);
      return;
    }

    setRole(profile.role);
    enterDashboard();
  };

  // FIX BACK BUTTON: helper masuk ke "dashboard" sekaligus pasang history
  // dasar + 1 entry penjaga di atasnya (untuk exit-confirm).
  const enterDashboard = () => {
    window.history.replaceState({ screen: "dashboard" }, "");
    window.history.pushState({ screen: "dashboard", guard: true }, "");
    setScreen("dashboard");
  };

  // FIX BACK BUTTON: helper masuk ke "login" — tanpa guard, karena back
  // dari Login memang dibiarkan keluar normal (sesuai yang diminta: cuma
  // dashboard/halaman utama yang butuh konfirmasi).
  const enterLogin = () => {
    window.history.replaceState({ screen: "login" }, "");
    setScreen("login");
  };

  useEffect(() => {
    const checkSession = async () => {
      // Deteksi token recovery dari link email Supabase
      // Format URL: /?screen=reset-password#access_token=...&type=recovery
      const urlParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.replace("#", "?").slice(1));
      const isRecovery =
        urlParams.get("screen") === "reset-password" ||
        hashParams.get("type") === "recovery";

      if (isRecovery) {
        window.history.replaceState({ screen: "reset-password" }, "");
        setScreen("reset-password");
        setLoading(false);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await fetchRoleAndNavigate(session.user.id);
      } else {
        window.history.replaceState({ screen: "login" }, "");
      }
      setLoading(false);
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_OUT") {
        enterLogin();
        setRole(null);
        setSelectedInspeksiId(null);
        setSelectedTugasId(null);
      }
      // PASSWORD_RECOVERY: arahkan ke ResetPasswordScreen, jangan ke dashboard
      if (event === "PASSWORD_RECOVERY") {
        window.history.replaceState({ screen: "reset-password" }, "");
        setScreen("reset-password");
        setLoading(false);
        return;
      }
      // SIGNED_IN: skip kalau ini hasil dari token recovery (user belum reset password)
      if (event === "SIGNED_IN" && session) {
        if (screenRef.current === "reset-password") return;
        const alreadyInApp = !["login", "register"].includes(screenRef.current);
        if (alreadyInApp) return;
        await fetchRoleAndNavigate(session.user.id);
      }
    });

    return () => subscription?.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // FIX BACK BUTTON + EXIT CONFIRM
  useEffect(() => {
    const handlePopState = (event) => {
      const state = event.state;
      const incomingScreen = state?.screen;

      if (!incomingScreen) return;

      // Sedang proses keluar yang SUDAH dikonfirmasi user (klik "Ya, Keluar").
      // Begitu pop pertama mendarat balik di "dashboard" (entry dasar, bukan
      // guard), mundur sekali lagi supaya benar-benar keluar dari app.
      if (allowExitRef.current) {
        if (incomingScreen === "dashboard" && screenRef.current === "dashboard") {
          window.history.back();
        }
        return;
      }

      

      // GUARD: back terjadi DAN sebelumnya kita sudah di dashboard (bukan
      // datang dari screen lain) → ini upaya keluar dari halaman utama,
      // bukan navigasi biasa. Tahan, pasang ulang guard, tampilkan konfirmasi.
      if (incomingScreen === "dashboard" && screenRef.current === "dashboard") {
        window.history.pushState({ screen: "dashboard", guard: true }, "");
        setShowExitConfirm(true);
        return;
      }

      // Navigasi back biasa antar screen
      setScreen(incomingScreen);
      if (state && "selectedInspeksiId" in state) setSelectedInspeksiId(state.selectedInspeksiId ?? null);
      if (state && "selectedTugasId" in state) setSelectedTugasId(state.selectedTugasId ?? null);
      if (state && "detailKategoriType"  in state) setDetailKategoriType(state.detailKategoriType ?? null);
      if (state && "detailKategoriValue" in state) setDetailKategoriValue(state.detailKategoriValue ?? null);
      if (state && "filteredInspFilter"  in state) setFilteredInspFilter(state.filteredInspFilter ?? null);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // FIX EXIT CONFIRM: dipanggil saat user klik "Ya, Keluar" di dialog
  const confirmExit = () => {
    setShowExitConfirm(false);
    allowExitRef.current = true;
    window.history.back();
  };

  const cancelExit = () => {
    setShowExitConfirm(false);
    // Tidak perlu push apa pun lagi — posisi history sudah di-restore
    // (guard entry) tepat sebelum dialog ini ditampilkan.
  };

  const handleLogin = (r) => {
    setRole(r);
    enterDashboard();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const nav = (s) => {
    if (s === "dashboard-tugas") {
      setScreen("dashboard");
      setInitialTab("tugas");
    } else if (s === "dashboard") {
      enterDashboard();
    } else {
      setInitialTab("beranda");
      window.history.pushState({ screen: s }, "");    
      setScreen(s);
    }
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

  // Task A — buka halaman detail kategori dari pie/bar chart (Pertamina)
  const openKategori = (filterType, filterValue) => {
    setDetailKategoriType(filterType);
    setDetailKategoriValue(filterValue);
    window.history.pushState(
      { screen: "detail-kategori", detailKategoriType: filterType, detailKategoriValue: filterValue },
      ""
    );
    setScreen("detail-kategori");
  };

  // Task B — buka halaman list inspeksi terfilter dari StatCard (Teknisi)
  const openFilteredInspeksi = (filterType) => {
    setFilteredInspFilter(filterType);
    window.history.pushState(
      { screen: "filtered-inspeksi", filteredInspFilter: filterType },
      ""
    );
    setScreen("filtered-inspeksi");
  };

  const renderDashboard = () => {
    if (role === "pertamina") {
      return (
        <PertaminaDashboard
          onNav={nav}
          onLogout={handleLogout}
          onOpenDetail={openDetail}
          onOpenKategori={openKategori}
        />
      );
    }
    return (
      <DashboardScreen
        role={role}
        onNav={nav}
        onLogout={handleLogout}
        onOpenDetail={openDetail}
        onOpenTugas={openTugas}
        initialTab={initialTab}
        onOpenKategori={openFilteredInspeksi}
      />
    );
  }
  

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

  const knownScreens = ["login", "register", "dashboard", "form", "history", "maintenance", "detail", "tugas-detail", "riwayat-kerusakan", "detail-kategori", "filtered-inspeksi", "404", "forgot-password", "reset-password"];
  const safeScreen = knownScreens.includes(screen) ? screen : "login";

  return (
    <div style={containerStyle}>
      <GlobalStyles />
      <div style={innerStyle}>
        {safeScreen === "login"        && <LoginScreen    onLogin={handleLogin} onGoRegister={() => nav("register")} onForgotPassword={() => setScreen("forgot-password")} />}
        {safeScreen === "register"     && <RegisterScreen onBack={() => window.history.back()} />}
        {safeScreen === "dashboard"    && renderDashboard()}
        {safeScreen === "form"         && <FormScreen onBack={() => window.history.back()} onNav={nav} />}
        {safeScreen === "history"      && <RiwayatScreen role={role} onNav={nav} onOpenDetail={openDetail} />}
        {safeScreen === "maintenance"  && <MaintenanceScreen role={role} onNav={nav} />}
        {safeScreen === "detail"       && <DetailScreen inspeksiId={selectedInspeksiId} onBack={() => window.history.back()} />}
        {safeScreen === "tugas-detail" && <TugasDetailScreen tugasId={selectedTugasId} onBack={() => window.history.back()} />}
        {safeScreen === "riwayat-kerusakan" && <RiwayatKerusakanScreen onBack={() => window.history.back()} />}
        {safeScreen === "detail-kategori" && (
          <DetailKategoriScreen
            filterType={detailKategoriType}
            filterValue={detailKategoriValue}
            onBack={() => window.history.back()}
            onOpenDetail={openDetail}
          />
        )}
        {safeScreen === "filtered-inspeksi" && (
          <FilteredInspeksiScreen
            filterType={filteredInspFilter}
            onBack={() => window.history.back()}
            onOpenDetail={openDetail}
          />
        )}
        {safeScreen === "forgot-password" && (
          <ForgotPasswordScreen navigate={setScreen} />
        )}
        {safeScreen === "reset-password" && (
          <ResetPasswordScreen navigate={setScreen} />
        )}
      </div>

      {/* FIX EXIT CONFIRM: dialog konfirmasi keluar dari halaman utama */}
      {showExitConfirm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2000,
          }}
        >
          <div
            style={{
              background: theme.surface,
              borderRadius: 16,
              padding: 24,
              width: "90%",
              maxWidth: 320,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 800, color: theme.text, marginBottom: 8 }}>
              Keluar dari aplikasi?
            </div>
            <div style={{ fontSize: 13, color: theme.textMuted, marginBottom: 20 }}>
              Kamu akan keluar dari GPS &amp; CCTV Checker.
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={cancelExit}
                style={{
                  flex: 1,
                  padding: "10px 0",
                  borderRadius: 10,
                  border: `1.5px solid ${theme.border}`,
                  background: theme.surface,
                  color: theme.text,
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: "'DM Sans', sans-serif",
                  cursor: "pointer",
                }}
              >
                Batal
              </button>
              <button
                onClick={confirmExit}
                style={{
                  flex: 1,
                  padding: "10px 0",
                  borderRadius: 10,
                  border: "none",
                  background: theme.danger,
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: "'DM Sans', sans-serif",
                  cursor: "pointer",
                }}
              >
                Ya, Keluar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;