// Helper untuk menghitung status reminder/escalation inspeksi per armada.
// Aturan: inspeksi wajib setiap 7 hari sejak inspeksi terakhir per nomor polisi.
//   H+1 setelah jatuh tempo -> "perhatian" (kuning)
//   H+3 setelah jatuh tempo -> "mendesak" (oranye)
//   H+7 setelah jatuh tempo -> "overdue" (merah)

const INTERVAL_HARI = 7; // wajib inspeksi ulang tiap 7 hari

const parseAsUTC = (timestamp) => {
  if (!timestamp) return null;
  const hasTimezoneInfo = /Z$|[+-]\d{2}:\d{2}$/.test(timestamp);
  const fixedTimestamp = hasTimezoneInfo ? timestamp : `${timestamp}Z`;
  return new Date(fixedTimestamp);
};

const diffInDays = (from, to) => {
  const ms = to.getTime() - from.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
};

/**
 * Hitung status reminder untuk satu armada berdasarkan tanggal inspeksi terakhir.
 * @param {string} lastInspeksiDate - created_at dari inspeksi terakhir (ISO string)
 * @returns {{ status: 'aman'|'perhatian'|'mendesak'|'overdue', hariSejakJatuhTempo: number, jatuhTempo: Date }}
 */
export const getReminderStatus = (lastInspeksiDate) => {
  const lastDate = parseAsUTC(lastInspeksiDate);
  if (!lastDate) {
    return { status: "overdue", hariSejakJatuhTempo: null, jatuhTempo: null };
  }

  const now = new Date();
  const jatuhTempo = new Date(lastDate);
  jatuhTempo.setDate(jatuhTempo.getDate() + INTERVAL_HARI);

  const hariSejakJatuhTempo = diffInDays(jatuhTempo, now);

  let status = "aman";
  if (hariSejakJatuhTempo >= 7) status = "overdue";
  else if (hariSejakJatuhTempo >= 3) status = "mendesak";
  else if (hariSejakJatuhTempo >= 1) status = "perhatian";

  return { status, hariSejakJatuhTempo, jatuhTempo };
};

export const REMINDER_INFO = {
  aman: { label: "Aman", color: "#10B981", bg: "#D1FAE5", emoji: "✅" },
  perhatian: { label: "Perlu Perhatian", color: "#F59E0B", bg: "#FEF3C7", emoji: "🟡" },
  mendesak: { label: "Mendesak", color: "#F97316", bg: "#FFEDD5", emoji: "🟠" },
  overdue: { label: "Overdue", color: "#EF4444", bg: "#FEE2E2", emoji: "🔴" },
};

/**
 * Dari list inspeksi (semua armada), kelompokkan per nomor_polisi
 * dan ambil yang terakhir, lalu hitung status reminder masing-masing.
 * @param {Array} inspeksiList - semua row dari tabel inspeksi
 * @returns {Array} list armada dengan status reminder, urut dari paling kritis
 */
export const getArmadaReminderList = (inspeksiList) => {
  const grouped = {};

  inspeksiList.forEach((item) => {
    const plat = item.nomor_polisi;
    if (!grouped[plat] || new Date(item.created_at) > new Date(grouped[plat].created_at)) {
      grouped[plat] = item;
    }
  });

  const result = Object.values(grouped).map((item) => {
    const reminder = getReminderStatus(item.created_at);
    return {
      nomor_polisi: item.nomor_polisi,
      nama_armada: item.nama_armada,
      perusahaan_transportir: item.perusahaan_transportir,
      lastInspeksi: item.created_at,
      ...reminder,
    };
  });

  // Urutkan: overdue dulu, lalu mendesak, perhatian, aman
  const order = { overdue: 0, mendesak: 1, perhatian: 2, aman: 3 };
  return result.sort((a, b) => order[a.status] - order[b.status]);
};