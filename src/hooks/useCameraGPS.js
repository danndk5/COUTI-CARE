import { useRef, useCallback } from "react";

// ── Cache level-modul (bertahan selama sesi app, bukan per-komponen) ──────────
// Setelah kamera & GPS diizinkan SEKALI, request berikutnya tidak perlu
// menunggu dialog izin lagi. Posisi GPS diambil dari watcher yang jalan terus
// di background selama layar aktif, jadi saat tombol "Ambil Foto" ditekan,
// posisi biasanya SUDAH ada di tangan — tidak perlu menunggu fix GPS baru.
// Ini yang bikin foto ke-2, ke-3, dst (temuan / bukti perbaikan) terasa
// secepat foto kedap yang cuma diambil sekali.
let cameraGranted = false;
let lastPosition = null;
let watchId = null;
let watcherRefCount = 0;

function startWatcher() {
  watcherRefCount += 1;
  if (watchId !== null) return;
  watchId = navigator.geolocation.watchPosition(
    (pos) => { lastPosition = pos; },
    () => {}, // diamkan error watcher — requestAccess() tetap punya fallback getCurrentPosition
    { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
  );
}

function stopWatcher() {
  watcherRefCount = Math.max(0, watcherRefCount - 1);
  if (watcherRefCount === 0 && watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
}

export function useCameraGPS() {
  const startedRef = useRef(false);

  // Panggil sekali saat LAYAR (bukan tiap tombol foto) mulai dipakai —
  // mis. saat HSEFormScreen atau TindakLanjutDetail mount — supaya GPS
  // sudah "hangat" jauh sebelum user sempat menekan tombol foto pertama.
  const warmUp = useCallback(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    startWatcher();
  }, []);

  // Panggil saat layar tsb unmount, supaya GPS watcher dimatikan (hemat baterai).
  const coolDown = useCallback(() => {
    if (!startedRef.current) return;
    startedRef.current = false;
    stopWatcher();
  }, []);

  // Dipanggil dari tombol "Ambil Foto". Kalau kamera sudah pernah diizinkan
  // & posisi sudah tersedia dari watcher, ini selesai HAMPIR SEKETIKA.
  const requestAccess = useCallback(async () => {
    if (cameraGranted && lastPosition) {
      return lastPosition;
    }

    const tasks = [];

    if (!cameraGranted) {
      tasks.push(
        navigator.mediaDevices
          .getUserMedia({ video: { facingMode: "environment" } })
          .then((stream) => {
            stream.getTracks().forEach((t) => t.stop());
            cameraGranted = true;
          })
      );
    }

    if (!lastPosition) {
      tasks.push(
        new Promise((res, rej) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => { lastPosition = pos; res(pos); },
            rej,
            { enableHighAccuracy: true, timeout: 15000 }
          );
        })
      );
    }

    await Promise.all(tasks);
    return lastPosition;
  }, []);

  return { warmUp, coolDown, requestAccess };
}