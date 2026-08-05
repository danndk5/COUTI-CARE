// ── internalViewFlag (stack LIFO global) ───────────────────────────────────
// Satu stack tunggal untuk SEMUA tampilan internal (sub-view/modal) yang
// dibuka lewat useBackableView di seluruh aplikasi — mis. daftar kendaraan
// di HSEDashboard, detail Tindak Lanjut, lightbox foto, dst.
//
// Kenapa harus satu stack + satu listener global (bukan listener per hook):
// kalau tiap useBackableView punya listener popstate sendiri-sendiri, semua
// listener itu ikut bereaksi ke SETIAP event popstate, bukan cuma event yang
// menutup entri miliknya. Akibatnya kalau ada 2 tampilan internal bertumpuk
// (mis. detail Tindak Lanjut lalu lightbox foto di atasnya), menutup yang
// paling atas (lightbox) dengan 1x tombol back malah ikut menutup yang di
// bawahnya juga (detail) — lompat 2 langkah sekaligus.
//
// Dengan satu stack + satu listener: setiap popstate cuma menutup entri
// PALING ATAS stack. Persis 1 langkah per 1x tombol back, tidak peduli
// berapa banyak tampilan internal yang sedang bertumpuk.
let stack = [];
let nextId = 1;
let listenerAttached = false;

function ensureGlobalListener() {
  if (listenerAttached) return;
  listenerAttached = true;
  window.addEventListener("popstate", () => {
    const top = stack.pop();
    if (top) top.closeFn();
  });
}

// Dipanggil useBackableView saat tampilan dibuka. Mengembalikan id unik
// yang dipakai untuk melepas entri ini lagi nanti (popInternalViewById).
export function pushInternalView(closeFn) {
  ensureGlobalListener();
  const id = nextId++;
  stack.push({ id, closeFn });
  return id;
}

// Lepas entri tertentu dari stack — dipanggil saat tampilan ditutup TANPA
// lewat popstate (mis. isOpen berubah false secara programatik), atau
// sebagai pembersihan setelah popstate menutupnya lewat jalur normal.
export function popInternalViewById(id) {
  const idx = stack.findIndex((e) => e.id === id);
  if (idx !== -1) stack.splice(idx, 1);
}

// Dipakai App.jsx: true selama ada tampilan internal yang masih terbuka,
// supaya App.jsx tahu untuk TIDAK menampilkan dialog "Keluar dari aplikasi?"
// saat popstate ini sebenarnya cuma menutup tampilan internal.
export function hasOpenInternalView() {
  return stack.length > 0;
}