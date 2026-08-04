import { useState, useEffect, useRef } from "react";
import Btn from "../components/Btn";
import Card from "../components/Card";
import Icon from "../components/Icon";
import Input from "../components/Input";
import theme from "../styles/theme";
import { supabase } from "../lib/supabase";
import * as XLSX from "xlsx";

const KATEGORI_OPTIONS = [
  { value: "merah_putih", label: "MT Merah Putih" },
  { value: "industri",    label: "MT Industri" },
];

const emptyForm = {
  nomor_polisi: "",
  nomor_lambung: "",
  transportir: "",
  kapasitas_mt: "",
  jumlah_kompartemen: "",
  kategori_mt: "",
  tanggal_stnk: "",
  masa_berlaku_head_truck: "",
  masa_berlaku_tangki: "",
};

const cekMasaBerlaku = (dateStr) => {
  if (!dateStr) return null;
  const hari = Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24));
  if (hari < 0) return "expired";
  if (hari <= 30) return "warning";
  return "ok";
};

const formatTanggal = (dateStr) => {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
};

// ── Hitung selisih tahun/bulan/hari antara 2 tanggal (generic) ───────────────
const diffYMD = (start, end) => {
  let years = end.getFullYear() - start.getFullYear();
  let months = end.getMonth() - start.getMonth();
  let days = end.getDate() - start.getDate();
  if (days < 0) {
    months -= 1;
    const prevMonthLastDay = new Date(end.getFullYear(), end.getMonth(), 0).getDate();
    days += prevMonthLastDay;
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  return { years, months, days };
};

// ── Hitung Umur MT — dihitung ULANG setiap render, bukan disimpan statis ─────
// Supaya selalu update otomatis setiap hari begitu halaman dibuka.
const calcUmurMT = (tanggalStnk) => {
  if (!tanggalStnk) return null;
  const start = new Date(tanggalStnk);
  const now = new Date();
  if (isNaN(start.getTime())) return null;
  const { years, months, days } = diffYMD(start, now);
  return `${years} Tahun, ${months} Bulan, ${days} Hari`;
};

// ── Hitung sisa waktu mundur sampai tanggal masa berlaku ─────────────────────
// null kalau tanggal sudah lewat (dianggap kadaluarsa, ditangani terpisah)
const calcSisaWaktu = (tanggalTarget) => {
  if (!tanggalTarget) return null;
  const target = new Date(tanggalTarget);
  const now = new Date();
  if (isNaN(target.getTime()) || target <= now) return null;
  const { years, months, days } = diffYMD(now, target);
  return `${years} Tahun, ${months} Bulan, ${days} Hari`;
};

// ── Nama bulan Indonesia untuk parsing tanggal teks ("03 Oktober 2028") ──────
const INDO_MONTHS = {
  januari: 1, februari: 2, maret: 3, april: 4, mei: 5, juni: 6,
  juli: 7, agustus: 8, september: 9, oktober: 10, november: 11, desember: 12,
};

// Konversi berbagai format tanggal Excel (serial number / DD-MM-YYYY / "DD Bulan YYYY") ke YYYY-MM-DD
const parseExcelDate = (val) => {
  if (!val) return null;

  if (typeof val === "number") {
    const date = XLSX.SSF.parse_date_code(val);
    if (!date) return null;
    return `${date.y}-${String(date.m).padStart(2, "0")}-${String(date.d).padStart(2, "0")}`;
  }

  const str = String(val).trim();

  // Format "03 Oktober 2028" (nama bulan Indonesia)
  const textMatch = str.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (textMatch) {
    const [, d, monthName, y] = textMatch;
    const monthNum = INDO_MONTHS[monthName.toLowerCase()];
    if (monthNum) return `${y}-${String(monthNum).padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // Format DD/MM/YYYY atau DD-MM-YYYY
  const numMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (numMatch) {
    const [, d, m, y] = numMatch;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // Sudah format YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

  return null;
};

const normalizeKategori = (val) => {
  if (!val) return "";
  const v = String(val).toLowerCase().trim();
  if (v.includes("merah") || v.includes("putih")) return "merah_putih";
  if (v.includes("industri")) return "industri";
  return "";
};

// Ambil hanya angka dari input, format jadi "X KL"
const formatKapasitas = (val) => {
  const digits = String(val).replace(/[^0-9]/g, "");
  if (!digits) return "";
  return `${parseInt(digits, 10)} KL`;
};

// ── Helper baca kolom Excel dengan nama header fleksibel ─────────────────────
const normalizeHeader = (s) => String(s).toUpperCase().replace(/[^A-Z0-9]/g, "");

const getVal = (row, aliases) => {
  const keys = Object.keys(row);
  for (const alias of aliases) {
    const target = normalizeHeader(alias);
    const foundKey = keys.find((k) => normalizeHeader(k) === target);
    if (foundKey !== undefined && row[foundKey] !== "") return row[foundKey];
  }
  return "";
};

// ── FormModal — tambah / edit kendaraan (manual) ─────────────────────────────
const FormModal = ({ initial, onClose, onSaved }) => {
  const [form, setForm] = useState(initial || emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const isEdit = !!initial;

  const setF = (k) => (v) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.nomor_polisi.trim()) { setError("Nomor Polisi wajib diisi."); return; }
    if (!form.transportir.trim()) { setError("Transportir wajib diisi."); return; }
    if (!form.kapasitas_mt.trim()) { setError("Kapasitas MT wajib diisi."); return; }
    if (!form.jumlah_kompartemen) { setError("Jumlah Kompartemen wajib diisi."); return; }
    if (!form.kategori_mt) { setError("Kategori MT wajib dipilih."); return; }

    setSaving(true);
    setError("");
    try {
      const payload = {
        nomor_polisi: form.nomor_polisi.trim().toUpperCase(),
        nomor_lambung: form.nomor_lambung?.trim() || null,
        transportir: form.transportir.trim(),
        kapasitas_mt: form.kapasitas_mt.trim(),
        jumlah_kompartemen: parseInt(form.jumlah_kompartemen),
        kategori_mt: form.kategori_mt,
        tanggal_stnk: form.tanggal_stnk || null,
        masa_berlaku_head_truck: form.masa_berlaku_head_truck || null,
        masa_berlaku_tangki: form.masa_berlaku_tangki || null,
        updated_at: new Date().toISOString(),
      };

      const { error: err } = await supabase
        .from("kendaraan")
        .upsert(payload, { onConflict: "nomor_polisi" });

      if (err) throw err;

      onSaved();
      onClose();
    } catch (err) {
      setError("Gagal menyimpan: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 2000,
      display: "flex", alignItems: "flex-end", justifyContent: "center",
    }}>
      <div style={{
        background: theme.surface, borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 430,
        maxHeight: "88vh", overflowY: "auto", padding: 20,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontWeight: 800, fontSize: 17, color: theme.text }}>
            {isEdit ? "Edit Kendaraan" : "Tambah Kendaraan"}
          </div>
          <div onClick={onClose} style={{ cursor: "pointer", fontSize: 20, color: theme.textMuted }}>✕</div>
        </div>

        <Input
          label="Nomor Polisi"
          placeholder="Contoh: B 1234 XY"
          value={form.nomor_polisi}
          onChange={isEdit ? undefined : (v) => setF("nomor_polisi")(v.toUpperCase())}
          disabled={isEdit}
        />
        {isEdit && (
          <div style={{ fontSize: 11, color: theme.textMuted, marginTop: -8, marginBottom: 12 }}>
            Nomor Polisi tidak bisa diubah (kunci utama data).
          </div>
        )}

        <Input label="Nomor Lambung (opsional)" placeholder="Contoh: BTG-01" value={form.nomor_lambung} onChange={setF("nomor_lambung")} />
        <Input label="Pemilik Mobil" placeholder="PT. ..." value={form.transportir} onChange={(v) => setF("transportir")(v.toUpperCase())} />
        <Input label="Kapasitas MT" placeholder="Contoh: 10" value={form.kapasitas_mt} onChange={(v) => setF("kapasitas_mt")(formatKapasitas(v))} />
        <Input label="Jumlah Kompartemen" placeholder="1 / 2 / 3" value={form.jumlah_kompartemen} onChange={setF("jumlah_kompartemen")} />

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: theme.text, marginBottom: 6 }}>Kategori MT</div>
          <div style={{ display: "flex", gap: 8 }}>
            {KATEGORI_OPTIONS.map((opt) => (
              <div
                key={opt.value}
                onClick={() => setF("kategori_mt")(opt.value)}
                style={{
                  flex: 1, textAlign: "center", padding: "9px 0", borderRadius: 10,
                  fontSize: 12, fontWeight: 600, cursor: "pointer",
                  background: form.kategori_mt === opt.value ? theme.primary : theme.surfaceAlt,
                  color: form.kategori_mt === opt.value ? "#fff" : theme.textMuted,
                  border: `1.5px solid ${form.kategori_mt === opt.value ? theme.primary : theme.border}`,
                }}
              >
                {opt.label}
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: theme.text, marginBottom: 6 }}>Tanggal Pembuatan STNK</div>
          <input
            type="date"
            value={form.tanggal_stnk || ""}
            onChange={(e) => setF("tanggal_stnk")(e.target.value)}
            style={{
              width: "100%", padding: "10px 12px", borderRadius: 10,
              border: `1.5px solid ${theme.border}`, fontSize: 13,
              fontFamily: "'DM Sans', sans-serif", boxSizing: "border-box", outline: "none",
            }}
          />
          {form.tanggal_stnk && (
            <div style={{ fontSize: 11, color: theme.primary, fontWeight: 600, marginTop: 6 }}>
              Umur MT saat ini: {calcUmurMT(form.tanggal_stnk)}
            </div>
          )}
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: theme.text, marginBottom: 6 }}>Masa Berlaku Head Truck</div>
          <input
            type="date"
            value={form.masa_berlaku_head_truck || ""}
            onChange={(e) => setF("masa_berlaku_head_truck")(e.target.value)}
            style={{
              width: "100%", padding: "10px 12px", borderRadius: 10,
              border: `1.5px solid ${theme.border}`, fontSize: 13,
              fontFamily: "'DM Sans', sans-serif", boxSizing: "border-box", outline: "none",
            }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: theme.text, marginBottom: 6 }}>Masa Berlaku Tangki</div>
          <input
            type="date"
            value={form.masa_berlaku_tangki || ""}
            onChange={(e) => setF("masa_berlaku_tangki")(e.target.value)}
            style={{
              width: "100%", padding: "10px 12px", borderRadius: 10,
              border: `1.5px solid ${theme.border}`, fontSize: 13,
              fontFamily: "'DM Sans', sans-serif", boxSizing: "border-box", outline: "none",
            }}
          />
        </div>

        {error && (
          <div style={{ fontSize: 12, color: theme.danger, fontWeight: 600, marginBottom: 12, padding: "8px 12px", background: theme.dangerLight, borderRadius: 8 }}>
            ⚠️ {error}
          </div>
        )}

        <Btn onClick={handleSave} variant="primary" disabled={saving}>
          {saving ? "Menyimpan..." : "Simpan"}
        </Btn>
      </div>
    </div>
  );
};

// ── ImportModal — import massal dari Excel ───────────────────────────────────
const ImportModal = ({ onClose, onSaved }) => {
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const fileInputRef = useRef(null);

  const downloadTemplate = () => {
    const headers = [
      "Nomor Lambung", "Nomor Polisi", "Pemilik Mobil", "Kapasitas Max (KL)",
      "Kompartment", "Kategori MT", "Tanggal Pembuatan Mobil (STNK)",
      "Masa Berlaku Head Truck", "Masa Berlaku Tangki",
    ];
    const contoh = [
      "BTG-01", "B 9697 SEI", "PT. Contoh Transportir", "24",
      "3", "MT Merah Putih", "03 Oktober 2023",
      "03 Oktober 2028", "03 Oktober 2027",
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers, contoh]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template Kendaraan");
    XLSX.writeFile(wb, "template-data-kendaraan.xlsx");
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: "binary", cellDates: false });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet, { defval: "" });

        const parsed = json.map((row, idx) => {
          const nomor_lambung = String(getVal(row, ["Nomor Lambung"])).trim() || null;
          const nomor_polisi  = String(getVal(row, ["Nomor Polisi"])).trim().toUpperCase();
          const transportir   = String(getVal(row, ["Pemilik Mobil", "Transportir"])).trim();
          const kapasitasRaw  = getVal(row, ["Kapasitas Max (KL)", "Kapasitas MT", "Kapasitas"]);
          const kapasitas_mt  = kapasitasRaw ? formatKapasitas(kapasitasRaw) : "";
          const jumlah_kompartemen = parseInt(getVal(row, ["Kompartment", "Kompartemen", "Jumlah Kompartemen"])) || null;
          const kategori_mt   = normalizeKategori(getVal(row, ["Kategori MT"]));
          const tanggal_stnk  = parseExcelDate(getVal(row, ["Tanggal Pembuatan Mobil (STNK)", "Tanggal Pembuatan STNK", "Tanggal STNK"]));
          const masa_berlaku_head_truck = parseExcelDate(getVal(row, ["Masa Berlaku Head Truck"]));
          const masa_berlaku_tangki     = parseExcelDate(getVal(row, ["Masa Berlaku Tangki"]));

          const rowErrors = [];
          if (!nomor_polisi) rowErrors.push("Nomor Polisi kosong");
          if (!transportir) rowErrors.push("Pemilik Mobil / Transportir kosong");
          if (!kapasitas_mt) rowErrors.push("Kapasitas MT tidak valid");
          if (!jumlah_kompartemen) rowErrors.push("Kompartment tidak valid");
          if (!kategori_mt) rowErrors.push("Kategori MT tidak dikenali (isi 'MT Merah Putih' atau 'MT Industri')");

          return {
            _rowIndex: idx + 2,
            nomor_lambung, nomor_polisi, transportir, kapasitas_mt, jumlah_kompartemen,
            kategori_mt, tanggal_stnk, masa_berlaku_head_truck, masa_berlaku_tangki,
            _errors: rowErrors,
          };
        });

        setRows(parsed);
      } catch (err) {
        alert("Gagal membaca file: " + err.message);
      }
    };
    reader.readAsBinaryString(file);
  };

  const validRows = rows.filter((r) => r._errors.length === 0);
  const invalidRows = rows.filter((r) => r._errors.length > 0);

  const handleImport = async () => {
    if (validRows.length === 0) { alert("Tidak ada baris valid untuk diimport."); return; }
    setImporting(true);

    try {
      const payload = validRows.map((r) => ({
        nomor_polisi: r.nomor_polisi,
        nomor_lambung: r.nomor_lambung,
        transportir: r.transportir,
        kapasitas_mt: r.kapasitas_mt,
        jumlah_kompartemen: r.jumlah_kompartemen,
        kategori_mt: r.kategori_mt,
        tanggal_stnk: r.tanggal_stnk,
        masa_berlaku_head_truck: r.masa_berlaku_head_truck,
        masa_berlaku_tangki: r.masa_berlaku_tangki,
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from("kendaraan")
        .upsert(payload, { onConflict: "nomor_polisi" });

      if (error) throw error;

      setResult({ success: validRows.length, failed: invalidRows.length });
      onSaved();
    } catch (err) {
      alert("Gagal import: " + err.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 2000,
      display: "flex", alignItems: "flex-end", justifyContent: "center",
    }}>
      <div style={{
        background: theme.surface, borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 430,
        maxHeight: "88vh", overflowY: "auto", padding: 20,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontWeight: 800, fontSize: 17, color: theme.text }}>Import dari Excel</div>
          <div onClick={onClose} style={{ cursor: "pointer", fontSize: 20, color: theme.textMuted }}>✕</div>
        </div>

        {!result && (
          <>
            <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 14, lineHeight: 1.6 }}>
              Upload file Excel dengan kolom: <b>Nomor Lambung</b> (opsional), <b>Nomor Polisi</b>,
              <b> Pemilik Mobil</b>, <b>Kapasitas Max (KL)</b>, <b>Kompartment</b>, <b>Kategori MT</b>
              (isi "MT Merah Putih" atau "MT Industri"), <b>Tanggal Pembuatan Mobil (STNK)</b>,
              <b> Masa Berlaku Head Truck</b>, <b>Masa Berlaku Tangki</b>.
              Format tanggal bebas: "03 Oktober 2028" atau "03/10/2028".
            </div>

            <Btn onClick={downloadTemplate} variant="outline" style={{ marginBottom: 14, fontSize: 13 }}>
              📥 Download Template Excel
            </Btn>

            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              style={{ display: "none" }}
            />
            <Btn onClick={() => fileInputRef.current?.click()} variant="outline" style={{ marginBottom: 16, fontSize: 13 }}>
              📂 {fileName || "Pilih File Excel"}
            </Btn>

            {rows.length > 0 && (
              <>
                <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                  <div style={{ flex: 1, padding: "10px", borderRadius: 10, background: theme.successLight, textAlign: "center" }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: theme.success }}>{validRows.length}</div>
                    <div style={{ fontSize: 11, color: theme.success }}>Valid</div>
                  </div>
                  <div style={{ flex: 1, padding: "10px", borderRadius: 10, background: theme.dangerLight, textAlign: "center" }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: theme.danger }}>{invalidRows.length}</div>
                    <div style={{ fontSize: 11, color: theme.danger }}>Error</div>
                  </div>
                </div>

                {invalidRows.length > 0 && (
                  <div style={{ marginBottom: 14, maxHeight: 180, overflowY: "auto" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: theme.danger, marginBottom: 6 }}>
                      Baris bermasalah (tidak akan diimport):
                    </div>
                    {invalidRows.map((r) => (
                      <div key={r._rowIndex} style={{ fontSize: 11, color: theme.textMuted, padding: "6px 10px", background: theme.dangerLight, borderRadius: 6, marginBottom: 4 }}>
                        Baris {r._rowIndex} ({r.nomor_polisi || "?"}): {r._errors.join(", ")}
                      </div>
                    ))}
                  </div>
                )}

                <Btn onClick={handleImport} variant="primary" disabled={importing || validRows.length === 0}>
                  {importing ? "Mengimport..." : `Import ${validRows.length} Kendaraan`}
                </Btn>
              </>
            )}
          </>
        )}

        {result && (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: theme.text, marginBottom: 6 }}>
              Import Selesai
            </div>
            <div style={{ fontSize: 13, color: theme.textMuted, marginBottom: 20 }}>
              {result.success} kendaraan berhasil diimport
              {result.failed > 0 && `, ${result.failed} baris dilewati karena error`}
            </div>
            <Btn onClick={onClose} variant="primary">Selesai</Btn>
          </div>
        )}
      </div>
    </div>
  );
};

// ── AdminKendaraanScreen ───────────────────────────────────────────────────────
const AdminKendaraanScreen = ({ role, onNav, onBack }) => {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editing, setEditing] = useState(null);

  const loadData = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("kendaraan")
      .select("*")
      .order("nomor_polisi", { ascending: true });
    if (error) console.error("Error load kendaraan:", error);
    setList(data || []);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const handleDelete = async (nomor_polisi) => {
    if (!window.confirm(`Hapus data kendaraan ${nomor_polisi}? Tindakan ini tidak bisa dibatalkan.`)) return;
    const { error } = await supabase.from("kendaraan").delete().eq("nomor_polisi", nomor_polisi);
    if (error) { alert("Gagal menghapus: " + error.message); return; }
    loadData();
  };

  const handleExport = () => {
    const headers = [
      "Nomor Lambung", "Nomor Polisi", "Pemilik Mobil", "Kapasitas Max (KL)",
      "Kompartment", "Kategori MT", "Tanggal Pembuatan Mobil (STNK)", "Umur MT",
      "Masa Berlaku Head Truck", "Masa Berlaku Tangki",
    ];
    const rows = filteredList.map((k) => [
      k.nomor_lambung || "",
      k.nomor_polisi,
      k.transportir || "",
      k.kapasitas_mt || "",
      k.jumlah_kompartemen || "",
      k.kategori_mt === "merah_putih" ? "MT Merah Putih" : k.kategori_mt === "industri" ? "MT Industri" : (k.kategori_mt || ""),
      k.tanggal_stnk || "",
      calcUmurMT(k.tanggal_stnk) || "",
      k.masa_berlaku_head_truck || "",
      k.masa_berlaku_tangki || "",
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data Kendaraan");
    XLSX.writeFile(wb, `data-kendaraan-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const filteredList = list.filter((k) =>
    !search.trim() ||
    k.nomor_polisi?.toLowerCase().includes(search.toLowerCase()) ||
    k.transportir?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ minHeight: "100vh", background: theme.bg, paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ background: theme.surface, padding: "48px 16px 16px", borderBottom: `1px solid ${theme.border}`, boxShadow: theme.shadow }}>
        <div onClick={() => (onBack ? onBack() : onNav("dashboard"))} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14, cursor: "pointer", color: theme.textSub, fontSize: 13 }}>
          <Icon name="arrow" size={16} color={theme.textSub} /> Kembali
        </div>
        <div style={{ fontWeight: 800, fontSize: 18, color: theme.text }}>Data Kendaraan</div>
        <div style={{ fontSize: 13, color: theme.textMuted, marginTop: 2 }}>{list.length} kendaraan terdaftar</div>

        <div style={{ marginTop: 14 }}>
          <input
            placeholder="Cari nomor polisi / transportir..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%", padding: "9px 12px", borderRadius: 10,
              border: `1.5px solid ${theme.border}`, fontSize: 13,
              fontFamily: "'DM Sans', sans-serif", boxSizing: "border-box", outline: "none",
            }}
          />
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          <Btn onClick={() => { setEditing(null); setShowForm(true); }} variant="primary" icon="plus" style={{ flex: "1 1 45%", fontSize: 13 }}>
            Tambah
          </Btn>
          <Btn onClick={() => setShowImport(true)} variant="outline" style={{ flex: "1 1 45%", fontSize: 13 }}>
            📊 Import Excel
          </Btn>
          <Btn onClick={handleExport} variant="outline" style={{ flex: "1 1 100%", fontSize: 13 }}>
            📤 Export Excel
          </Btn>
        </div>
      </div>

      {/* List */}
      <div style={{ padding: "16px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: theme.textMuted }}>Memuat data...</div>
        ) : filteredList.length === 0 ? (
          <Card style={{ padding: 32, textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🚛</div>
            <div style={{ fontSize: 14, color: theme.textMuted }}>
              {search ? "Tidak ada kendaraan sesuai pencarian" : "Belum ada data kendaraan"}
            </div>
          </Card>
        ) : (
          filteredList.map((k) => {
            const statusHT = cekMasaBerlaku(k.masa_berlaku_head_truck);
            const statusTK = cekMasaBerlaku(k.masa_berlaku_tangki);
            const adaWarning = statusHT === "expired" || statusHT === "warning" || statusTK === "expired" || statusTK === "warning";
            const umurMT = calcUmurMT(k.tanggal_stnk);

            return (
              <Card key={k.id} style={{ marginBottom: 12, padding: "14px 16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: theme.text }}>
                      {k.nomor_polisi} {k.nomor_lambung && <span style={{ fontWeight: 500, fontSize: 12, color: theme.textMuted }}>· {k.nomor_lambung}</span>}
                    </div>
                    <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>{k.transportir}</div>
                  </div>
                  {adaWarning && (
                    <div style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20, background: theme.dangerLight, color: theme.danger }}>
                      ⚠️ Perlu Perhatian
                    </div>
                  )}
                </div>

                <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 4 }}>
                  {k.kapasitas_mt} · {k.jumlah_kompartemen} kompartemen · {k.kategori_mt === "merah_putih" ? "MT Merah Putih" : k.kategori_mt === "industri" ? "MT Industri" : "-"}
                </div>

                {umurMT && (
                  <div style={{ fontSize: 11, color: theme.primary, fontWeight: 600, marginBottom: 4 }}>
                    Umur MT: {umurMT} <span style={{ color: theme.textMuted, fontWeight: 400 }}>(STNK: {formatTanggal(k.tanggal_stnk)})</span>
                  </div>
                )}

                {(() => {
                  const sisaHT = calcSisaWaktu(k.masa_berlaku_head_truck);
                  const sisaTK = calcSisaWaktu(k.masa_berlaku_tangki);
                  return (
                    <>
                      <div style={{ display: "flex", gap: 12, fontSize: 11, marginBottom: 4 }}>
                        <div style={{ color: statusHT === "expired" ? theme.danger : statusHT === "warning" ? "#F59E0B" : theme.textMuted }}>
                          Head Truck: {formatTanggal(k.masa_berlaku_head_truck)}
                          {statusHT === "expired" && " (Kadaluarsa)"}
                          {statusHT !== "expired" && sisaHT && ` (${sisaHT})`}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 12, fontSize: 11, marginBottom: 12 }}>
                        <div style={{ color: statusTK === "expired" ? theme.danger : statusTK === "warning" ? "#F59E0B" : theme.textMuted }}>
                          Tangki: {formatTanggal(k.masa_berlaku_tangki)}
                          {statusTK === "expired" && " (Kadaluarsa)"}
                          {statusTK !== "expired" && sisaTK && ` (${sisaTK})`}
                        </div>
                      </div>
                    </>
                  );
                })()}

                <div style={{ display: "flex", gap: 8, borderTop: `1px solid ${theme.border}`, paddingTop: 10 }}>
                  <Btn onClick={() => { setEditing(k); setShowForm(true); }} variant="ghost" style={{ flex: 1, fontSize: 12, padding: "8px" }}>
                    ✏️ Edit
                  </Btn>
                  <Btn onClick={() => handleDelete(k.nomor_polisi)} variant="ghost" style={{ flex: 1, fontSize: 12, padding: "8px", color: theme.danger }}>
                    🗑️ Hapus
                  </Btn>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {showForm && (
        <FormModal
          initial={editing}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={loadData}
        />
      )}

      {showImport && (
        <ImportModal
          onClose={() => { setShowImport(false); loadData(); }}
          onSaved={loadData}
        />
      )}
    </div>
  );
};

export default AdminKendaraanScreen;