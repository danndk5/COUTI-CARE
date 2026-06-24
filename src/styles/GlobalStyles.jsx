const GlobalStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    * {
      box-sizing: border-box;
      -webkit-tap-highlight-color: transparent;
    }

    body {
      margin: 0;
      padding: 0;
      font-family: 'DM Sans', sans-serif;
      background: #F8FAFC;
    }

    ::-webkit-scrollbar { width: 0; }

    input[type="date"]::-webkit-calendar-picker-indicator {
      opacity: 0.4;
    }

    textarea::placeholder,
    input::placeholder {
      color: #CBD5E1;
    }
  `}</style>
);

export default GlobalStyles;