import Icon from "./Icon";
import theme from "../styles/theme";

const variantStyles = {
  primary: {
    background: theme.primary,
    color: "#fff",
    boxShadow: "0 2px 8px rgba(37,99,235,0.25)",
    border: "none",
  },
  ghost: {
    background: theme.surfaceAlt,
    color: theme.textSub,
    boxShadow: "none",
    border: "none",
  },
  outline: {
    background: "#fff",
    color: theme.primary,
    border: `1.5px solid ${theme.primary}`,
    boxShadow: "none",
  },
  danger: {
    background: theme.dangerLight,
    color: theme.danger,
    boxShadow: "none",
    border: "none",
  },
};

const Btn = ({ children, onClick, variant = "primary", icon, style: s = {} }) => {
  const v = variantStyles[variant];
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        width: "100%",
        padding: "13px",
        borderRadius: 12,
        cursor: "pointer",
        fontFamily: "'DM Sans', sans-serif",
        fontWeight: 700,
        fontSize: 14,
        transition: "all 0.15s",
        ...v,
        ...s,
      }}
    >
      {icon && <Icon name={icon} size={17} color={v.color} />}
      {children}
    </button>
  );
};

export default Btn;