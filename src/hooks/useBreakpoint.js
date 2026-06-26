import { useState, useEffect } from "react";
import { BREAKPOINT_DESKTOP } from "../styles/layout";

// Hook tunggal untuk deteksi mobile vs desktop.
// SEMUA screen yang butuh tahu mode layout WAJIB pakai hook ini,
// jangan bikin window.innerWidth check sendiri-sendiri di tiap file.
export function useBreakpoint() {
  const [isDesktop, setIsDesktop] = useState(
    typeof window !== "undefined" ? window.innerWidth >= BREAKPOINT_DESKTOP : false
  );

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= BREAKPOINT_DESKTOP);
    handleResize(); // sinkronkan sekali saat mount
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return isDesktop;
}