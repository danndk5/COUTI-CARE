// Konstanta layout responsif — dipakai bersama oleh App.jsx dan semua screen.
// JANGAN hardcode angka breakpoint/lebar di file lain. Import dari sini.

export const BREAKPOINT_DESKTOP = 768; // px — di atas ini dianggap "desktop"

export const MOBILE_MAX_WIDTH = 430;           // lebar container mobile (nilai lama, tidak berubah)
export const DESKTOP_CONTENT_MAX_WIDTH = 1280; // lebar maksimum area konten di desktop
export const DESKTOP_GRID_GAP = 20;            // gap antar kolom grid dashboard di desktop
export const SIDEBAR_WIDTH = 240;              // lebar sidebar — BELUM dipakai sampai BottomNav.jsx diupdate