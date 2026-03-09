/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          300: "#93c5fd",
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
          800: "#1e40af",
          900: "#1e3a8a",
          950: "#172554",
        },
        navy: {
          800: "#1e3a5f",
          900: "#0f2342",
          950: "#060f1e",
        },
        success: "#22c55e",
        warning: "#f59e0b",
        danger:  "#ef4444",
      },
      fontFamily: {
        sans:  ["Manrope", "system-ui", "sans-serif"],
        mono:  ["JetBrains Mono", "monospace"],
      },
      backgroundImage: {
        "gradient-radial":   "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":    "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
        "hero-gradient":     "linear-gradient(135deg, #060f1e 0%, #1e3a5f 50%, #0f2342 100%)",
        "card-gradient":     "linear-gradient(135deg, rgba(30,58,95,0.4) 0%, rgba(37,99,235,0.1) 100%)",
      },
      animation: {
        "fade-in":     "fadeIn 0.5s ease-in-out",
        "slide-up":    "slideUp 0.5s ease-out",
        "glow-pulse":  "glowPulse 2s infinite",
        "spin-slow":   "spin 3s linear infinite",
      },
      keyframes: {
        fadeIn:    { "0%": { opacity: 0 }, "100%": { opacity: 1 } },
        slideUp:   { "0%": { transform: "translateY(20px)", opacity: 0 }, "100%": { transform: "translateY(0)", opacity: 1 } },
        glowPulse: { "0%, 100%": { boxShadow: "0 0 20px rgba(37,99,235,0.3)" }, "50%": { boxShadow: "0 0 40px rgba(37,99,235,0.7)" } },
      },
      boxShadow: {
        glass:   "0 4px 30px rgba(0, 0, 0, 0.3)",
        glow:    "0 0 30px rgba(37, 99, 235, 0.4)",
        "glow-lg": "0 0 60px rgba(37, 99, 235, 0.3)",
      },
      backdropBlur: { glass: "12px" },
    },
  },
  plugins: [],
};
