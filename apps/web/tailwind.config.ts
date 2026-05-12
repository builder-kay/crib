import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: ['selector', 'html.theme-dark'],
  theme: {
    extend: {
      fontFamily: {
        display: ["'Manrope'", "sans-serif"],
        body: ["'Plus Jakarta Sans'", "sans-serif"]
      },
      colors: {
        cobalt: {
          50: "#eef4ff",
          100: "#dce8ff",
          200: "#bfd3ff",
          300: "#95b5ff",
          400: "#638dff",
          500: "#3663ff",
          600: "#1f46ef",
          700: "#1a38d6",
          800: "#1d31ae",
          900: "#1f3189"
        },
        lagoon: {
          50: "#ecfffd",
          100: "#d1fbf8",
          200: "#a8f5f0",
          300: "#71ebe6",
          400: "#37d8d4",
          500: "#1eb8b5",
          600: "#159391",
          700: "#157573",
          800: "#175d5b",
          900: "#174e4c"
        },
        sunset: {
          50: "#fff4f0",
          100: "#ffe4d9",
          200: "#ffc6ae",
          300: "#ffa178",
          400: "#ff7442",
          500: "#fb4f1d",
          600: "#e33910",
          700: "#bc2d0f",
          800: "#962713",
          900: "#7a2514"
        },
        orchid: {
          50: "#faf4ff",
          100: "#f1e4ff",
          200: "#e3c7ff",
          300: "#d2a1ff",
          400: "#b96dff",
          500: "#9e38ff",
          600: "#8a1cf5",
          700: "#7510db",
          800: "#6113b4",
          900: "#501590"
        },
        ember: {
          50: "#fff8f3",
          100: "#ffe8d2",
          200: "#ffd2a8",
          300: "#ffb67a",
          400: "#f89242",
          500: "#e6721f",
          600: "#b85716",
          700: "#8f4515",
          800: "#713915",
          900: "#5c3014"
        },
        forest: {
          100: "#d9f4e7",
          200: "#b1e7d0",
          300: "#7fd6b2",
          400: "#4dc194",
          500: "#2c9f73",
          600: "#1f7d5a",
          700: "#1d634a",
          800: "#1b4e3d",
          900: "#173f33"
        },
        sand: {
          50: "#f8f9fb",
          100: "#f1f3f7",
          200: "#e3e7ee",
          300: "#d1d7e3",
          400: "#a0a9bb",
          500: "#6d778d",
          600: "#555f75",
          700: "#434c62",
          800: "#30384c",
          900: "#1f2536"
        },
        ink: "#101324"
      },
      boxShadow: {
        card: "0 10px 24px -20px rgba(23, 30, 49, 0.45)",
        glow: "0 16px 36px -20px rgba(31, 70, 239, 0.46)"
      },
      backgroundImage: {
        "sunrise-grid": "radial-gradient(circle at 1px 1px, rgba(17,24,39,0.08) 1px, transparent 0)",
        "warm-glow": "linear-gradient(135deg, rgba(54,99,255,0.12), rgba(17,24,39,0.07))",
        "brand-spectrum": "linear-gradient(120deg, #1f46ef 0%, #9e38ff 45%, #fb4f1d 100%)",
        "aqua-sun": "linear-gradient(135deg, #1eb8b5 0%, #1f46ef 55%, #fb4f1d 100%)"
      },
      backgroundSize: {
        pattern: "22px 22px"
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        }
      },
      animation: {
        "fade-up": "fade-up 0.45s ease-out"
      }
    }
  },
  plugins: []
};

export default config;
