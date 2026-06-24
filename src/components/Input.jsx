import theme from "../styles/theme";

const Input = ({ label, placeholder, value, onChange, type = "text" }) => (
  <div style={{ marginBottom: 14 }}>
    {label && (
      <label
        style={{
          display: "block",
          fontSize: 12,
          color: theme.textSub,
          marginBottom: 6,
          fontWeight: 600,
        }}
      >
        {label}
      </label>
    )}
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: "100%",
        padding: "11px 14px",
        borderRadius: 10,
        border: `1.5px solid ${theme.border}`,
        background: theme.surface,
        color: theme.text,
        fontSize: 14,
        fontFamily: "'DM Sans', sans-serif",
        outline: "none",
        boxSizing: "border-box",
      }}
    />
  </div>
);

export default Input;