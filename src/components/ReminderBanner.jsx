import { useState } from "react";
import { REMINDER_INFO } from "../lib/reminderHelper";

const ReminderBanner = ({ armadaList, maxShow = 3 }) => {
  const [expanded, setExpanded] = useState(false);

  // Hanya tampilkan yang butuh perhatian (bukan "aman")
  const needsAttention = armadaList.filter((a) => a.status !== "aman");

  if (needsAttention.length === 0) return null;

  const shown = needsAttention.slice(0, maxShow);
  const overdueCount = needsAttention.filter((a) => a.status === "overdue").length;

  return (
    <div style={{ marginBottom: 20 }}>
      <div
        onClick={() => setExpanded((e) => !e)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 14px",
          borderRadius: 12,
          background: "#F8FAFC",
          border: "1px solid #E2E8F0",
          cursor: "pointer",
          marginBottom: expanded ? 10 : 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#1E293B" }}>
            ⏰ Pengingat Inspeksi
          </div>
          <div style={{ fontSize: 11, color: "#64748B" }}>
            ({needsAttention.length} armada)
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
          <div
            style={{
              fontSize: 12,
              color: "#64748B",
              transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.15s",
            }}
          >
            ▾
          </div>
        </div>
      </div>

      <div
        style={{
          maxHeight: expanded ? 2000 : 0,
          opacity: expanded ? 1 : 0,
          overflow: "hidden",
          transition: "max-height 0.3s ease, opacity 0.25s ease",
        }}
      >
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
    </div>
  );
};

export default ReminderBanner;