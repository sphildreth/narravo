/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx,js,jsx}", "./components/**/*.{ts,tsx,js,jsx}", "./pages/**/*.{ts,tsx,js,jsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        fg: "var(--fg)",
        muted: "var(--muted)",
        border: "var(--border)",
        brand: "var(--brand)",
        "brand-contrast": "var(--brand-contrast)",
        card: "var(--card)",
        "card-fg": "var(--card-fg)",
        accent: "var(--accent)",
        "accent-contrast": "var(--accent-contrast)",
      },
      borderRadius: { xl: "var(--radius)", "2xl": "calc(var(--radius) + 6px)" },
      boxShadow: { soft: "var(--shadow)" },
      maxWidth: { screen: "var(--maxw)" }
    },
  },
  plugins: [],
};
