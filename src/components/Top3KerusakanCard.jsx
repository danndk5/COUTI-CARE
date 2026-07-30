import { useState } from "react";
import Icon from "./Icon";
import theme from "../styles/theme";

const Top3KerusakanCard = ({ groupedKerusakan, onViewAll }) => {
  const [expanded, setExpanded] = useState(false);

  if (!groupedKerusakan || groupedKerusakan.length === 0) return null;

  const top3 = groupedKerusakan.slice(0, 3);

  return (
    <div
      style={{
        background: theme.surface,
        border: `1px solid ${theme.border}`,
        borderRadius: 14,
        padding: 16,
        boxShadow: theme.shadow,
        marginBottom: 20,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: expanded ? 12 : 0,
        }}
      >
        <div
          onClick={() => setExpanded((e) => !e)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            cursor: "pointer",
            flex: 1,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, color: theme.text }}>
            🔧 Armada Paling Sering Rusak
          </div>
          <div style={{ fontSize: 11, color: theme.textMuted }}>
            ({groupedKerusakan.length})
          </div>
          <div
            style={{
              fontSize: 12,
              color: theme.textMuted,
              transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.15s",
            }}
          >
            ▾
          </div>
        </div>

        {onViewAll && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              onViewAll();
            }}
            style={{ fontSize: 11, color: theme.primary, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}
          >
            Lihat Semua →
          </div>
        )}
      </div>

      <div
        style={{
          maxHeight: expanded ? 1000 : 0,
          opacity: expanded ? 1 : 0,
          overflow: "hidden",
          transition: "max-height 0.3s ease, opacity 0.25s ease",
        }}
      >
        {top3.map((g, i) => (
          <div
            key={g.nomor_polisi}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 0",
              borderTop: i > 0 ? `1px solid ${theme.border}` : "none",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: theme.dangerLight,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  fontWeight: 800,
                  color: theme.danger,
                }}
              >
                {i + 1}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: theme.text }}>
                  {g.nomor_polisi}
                </div>
                <div style={{ fontSize: 11, color: theme.textMuted }}>{g.nama_armada}</div>
              </div>
            </div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: theme.danger,
                background: theme.dangerLight,
                padding: "3px 10px",
                borderRadius: 20,
              }}
            >
              {g.riwayat.length}x
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Top3KerusakanCard;