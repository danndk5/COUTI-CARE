import { getHealthStatus } from "../lib/healthScore";

const HealthBadge = ({ score, label, size = "normal" }) => {
  const status = getHealthStatus(score);

  const isSmall = size === "small";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
      }}
    >
      <div
        style={{
          width: isSmall ? 56 : 72,
          height: isSmall ? 56 : 72,
          borderRadius: "50%",
          background: status.bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          border: `3px solid ${status.color}`,
        }}
      >
        <div
          style={{
            fontSize: isSmall ? 14 : 18,
            fontWeight: 800,
            color: status.color,
          }}
        >
          {score}%
        </div>
      </div>
      {label && (
        <div style={{ fontSize: 11, color: "#64748B", fontWeight: 600, textAlign: "center" }}>
          {label}
        </div>
      )}
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: status.color,
        }}
      >
        {status.emoji} {status.label}
      </div>
    </div>
  );
};

export default HealthBadge;