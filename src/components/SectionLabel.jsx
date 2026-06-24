import theme from "../styles/theme";

const SectionLabel = ({ children }) => (
  <div
    style={{
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: 1,
      color: theme.textMuted,
      textTransform: "uppercase",
      marginBottom: 10,
      marginTop: 4,
    }}
  >
    {children}
  </div>
);

export default SectionLabel;