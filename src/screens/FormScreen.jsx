import { useState, useEffect, useRef } from "react";
import Btn from "../components/Btn";
import Icon from "../components/Icon";
import Input from "../components/Input";
import SectionLabel from "../components/SectionLabel";
import ToggleStatus from "../components/ToggleStatus";
import theme from "../styles/theme";
import { supabase } from "../lib/supabase";

// ── Sub-komponen lokal (di luar FormScreen agar tidak re-create saat re-render) ──

const CheckItem = ({ label, status, onStatus, ket, onKet, errorKet }) => (
  <div
    style={{
      marginBottom: 14,
      padding: 14,
      borderRadius: 12,
      background: theme.surfaceAlt,
      border: `1px solid ${theme.border}`,
    }}
  >
    <div style={{ fontWeight: 600, fontSize: 14, color: theme.text }}>
      {label}
    </div>
    <ToggleStatus value={status} onChange={onStatus} />
    {status === "Abnormal" && (
      <>
        <textarea
          placeholder="Tuliskan keterangan temuan..."
          value={ket}
          onChange={(e) => onKet(e.target.value)}
          style={{
            marginTop: 10,
            width: "100%",
            padding: "10px 12px",
            borderRadius: 10,
            border: `1.5px solid ${errorKet ? theme.danger : theme.danger}`,
            background: theme.dangerLight,
            color: theme.text,
            fontSize: 13,
            fontFamily: "'DM Sans', sans-serif",
            resize: "none",
            minHeight: 70,
            boxSizing: "border-box",
            outline: "none",
          }}
        />
        {/* Pesan error keterangan wajib — tampil di bawah textarea */}
        {errorKet && (
          <div
            style={{
              marginTop: 5,
              fontSize: 12,
              color: theme.danger,
              fontWeight: 600,
            }}
          >
            ⚠️ Keterangan wajib diisi saat kondisi Abnormal.
          </div>
        )}
      </>
    )}
  </div>
);

