// ── internalViewFlag ───────────────────────────────────────────────────────
// Flag global sederhana: aktif selama ada tampilan internal (sub-layar atau
// modal seperti daftar kendaraan di HSEDashboard, lightbox foto, dsb.) yang
// sedang terbuka lewat useBackableView.
//
// Dipakai App.jsx: sebelum menampilkan dialog "Keluar dari aplikasi?" saat
// tombol back ditekan di layar dashboard, App.jsx cek dulu apakah popstate
// ini sebenarnya cuma menutup tampilan internal (bukan usaha keluar beneran)
// — kalau iya, App.jsx diam saja dan biarkan useBackableView yang menangani.
let openCount = 0;

export function markInternalViewOpen() {
  openCount += 1;
}

export function markInternalViewClosed() {
  openCount = Math.max(0, openCount - 1);
}

export function hasOpenInternalView() {
  return openCount > 0;
}