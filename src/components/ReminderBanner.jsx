import { REMINDER_INFO } from "../lib/reminderHelper";

const ReminderBanner = ({ armadaList, maxShow = 3 }) => {
  // Hanya tampilkan yang butuh perhatian (bukan "aman")
  const needsAttention = armadaList.filter((a) => a.status !== "aman");

  if (needsAttention.length === 0) return null;

  const shown = needsAttention.slice(0, maxShow);
  const overdueCount = needsAttention.filter((a) => a.status === "overdue").length;

  return (
    <div style={{ marginBottom: 20 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 700, color: "#1E293B" }}>
          ⏰ Pengingat Inspeksi
        </div>
        {overdueCount > 0 && (
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#fff",
              background: "#EF4444",
              padding: "2px 8px",
              borderRadius: 10,
            }}
          >
            {overdueCount} Overdue
          </div>
        )}
      </div>

      {shown.map((a) => {
        const info = REMINDER_INFO[a.status];
        return (
          <div
            key={a.nomor_polisi}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 14px",
              borderRadius: 12,
              background: info.bg,
              marginBottom: 8,
            }}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#1E293B" }}>
                {a.nomor_polisi}
              </div>
              <div style={{ fontSize: 11, color: "#64748B", marginTop: 1 }}>
                {a.nama_armada} · {a.perusahaan_transportir}
              </div>
            </div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: info.color,
                whiteSpace: "nowrap",
              }}
            >
              {info.emoji} {info.label}
            </div>
          </div>
        );
      })}

      {needsAttention.length > maxShow && (
        <div style={{ fontSize: 11, color: "#64748B", textAlign: "center", marginTop: 4 }}>
          +{needsAttention.length - maxShow} armada lainnya perlu perhatian
        </div>
      )}
    </div>
  );
};

export default ReminderBanner;