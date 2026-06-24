import theme from "../styles/theme";

const Badge = ({ status }) => (
  <span
    style={{
      display: "inline-block",
      padding: "3px 10px",
      borderRadius: 20,
      fontSize: 11,
      fontWeight: 700,
      background: status === "Normal" ? theme.successLight : theme.dangerLight,
      color: status === "Normal" ? theme.success : theme.danger,
    }}
  >
    {status}
  </span>
);

export default Badge;