import { useEffect, useRef } from "react";
import { markInternalViewOpen, markInternalViewClosed } from "./internalViewFlag";

// ── useBackableView ────────────────────────────────────────────────────────
// Membuat tombol Back bawaan HP (fisik/gesture Android) menutup SATU langkah
// tampilan internal (mis. detail -> list, atau lightbox -> tutup) alih-alih
// langsung tembus keluar ke halaman sebelumnya di riwayat browser.
//
// Pemakaian:
//   useBackableView(isOpen, closeFn)
// - isOpen  : true ketika tampilan/modal ini sedang aktif
// - closeFn : fungsi yang menutup tampilan ini (mis. () => setView("list"))
//
// PENTING: tombol "Kembali" versi UI (bukan tombol HP) HARUS memanggil
// goBack(closeFn) di bawah ini, BUKAN langsung memanggil closeFn. Supaya
// jalur tombol HP & tombol UI selalu konsisten dan tidak menyisakan
// riwayat "hantu" yang membuat tombol kembali berikutnya terasa aneh.
//
// Hook ini juga menandai internalViewFlag selagi tampilan terbuka, supaya
// App.jsx tahu untuk TIDAK menampilkan dialog "Keluar dari aplikasi?" saat
// popstate ini sebenarnya cuma menutup tampilan internal, bukan usaha keluar.
export function useBackableView(isOpen, closeFn) {
  const pushedRef = useRef(false);
  const markedRef = useRef(false);
  const closeFnRef = useRef(closeFn);
  closeFnRef.current = closeFn;

  useEffect(() => {
    if (isOpen && !pushedRef.current) {
      window.history.pushState({ __view: true }, "");
      pushedRef.current = true;
      markInternalViewOpen();
      markedRef.current = true;
    }
    if (!isOpen) {
      pushedRef.current = false;
      if (markedRef.current) {
        markInternalViewClosed();
        markedRef.current = false;
      }
    }
  }, [isOpen]);

  useEffect(() => {
    const handlePopState = () => {
      if (pushedRef.current) {
        pushedRef.current = false;
        if (markedRef.current) {
          markInternalViewClosed();
          markedRef.current = false;
        }
        closeFnRef.current();
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Jaga-jaga kalau komponen unmount total saat tampilan masih "terbuka"
  // (mis. user pindah layar lain lewat jalur yang bukan popstate/goBack).
  useEffect(() => {
    return () => {
      if (markedRef.current) {
        markInternalViewClosed();
        markedRef.current = false;
      }
    };
  }, []);
}

// Panggil dari tombol "Kembali" versi UI (bukan tombol HP) supaya jalurnya
// sama persis dengan tombol kembali bawaan HP — history yang mengontrol,
// bukan langsung memanggil closeFn.
export function goBack(fallbackFn) {
  if (window.history.state && window.history.state.__view) {
    window.history.back();
  } else if (fallbackFn) {
    fallbackFn();
  }
}