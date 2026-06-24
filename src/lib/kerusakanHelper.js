// Helper untuk mengelompokkan riwayat kerusakan per nomor polisi.
// Dipakai bersama oleh Dashboard (ringkasan top 3) dan RiwayatKerusakanScreen (detail lengkap).

export const getGroupedKerusakan = (inspeksiList) => {
  const withAbnormalDetail = inspeksiList
    .map((item) => {
      const gpsStatus =
        item.segel_gps?.toLowerCase() === "abnormal" ||
        item.kabel_gps?.toLowerCase() === "abnormal"
          ? "Error GPS"
          : "Normal";

      const cctvAbnormalParts = [];
      if (
        item.segel_bricket_dashcam?.toLowerCase() === "abnormal" ||
        item.segel_kabel_dashcam?.toLowerCase() === "abnormal"
      )
        cctvAbnormalParts.push("Dashcam");
      if (
        item.segel_bricket_kanan?.toLowerCase() === "abnormal" ||
        item.segel_kabel_kanan?.toLowerCase() === "abnormal"
      )
        cctvAbnormalParts.push("Kanan");
      if (
        item.segel_bricket_kiri?.toLowerCase() === "abnormal" ||
        item.segel_kabel_kiri?.toLowerCase() === "abnormal"
      )
        cctvAbnormalParts.push("Kiri");

      const cctvStatus =
        cctvAbnormalParts.length > 0
          ? `CCTV ${cctvAbnormalParts.join(", ")} Bermasalah`
          : "Normal";

      const isAbnormal = gpsStatus !== "Normal" || cctvStatus !== "Normal";

      return {
        id: item.id,
        nomor_polisi: item.nomor_polisi,
        nama_armada: item.nama_armada,
        gpsStatus,
        cctvStatus,
        tanggal: item.created_at,
        isAbnormal,
      };
    })
    .filter((item) => item.isAbnormal);

  const grouped = {};
  withAbnormalDetail.forEach((item) => {
    if (!grouped[item.nomor_polisi]) {
      grouped[item.nomor_polisi] = {
        nomor_polisi: item.nomor_polisi,
        nama_armada: item.nama_armada,
        riwayat: [],
      };
    }
    grouped[item.nomor_polisi].riwayat.push(item);
  });

  return Object.values(grouped).sort((a, b) => b.riwayat.length - a.riwayat.length);
};