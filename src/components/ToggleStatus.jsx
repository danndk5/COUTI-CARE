import theme from "../styles/theme";

const ToggleStatus = ({ value, onChange }) => (
  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
    {["Normal", "Abnormal"].map((s) => (
      <button
        key={s}
        onClick={() => onChange(s)}
        style={{
          flex: 1,
          padding: "10px 0",
          borderRadius: 10,
          border: "none",
          cursor: "pointer",
          fontFamily: "'DM Sans', sans-serif",
          fontWeight: 600,
          fontSize: 13,
          background:
            value === s
              ? s === "Normal"
                ? theme.success
                : theme.danger
              : theme.surfaceAlt,
          color: value === s ? "#fff" : theme.textMuted,
          transition: "all 0.15s",
        }}
      >
        {s}
      </button>
    ))}
  </div>
);

export default ToggleStatus;