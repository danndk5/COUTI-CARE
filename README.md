src/
├── components/        ← Komponen kecil yang dipakai ulang
│   ├── Badge.jsx          Tampilan status Normal / Abnormal
│   ├── BottomNav.jsx      Navigasi bawah
│   ├── Btn.jsx            Tombol (primary, ghost, outline, danger)
│   ├── Card.jsx           Kotak kartu putih
│   ├── Icon.jsx           Semua ikon SVG
│   ├── Input.jsx          Field input teks / password / date
│   ├── SectionLabel.jsx   Label judul seksi (huruf kapital kecil)
│   └── ToggleStatus.jsx   Toggle Normal / Abnormal
├── screens/           ← Tiap halaman = 1 file
│   ├── LoginScreen.jsx
│   ├── RegisterScreen.jsx
│   ├── DashboardScreen.jsx
│   ├── FormScreen.jsx
│   ├── RiwayatScreen.jsx
│   └── MaintenanceScreen.jsx
├── styles/
│   ├── theme.js           Semua warna & nilai desain (edit di sini)
│   └── GlobalStyles.jsx   CSS global & font
├── App.jsx            ← Navigasi utama antar halaman
└── main.jsx           ← Entry point React

Cara Menjalankan
# 1. Install dependencies
npm install

# 2. Jalankan di browser
npm run dev

# 3. Build untuk production
npm run build

