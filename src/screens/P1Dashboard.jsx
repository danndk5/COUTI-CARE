const Placeholder = ({ label }) => (
  <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, background: "#F8FAFC" }}>
    <div style={{ fontSize: 32 }}>🚧</div>
    <div style={{ fontSize: 15, fontWeight: 700, color: "#334155" }}>{label}</div>
    <div style={{ fontSize: 12, color: "#94A3B8" }}>Halaman ini sedang dalam pengembangan</div>
  </div>
);

const P1Dashboard = (props) => <Placeholder label="Dashboard P1" />;
export default P1Dashboard;