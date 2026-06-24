// Helper untuk menghitung Health Score GPS & CCTV
// Setiap item "Normal" = sehat, "Abnormal" = bermasalah

export const calculateHealthScore = (inspeksi) => {
  // GPS: 2 item (segel, kabel)
  const gpsItems = [inspeksi.segel_gps, inspeksi.kabel_gps];
  const gpsNormalCount = gpsItems.filter(
    (s) => s?.toLowerCase() === "normal"
  ).length;
  const gpsScore = Math.round((gpsNormalCount / gpsItems.length) * 100);

  // CCTV: 6 item (3 kamera x 2 item: bricket + kabel)
  const cctvItems = [
    inspeksi.segel_bricket_dashcam,
    inspeksi.segel_kabel_dashcam,
    inspeksi.segel_bricket_kanan,
    inspeksi.segel_kabel_kanan,
    inspeksi.segel_bricket_kiri,
    inspeksi.segel_kabel_kiri,
  ];
  const cctvNormalCount = cctvItems.filter(
    (s) => s?.toLowerCase() === "normal"
  ).length;
  const cctvScore = Math.round((cctvNormalCount / cctvItems.length) * 100);

  // Overall: rata-rata GPS & CCTV
  const overallScore = Math.round((gpsScore + cctvScore) / 2);

  return {
    gps: gpsScore,
    cctv: cctvScore,
    overall: overallScore,
  };
};

export const getHealthStatus = (score) => {
  if (score >= 80) {
    return { label: "Baik", color: "#10B981", bg: "#D1FAE5", emoji: "🟢" };
  }
  if (score >= 60) {
    return { label: "Perlu Perhatian", color: "#F59E0B", bg: "#FEF3C7", emoji: "🟡" };
  }
  return { label: "Kritis", color: "#EF4444", bg: "#FEE2E2", emoji: "🔴" };
};