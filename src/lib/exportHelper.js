import { supabase } from "./supabase";

// ── Rentang tanggal dari pilihan periode di ExportScreen ────────────────────────
export const getDateRangeFromPeriode = (periode, customFrom, customTo) => {
  const now = new Date();
  let from;
  let to = new Date(now);
  to.setHours(23, 59, 59, 999);

  if (periode === "minggu_ini") {
    const day = now.getDay(); // 0 = Minggu
    const diffToMonday = day === 0 ? 6 : day - 1;
    from = new Date(now);
    from.setDate(now.getDate() - diffToMonday);
    from.setHours(0, 0, 0, 0);
  } else if (periode === "bulan_ini") {
    from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  } else if (periode === "6_bulan") {
    from = new Date(now);
    from.setMonth(from.getMonth() - 6);
    from.setHours(0, 0, 0, 0);
  } else if (periode === "custom") {
    from = customFrom ? new Date(`${customFrom}T00:00:00`) : new Date(0);
    to = customTo ? new Date(`${customTo}T23:59:59`) : to;
  } else {
    from = new Date(0);
  }

  return { fromISO: from.toISOString(), toISO: to.toISOString() };
};

// ── Cek status abnormal GPS & CCTV (sama dengan logic di PertaminaDashboard) ────
export const isGpsAbnormal = (item) => {
  const gpsNormal =
    item.segel_gps?.toLowerCase() === "normal" &&
    item.kabel_gps?.toLowerCase() === "normal";
  const cctvNormal =
    item.segel_bricket_dashcam?.toLowerCase() === "normal" &&
    item.segel_kabel_dashcam?.toLowerCase() === "normal" &&
    item.segel_bricket_kanan?.toLowerCase() === "normal" &&
    item.segel_kabel_kanan?.toLowerCase() === "normal" &&
    item.segel_bricket_kiri?.toLowerCase() === "normal" &&
    item.segel_kabel_kiri?.toLowerCase() === "normal";
  return !(gpsNormal && cctvNormal);
};

export const isHseBermasalah = (item) => item.status !== "lulus";
export const isP1Bermasalah = (item) => (item.inspeksi_p1_temuan?.length || 0) > 0;

// ── Ambil data 3 kategori sekaligus foto dokumentasinya ─────────────────────────
// kategori: array subset dari ["gps", "hse", "p1"]
export const fetchExportData = async ({ kategori, fromISO, toISO }) => {
  const result = { gps: [], hse: [], p1: [] };

  if (kategori.includes("gps")) {
    const { data, error } = await supabase
      .from("inspeksi")
      .select("*")
      .gte("created_at", fromISO)
      .lte("created_at", toISO)
      .order("created_at", { ascending: false });
    if (error) throw error;
    const list = data || [];

    const ids = list.map((i) => i.id);
    const fotoMap = {};
    if (ids.length > 0) {
      const { data: fotoData } = await supabase
        .from("foto_inspeksi")
        .select("*")
        .in("inspeksi_id", ids);
      (fotoData || []).forEach((f) => {
        (fotoMap[f.inspeksi_id] ??= []).push(f);
      });
    }
    result.gps = list.map((item) => ({ ...item, _foto: fotoMap[item.id] || [] }));
  }

  if (kategori.includes("hse")) {
    const { data, error } = await supabase
      .from("inspeksi_hse")
      .select("*")
      .gte("created_at", fromISO)
      .lte("created_at", toISO)
      .order("created_at", { ascending: false });
    if (error) throw error;
    const list = data || [];

    const ids = list.map((i) => i.id);
    const fotoMap = {};
    if (ids.length > 0) {
      const { data: fotoData } = await supabase
        .from("foto_inspeksi_hse")
        .select("*")
        .in("inspeksi_hse_id", ids);
      (fotoData || []).forEach((f) => {
        (fotoMap[f.inspeksi_hse_id] ??= []).push(f);
      });
    }
    result.hse = list.map((item) => ({ ...item, _foto: fotoMap[item.id] || [] }));
  }

  if (kategori.includes("p1")) {
    const { data, error } = await supabase
      .from("inspeksi_p1")
      .select("*, inspeksi_p1_temuan(id, judul, keterangan)")
      .gte("created_at", fromISO)
      .lte("created_at", toISO)
      .order("created_at", { ascending: false });
    if (error) throw error;
    const list = data || [];

    const ids = list.map((i) => i.id);
    const fotoMap = {};
    if (ids.length > 0) {
      const { data: fotoData } = await supabase
        .from("foto_inspeksi_p1")
        .select("*")
        .in("inspeksi_id", ids);
      (fotoData || []).forEach((f) => {
        (fotoMap[f.inspeksi_id] ??= []).push(f);
      });
    }
    result.p1 = list.map((item) => ({ ...item, _foto: fotoMap[item.id] || [] }));
  }

  return result;
};

// ── Ringkasan angka per kategori ─────────────────────────────────────────────
export const computeRingkasan = ({ gps = [], hse = [], p1 = [] }) => ({
  gps: { total: gps.length, bermasalah: gps.filter(isGpsAbnormal).length },
  hse: { total: hse.length, bermasalah: hse.filter(isHseBermasalah).length },
  p1:  { total: p1.length, bermasalah: p1.filter(isP1Bermasalah).length },
});

// ── Kendaraan paling sering bermasalah, digabung dari ketiga kategori ───────────
export const computeTopKerusakan = ({ gps = [], hse = [], p1 = [] }, limit = 10) => {
  const counter = {};

  const bump = (plat, transportir, kategori) => {
    if (!plat) return;
    if (!counter[plat]) {
      counter[plat] = { nomor_polisi: plat, transportir: transportir || "-", gps: 0, hse: 0, p1: 0, total: 0 };
    }
    counter[plat][kategori] += 1;
    counter[plat].total += 1;
    if (transportir && counter[plat].transportir === "-") counter[plat].transportir = transportir;
  };

  gps.filter(isGpsAbnormal).forEach((i) => bump(i.nomor_polisi, i.perusahaan_transportir, "gps"));
  hse.filter(isHseBermasalah).forEach((i) => bump(i.nomor_polisi, i.transportir, "hse"));
  p1.filter(isP1Bermasalah).forEach((i) => bump(i.nomor_polisi, i.transportir, "p1"));

  return Object.values(counter)
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
};