// PhotoUpload: onPhotos = setter photos di parent (merged array semua kategori)
// hasPhoto: boolean dari parent — apakah kategori ini sudah punya foto?
// errorFoto: boolean — tampilkan pesan error foto belum diupload?
const PhotoUpload = ({ label, kategori, onPhotos, hasPhoto, errorFoto }) => {
  const [photos, setPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setUploading(true);
    const failedFiles = [];

    for (const file of files) {
      const timestamp = new Date().getTime();
      const fileName = `${kategori}-${timestamp}-${file.name}`;

      const { data, error } = await supabase.storage
        .from("foto-inspeksi")
        .upload(fileName, file);

      if (error) {
        console.error("Upload error:", error);
        failedFiles.push(file.name);
        continue;
      }

      const { data: publicData } = supabase.storage
        .from("foto-inspeksi")
        .getPublicUrl(data.path);

      const newPhoto = {
        name: file.name,
        url: publicData.publicUrl,
        path: data.path,
        timestamp: new Date(),
      };

      setPhotos((prev) => [...prev, newPhoto]);

      onPhotos((prev) => [
        ...prev,
        {
          kategori,
          url: newPhoto.url,
          path: newPhoto.path,
          timestamp: newPhoto.timestamp,
        },
      ]);
    }

    setUploading(false);

    // FIX: kasih tau user kalau ada foto yang gagal upload
    if (failedFiles.length > 0) {
      alert(
        `⚠️ ${failedFiles.length} foto gagal diupload:\n${failedFiles.join(
          ", "
        )}\n\nSilakan coba upload ulang foto tersebut.`
      );
    }

    // FIX: reset value supaya user bisa pilih ulang file yang sama
    e.target.value = "";
  };

  const handleRemovePhoto = async (path) => {
    await supabase.storage.from("foto-inspeksi").remove([path]);
    setPhotos((prev) => prev.filter((p) => p.path !== path));
    onPhotos((prev) => prev.filter((p) => p.path !== path));
  };

  // Border merah kalau ada error foto belum diupload
  const borderColor = errorFoto ? theme.danger : theme.border;

  return (
    <div style={{ marginBottom: 16 }}>
      <div
        style={{
          border: `2px dashed ${borderColor}`,
          borderRadius: 12,
          padding: "18px 16px",
          textAlign: "center",
          background: errorFoto ? theme.dangerLight : "transparent",
        }}
      >
        <Icon name="photo" size={28} color={errorFoto ? theme.danger : theme.textMuted} />
        <div style={{ fontSize: 13, color: errorFoto ? theme.danger : theme.textMuted, marginTop: 8 }}>
          {label}
        </div>
        <div style={{ marginTop: 12 }}>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            onChange={handleFileChange}
            disabled={uploading}
            style={{ display: "none" }}
          />
          <Btn
            onClick={() => fileInputRef.current?.click()}
            variant="outline"
            style={{ padding: "9px", fontSize: 13, cursor: "pointer" }}
          >
            {uploading ? "Uploading..." : "Pilih Foto"}
          </Btn>
        </div>

        {photos.length > 0 && (
          <div style={{ marginTop: 12 }}>
            {photos.map((photo) => (
              <div
                key={photo.path}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 12px",
                  background: theme.primaryLight,
                  borderRadius: 8,
                  marginBottom: 8,
                  fontSize: 12,
                  color: theme.primary,
                }}
              >
                <span>✓ {photo.name}</span>
                <div
                  onClick={() => handleRemovePhoto(photo.path)}
                  style={{
                    cursor: "pointer",
                    fontWeight: 700,
                    color: theme.danger,
                  }}
                >
                  ✕
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pesan error foto wajib — tampil di bawah kotak upload */}
      {errorFoto && (
        <div
          style={{
            marginTop: 6,
            fontSize: 12,
            color: theme.danger,
            fontWeight: 600,
          }}
        >
          ⚠️ Foto dokumentasi wajib diupload sebelum melanjutkan.
        </div>
      )}
    </div>
  );
};

// FIX: CamSection dipindah ke luar FormScreen, terima cctv & setCctvField sebagai props
// supaya tidak di-recreate setiap re-render (yang menyebabkan textarea kehilangan fokus)
// TAMBAHAN: terima errorsKet untuk passing error keterangan per field ke CheckItem
const CamSection = ({ title, cam, cctv, setCctvField, errorsKet }) => (
  <div style={{ marginBottom: 20 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: 9,
          background: theme.primaryLight,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon name="camera" size={15} color={theme.primary} />
      </div>
      <div style={{ fontWeight: 700, fontSize: 14, color: theme.text }}>
        CCTV {title}
      </div>
    </div>
    <CheckItem
      label="Segel Bricket"
      status={cctv[cam].segel_bricket}
      onStatus={setCctvField(cam, "segel_bricket")}
      ket={cctv[cam].ket_bricket}
      onKet={setCctvField(cam, "ket_bricket")}
      errorKet={errorsKet?.[cam]?.ket_bricket || false}
    />
    <CheckItem
      label="Segel Sambungan Kabel"
      status={cctv[cam].segel_kabel}
      onStatus={setCctvField(cam, "segel_kabel")}
      ket={cctv[cam].ket_kabel}
      onKet={setCctvField(cam, "ket_kabel")}
      errorKet={errorsKet?.[cam]?.ket_kabel || false}
    />
  </div>
);

// ── FormScreen ────────────────────────────────────────────────────────────────

const FormScreen = ({ onBack, onNav }) => {
  const [step, setStep] = useState(1);
  const [currentUser, setCurrentUser] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [photos, setPhotos] = useState([]);

  // ── State error validasi ──────────────────────────────────────────────────
  // Satu objek per step untuk menghindari state explosion.
  // Format gpsErrors: { segel: { ket: bool }, kabel: { ket: bool }, foto: bool }
  const [gpsErrors, setGpsErrors] = useState({
    segel: { ket: false },
    kabel: { ket: false },
    foto: false,
  });
  // Format cctvErrors: { [cam]: { ket_bricket: bool, ket_kabel: bool }, foto: bool }
  const [cctvErrors, setCctvErrors] = useState({
    dashcam: { ket_bricket: false, ket_kabel: false },
    kanan:   { ket_bricket: false, ket_kabel: false },
    kiri:    { ket_bricket: false, ket_kabel: false },
    foto: false,
  });

  // FIX (foto orphan): ref untuk tracking apakah laporan sudah berhasil tersimpan.
  const photosRef = useRef(photos);
  const submittedRef = useRef(false);

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  useEffect(() => {
    return () => {
      if (!submittedRef.current && photosRef.current.length > 0) {
        const paths = photosRef.current.map((p) => p.path).filter(Boolean);
        if (paths.length > 0) {
          supabase.storage
            .from("foto-inspeksi")
            .remove(paths)
            .catch((e) => console.error("Gagal cleanup foto saat keluar form:", e));
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [kendaraan, setKendaraan] = useState({
    plat: "",
    armada: "",
    pemeriksa: "",
    perusahaan: "",
  });
  const setK = (k) => (v) => setKendaraan((p) => ({ ...p, [k]: v }));

  const [gps, setGps] = useState({
    segel: { status: "", ket: "" },
    kabel: { status: "", ket: "" },
  });
  const setGpsField = (field, key) => (val) =>
    setGps((p) => ({ ...p, [field]: { ...p[field], [key]: val } }));

  const [cctv, setCctv] = useState({
    dashcam: {
      segel_bricket: "",
      segel_kabel: "",
      ket_bricket: "",
      ket_kabel: "",
    },
    kanan: {
      segel_bricket: "",
      segel_kabel: "",
      ket_bricket: "",
      ket_kabel: "",
    },
    kiri: {
      segel_bricket: "",
      segel_kabel: "",
      ket_bricket: "",
      ket_kabel: "",
    },
  });
  const setCctvField = (cam, field) => (val) =>
    setCctv((p) => ({ ...p, [cam]: { ...p[cam], [field]: val } }));

  // Load user info on mount
  useEffect(() => {
    const loadUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("nama, perusahaan")
          .eq("id", user.id)
          .single();

        setCurrentUser(user.id);

        setKendaraan((p) => ({
          ...p,
          pemeriksa: profile?.nama || "",
          perusahaan: profile?.perusahaan || "",
        }));
      }
    };

    loadUser();
  }, []);

  // ── Helper: cek foto per kategori dari merged photos array ─────────────────
  // photos = [{ kategori: "gps"|"cctv", url, path, timestamp }, ...]
  const hasGpsFoto  = photos.some((p) => p.kategori === "gps");
  const hasCctvFoto = photos.some((p) => p.kategori === "cctv");

  // ── Validasi step 2 (GPS) sebelum lanjut ke step 3 ────────────────────────
  const validateGps = () => {
    const newErrors = {
      segel: { ket: gps.segel.status === "Abnormal" && !gps.segel.ket.trim() },
      kabel: { ket: gps.kabel.status === "Abnormal" && !gps.kabel.ket.trim() },
      foto: !hasGpsFoto,
    };
    setGpsErrors(newErrors);

    const hasError =
      newErrors.segel.ket ||
      newErrors.kabel.ket ||
      newErrors.foto;

    return !hasError; // true = valid
  };

  // ── Validasi step 3 (CCTV) sebelum submit ─────────────────────────────────
  const validateCctv = () => {
    const kameraList = ["dashcam", "kanan", "kiri"];
    const newErrors = { foto: !hasCctvFoto };

    kameraList.forEach((cam) => {
      newErrors[cam] = {
        ket_bricket:
          cctv[cam].segel_bricket === "Abnormal" && !cctv[cam].ket_bricket.trim(),
        ket_kabel:
          cctv[cam].segel_kabel === "Abnormal" && !cctv[cam].ket_kabel.trim(),
      };
    });

    setCctvErrors(newErrors);

    const hasError =
      newErrors.foto ||
      kameraList.some(
        (cam) => newErrors[cam].ket_bricket || newErrors[cam].ket_kabel
      );

    return !hasError; // true = valid
  };

  // ── Handler tombol Lanjut (step 2 → 3) ────────────────────────────────────
  const handleNextFromGps = () => {
    // Validasi GPS kondisi wajib diisi (sudah ada sebelumnya)
    if (!gps.segel.status || !gps.kabel.status) {
      alert("Kondisi GPS (Segel & Kabel) wajib diisi!");
      return;
    }
    // Validasi baru: keterangan Abnormal + foto wajib
    if (!validateGps()) return;
    setStep(3);
  };

  const handleSubmit = async () => {
    // Validasi Data Kendaraan
    if (!kendaraan.plat || !kendaraan.armada) {
      alert("Data kendaraan (Nomor Polisi & Nama Armada) wajib diisi!");
      setStep(1);
      return;
    }

    // Validasi GPS (status wajib diisi — sudah ada sebelumnya)
    if (!gps.segel.status || !gps.kabel.status) {
      alert("Kondisi GPS (Segel & Kabel) wajib diisi!");
      setStep(2);
      return;
    }

    // Validasi CCTV status (sudah ada sebelumnya)
    const cctvStatusFields = [
      cctv.dashcam.segel_bricket,
      cctv.dashcam.segel_kabel,
      cctv.kanan.segel_bricket,
      cctv.kanan.segel_kabel,
      cctv.kiri.segel_bricket,
      cctv.kiri.segel_kabel,
    ];
    if (cctvStatusFields.some((f) => !f)) {
      alert("Semua kondisi CCTV (Dashcam, Kanan, Kiri) wajib diisi!");
      setStep(3);
      return;
    }

    // Validasi baru: keterangan Abnormal GPS + foto GPS (re-check saat submit)
    const gpsValid = validateGps();
    if (!gpsValid) {
      setStep(2);
      return;
    }

    // Validasi baru: keterangan Abnormal CCTV + foto CCTV
    const cctvValid = validateCctv();
    if (!cctvValid) {
      // Tetap di step 3, error sudah ditampilkan inline
      return;
    }

    setSubmitting(true);

    try {
      const { data: inspeksiData, error: inspeksiError } = await supabase
        .from("inspeksi")
        .insert([
          {
            user_id: currentUser,
            nomor_polisi: kendaraan.plat,
            nama_armada: kendaraan.armada,
            nama_pemeriksa: kendaraan.pemeriksa,
            perusahaan_transportir: kendaraan.perusahaan,
            segel_gps: gps.segel.status,
            segel_gps_ket: gps.segel.ket,
            kabel_gps: gps.kabel.status,
            kabel_gps_ket: gps.kabel.ket,
            segel_bricket_dashcam: cctv.dashcam.segel_bricket,
            segel_bricket_dashcam_ket: cctv.dashcam.ket_bricket,
            segel_kabel_dashcam: cctv.dashcam.segel_kabel,
            segel_kabel_dashcam_ket: cctv.dashcam.ket_kabel,
            segel_bricket_kanan: cctv.kanan.segel_bricket,
            segel_bricket_kanan_ket: cctv.kanan.ket_bricket,
            segel_kabel_kanan: cctv.kanan.segel_kabel,
            segel_kabel_kanan_ket: cctv.kanan.ket_kabel,
            segel_bricket_kiri: cctv.kiri.segel_bricket,
            segel_bricket_kiri_ket: cctv.kiri.ket_bricket,
            segel_kabel_kiri: cctv.kiri.segel_kabel,
            segel_kabel_kiri_ket: cctv.kiri.ket_kabel,
          },
        ])
        .select()
        .single();

      if (inspeksiError) throw inspeksiError;

      // Laporan utama berhasil tersimpan — tandai supaya cleanup-on-unmount
      // TIDAK menghapus foto ini lagi (foto sudah punya "rumah", bukan orphan).
      submittedRef.current = true;

      if (photos.length > 0) {
        const fotoData = photos.map((p) => ({
          inspeksi_id: inspeksiData.id,
          url: p.url,
          kategori: p.kategori,
          timestamp_foto: p.timestamp,
        }));

        const { error: fotoError } = await supabase
          .from("foto_inspeksi")
          .insert(fotoData);

        if (fotoError) {
          console.error("Foto error:", fotoError);
          alert(
            "⚠️ Laporan inspeksi berhasil tersimpan, TAPI foto gagal disimpan ke laporan.\n\n" +
              "Silakan buka detail laporan ini lalu upload ulang fotonya, atau hubungi admin.\n\n" +
              "Detail error: " + fotoError.message
          );
          onNav("dashboard");
          return;
        }
      }

      alert("✓ Data berhasil disimpan!");
      onNav("dashboard");
    } catch (error) {
      // FIX (foto orphan): insert ke tabel "inspeksi" gagal, cleanup foto
      if (photos.length > 0) {
        const paths = photos.map((p) => p.path).filter(Boolean);
        if (paths.length > 0) {
          const { error: cleanupError } = await supabase.storage
            .from("foto-inspeksi")
            .remove(paths);
          if (cleanupError) {
            console.error("Gagal cleanup foto orphan:", cleanupError);
          }
        }
      }
      alert("Gagal menyimpan data: " + error.message + "\n\nSilakan coba lagi.");
    } finally {
      setSubmitting(false);
    }
  };

  const steps = ["Kendaraan", "GPS", "CCTV"];

  return (
    <div
      style={{
        minHeight: "100vh",
        background: theme.bg,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: theme.surface,
          padding: "48px 16px 16px",
          borderBottom: `1px solid ${theme.border}`,
          boxShadow: theme.shadow,
        }}
      >
        <div
          onClick={onBack}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginBottom: 14,
            cursor: "pointer",
            color: theme.textSub,
            fontSize: 13,
          }}
        >
          <Icon name="arrow" size={16} color={theme.textSub} /> Kembali
        </div>
        <div
          style={{
            fontWeight: 800,
            fontSize: 18,
            color: theme.text,
            marginBottom: 16,
          }}
        >
          Form Pengecekan
        </div>

        {/* Step Indicator */}
        <div style={{ display: "flex", alignItems: "center" }}>
          {steps.map((s, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                flex: i < steps.length - 1 ? 1 : 0,
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background:
                      step > i + 1
                        ? theme.success
                        : step === i + 1
                        ? theme.primary
                        : theme.surfaceAlt,
                    fontSize: 12,
                    fontWeight: 700,
                    color: step >= i + 1 ? "#fff" : theme.textMuted,
                  }}
                >
                  {step > i + 1 ? (
                    <Icon name="check" size={13} color="#fff" />
                  ) : (
                    i + 1
                  )}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    marginTop: 4,
                    color:
                      step === i + 1 ? theme.primary : theme.textMuted,
                    fontWeight: step === i + 1 ? 700 : 400,
                  }}
                >
                  {s}
                </div>
              </div>
              {i < steps.length - 1 && (
                <div
                  style={{
                    flex: 1,
                    height: 2,
                    background:
                      step > i + 1 ? theme.success : theme.border,
                    margin: "0 6px",
                    marginBottom: 14,
                  }}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "20px 16px",
          paddingBottom: 90,
        }}
      >
        {/* Step 1 — Kendaraan */}
        {step === 1 && (
          <>
            <SectionLabel>Data Kendaraan</SectionLabel>
            <div
              style={{
                background: theme.surface,
                borderRadius: 14,
                padding: 16,
                border: `1px solid ${theme.border}`,
              }}
            >
              <Input
                label="Nomor Polisi"
                placeholder="B 1234 XY"
                value={kendaraan.plat}
                onChange={setK("plat")}
              />
              <Input
                label="Nama Armada"
                placeholder="Truk Tangki 01"
                value={kendaraan.armada}
                onChange={setK("armada")}
              />
              <Input
                label="Nama Pemeriksa"
                placeholder="Nama Pemeriksa"
                value={kendaraan.pemeriksa}
                onChange={setK("pemeriksa")}
              />
              <Input
                label="Perusahaan Transportir"
                placeholder="PT. ..."
                value={kendaraan.perusahaan}
                onChange={setK("perusahaan")}
              />
              <div
                style={{
                  fontSize: 12,
                  color: theme.textMuted,
                  marginTop: 8,
                }}
              >
                📅 {new Date().toLocaleDateString("id-ID")} · 🕐{" "}
                {new Date().toLocaleTimeString("id-ID", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>
          </>
        )}

        {/* Step 2 — GPS */}
        {step === 2 && (
          <>
            <SectionLabel>Kondisi GPS</SectionLabel>
            <CheckItem
              label="Kondisi Segel GPS"
              status={gps.segel.status}
              onStatus={setGpsField("segel", "status")}
              ket={gps.segel.ket}
              onKet={setGpsField("segel", "ket")}
              errorKet={gpsErrors.segel.ket}
            />
            <CheckItem
              label="Kabel GPS"
              status={gps.kabel.status}
              onStatus={setGpsField("kabel", "status")}
              ket={gps.kabel.ket}
              onKet={setGpsField("kabel", "ket")}
              errorKet={gpsErrors.kabel.ket}
            />
            <SectionLabel style={{ marginTop: 8 }}>
              Foto Dokumentasi GPS
            </SectionLabel>
            <PhotoUpload
              label="Foto GPS, Segel & Kabel"
              kategori="gps"
              onPhotos={setPhotos}
              hasPhoto={hasGpsFoto}
              errorFoto={gpsErrors.foto}
            />
          </>
        )}

        {/* Step 3 — CCTV */}
        {step === 3 && (
          <>
            <SectionLabel>Kondisi CCTV</SectionLabel>
            <CamSection
              title="Dashcam"
              cam="dashcam"
              cctv={cctv}
              setCctvField={setCctvField}
              errorsKet={cctvErrors}
            />
            <CamSection
              title="Kanan"
              cam="kanan"
              cctv={cctv}
              setCctvField={setCctvField}
              errorsKet={cctvErrors}
            />
            <CamSection
              title="Kiri"
              cam="kiri"
              cctv={cctv}
              setCctvField={setCctvField}
              errorsKet={cctvErrors}
            />
            <SectionLabel>Foto Dokumentasi CCTV</SectionLabel>
            <PhotoUpload
              label="Foto semua kamera CCTV"
              kategori="cctv"
              onPhotos={setPhotos}
              hasPhoto={hasCctvFoto}
              errorFoto={cctvErrors.foto}
            />
          </>
        )}
      </div>

      {/* Bottom Action */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: "100%",
          maxWidth: 430,
          padding: "12px 16px",
          background: theme.surface,
          borderTop: `1px solid ${theme.border}`,
          display: "flex",
          gap: 10,
        }}
      >
        {step > 1 && (
          <Btn
            onClick={() => setStep((s) => s - 1)}
            variant="ghost"
            style={{ flex: 0.5, padding: "12px", fontSize: 13 }}
            disabled={submitting}
          >
            ← Kembali
          </Btn>
        )}
        {step < 2 ? (
          <Btn
            onClick={() => setStep((s) => s + 1)}
            variant="primary"
            disabled={submitting}
          >
            Lanjut →
          </Btn>
        ) : step === 2 ? (
          <Btn
            onClick={handleNextFromGps}
            variant="primary"
            disabled={submitting}
          >
            Lanjut →
          </Btn>
        ) : (
          <Btn
            onClick={handleSubmit}
            variant="primary"
            icon="check"
            disabled={submitting}
          >
            {submitting ? "Menyimpan..." : "Simpan & Kirim"}
          </Btn>
        )}
      </div>
    </div>
  );
};

export default FormScreen;