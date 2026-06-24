import theme from "../styles/theme";

const Card = ({ children, style: s = {}, onClick, ...rest }) => (
  <div
    onClick={onClick}
    style={{
      background: theme.surface,
      border: `1px solid ${theme.border}`,
      borderRadius: 14,
      padding: 16,
      boxShadow: theme.shadow,
      ...s,
    }}
    {...rest}
  >
    {children}
  </div>
);

export default Card;