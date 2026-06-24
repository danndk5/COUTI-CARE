import { useState, useEffect, useRef } from "react";
import Btn from "../components/Btn";
import Icon from "../components/Icon";
import Input from "../components/Input";
import SectionLabel from "../components/SectionLabel";
import ToggleStatus from "../components/ToggleStatus";
import theme from "../styles/theme";
import { supabase } from "../lib/supabase";

// ── Sub-komponen lokal (di luar FormScreen agar tidak re-create saat re-render) ──

const CheckItem = ({ label, status, onStatus, ket, onKet }) => (
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
      <textarea
        placeholder="Tuliskan keterangan temuan..."
        value={ket}
        onChange={(e) => onKet(e.target.value)}
        style={{
          marginTop: 10,
          width: "100%",
          padding: "10px 12px",
          borderRadius: 10,
          border: `1.5px solid ${theme.danger}`,
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
    )}
  </div>
);

const PhotoUpload = ({ label, kategori, onPhotos }) => {
  const [photos, setPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);

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

    // FIX: kasih tau user kalau ada foto yang gagal upload — sebelumnya
    // cuma console.error dan dianggap "berhasil" secara diam-diam.
    if (failedFiles.length > 0) {
      alert(
        `⚠️ ${failedFiles.length} foto gagal diupload:\n${failedFiles.join(
          ", "
        )}\n\nSilakan coba upload ulang foto tersebut.`
      );
    }

    // FIX: reset value supaya user bisa pilih ulang file yang sama (mis. setelah retry)
    e.target.value = "";
  };

  const handleRemovePhoto = async (path) => {
    await supabase.storage.from("foto-inspeksi").remove([path]);
    setPhotos((prev) => prev.filter((p) => p.path !== path));
    onPhotos((prev) => prev.filter((p) => p.path !== path));
  };

  return (
    <div
      style={{
        border: `2px dashed ${theme.border}`,
        borderRadius: 12,
        padding: "18px 16px",
        textAlign: "center",
        marginBottom: 16,
      }}
    >
      <Icon name="photo" size={28} color={theme.textMuted} />
      <div style={{ fontSize: 13, color: theme.textMuted, marginTop: 8 }}>
        {label}
      </div>
      <div style={{ marginTop: 12 }}>
        <label style={{ display: "inline-block" }}>
          <input
            type="file"
            multiple
            accept="image/*"
            onChange={handleFileChange}
            disabled={uploading}
            style={{ display: "none" }}
          />
          <Btn
            as="span"
            onClick={(e) => e.currentTarget.parentElement?.querySelector("input")?.click()}
            variant="outline"
            style={{ padding: "9px", fontSize: 13, cursor: "pointer" }}
          >
            {uploading ? "Uploading..." : "Pilih Foto"}
          </Btn>
        </label>
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
  );
};

// FIX: CamSection dipindah ke luar FormScreen, terima cctv & setCctvField sebagai props
// supaya tidak di-recreate setiap re-render (yang menyebabkan textarea kehilangan fokus)
const CamSection = ({ title, cam, cctv, setCctvField }) => (
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
    />
    <CheckItem
      label="Segel Sambungan Kabel"
      status={cctv[cam].segel_kabel}
      onStatus={setCctvField(cam, "segel_kabel")}
      ket={cctv[cam].ket_kabel}
      onKet={setCctvField(cam, "ket_kabel")}
    />
  </div>
);

// ── FormScreen ────────────────────────────────────────────────────────────────

const FormScreen = ({ onBack, onNav }) => {
  const [step, setStep] = useState(1);
  const [currentUser, setCurrentUser] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [photos, setPhotos] = useState([]);

  // FIX (foto orphan): ref untuk tracking apakah laporan sudah berhasil tersimpan.
  // Dipakai oleh cleanup-on-unmount di bawah — kalau user keluar form (klik "Kembali")
  // SETELAH upload foto tapi SEBELUM submit berhasil, foto yang nyangkut di storage
  // otomatis dihapus supaya tidak jadi orphan permanen.
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
        const { data: profile, error: profileErr } = await supabase
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

  const handleSubmit = async () => {
    // Validasi Data Kendaraan
    if (!kendaraan.plat || !kendaraan.armada) {
      alert("Data kendaraan (Nomor Polisi & Nama Armada) wajib diisi!");
      setStep(1);
      return;
    }

    // Validasi GPS
    if (!gps.segel.status || !gps.kabel.status) {
      alert("Kondisi GPS (Segel & Kabel) wajib diisi!");
      setStep(2);
      return;
    }

    // FIX (validasi CCTV): sebelumnya field CCTV sama sekali tidak divalidasi,
    // jadi bisa submit dengan 6 field CCTV kosong total.
    const cctvFields = [
      cctv.dashcam.segel_bricket,
      cctv.dashcam.segel_kabel,
      cctv.kanan.segel_bricket,
      cctv.kanan.segel_kabel,
      cctv.kiri.segel_bricket,
      cctv.kiri.segel_kabel,
    ];
    if (cctvFields.some((f) => !f)) {
      alert("Semua kondisi CCTV (Dashcam, Kanan, Kiri) wajib diisi!");
      setStep(3);
      return;
    }

    setSubmitting(true);

    // FIX (fix finally): semua reset state ada di satu tempat (finally),
    // jadi gak ada celah lupa setSubmitting(false) kalau nanti try-block ditambah logic baru.
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
          // FIX (upload error notif): sebelumnya cuma console.error lalu tetap
          // alert "berhasil" — user dikira semua aman padahal foto gagal ke-link.
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
      // FIX (foto orphan): insert ke tabel "inspeksi" gagal, padahal foto-foto
      // sudah keburu ke-upload ke storage di step GPS/CCTV. Tanpa cleanup ini,
      // foto tersebut akan nyangkut permanen tanpa referensi apapun di database.
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
            />
            <CheckItem
              label="Kabel GPS"
              status={gps.kabel.status}
              onStatus={setGpsField("kabel", "status")}
              ket={gps.kabel.ket}
              onKet={setGpsField("kabel", "ket")}
            />
            <SectionLabel style={{ marginTop: 8 }}>
              Foto Dokumentasi GPS
            </SectionLabel>
            <PhotoUpload
              label="Foto GPS, Segel & Kabel"
              kategori="gps"
              onPhotos={setPhotos}
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
            />
            <CamSection
              title="Kanan"
              cam="kanan"
              cctv={cctv}
              setCctvField={setCctvField}
            />
            <CamSection
              title="Kiri"
              cam="kiri"
              cctv={cctv}
              setCctvField={setCctvField}
            />
            <SectionLabel>Foto Dokumentasi CCTV</SectionLabel>
            <PhotoUpload
              label="Foto semua kamera CCTV"
              kategori="cctv"
              onPhotos={setPhotos}
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
        {step < 3 ? (
          <Btn
            onClick={() => setStep((s) => s + 1)}
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