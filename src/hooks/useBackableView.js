import { useEffect, useRef } from "react";
import { pushInternalView, popInternalViewById } from "./internalViewFlag";

// ── useBackableView ────────────────────────────────────────────────────────
// Membuat tombol Back bawaan HP (fisik/gesture Android) menutup SATU langkah
// tampilan internal (mis. detail -> list, atau lightbox -> tutup) alih-alih
// langsung tembus keluar ke halaman sebelumnya di riwayat browser — dan kalau
// beberapa tampilan internal bertumpuk (mis. lightbox foto di atas layar
// detail), 1x tombol back cuma menutup yang PALING ATAS, bukan sekaligus dua.
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
export function useBackableView(isOpen, closeFn) {
  const idRef = useRef(null);
  const closeFnRef = useRef(closeFn);
  closeFnRef.current = closeFn;

  useEffect(() => {
    if (isOpen && idRef.current === null) {
      window.history.pushState({ __view: true }, "");
      idRef.current = pushInternalView(() => closeFnRef.current());
    }
    if (!isOpen && idRef.current !== null) {
      popInternalViewById(idRef.current);
      idRef.current = null;
    }
  }, [isOpen]);

  // Jaga-jaga kalau komponen unmount total saat tampilan masih "terbuka".
  useEffect(() => {
    return () => {
      if (idRef.current !== null) {
        popInternalViewById(idRef.current);
        idRef.current = null;
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