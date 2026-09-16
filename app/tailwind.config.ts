import type { Config } from "tailwindcss";

/**
 * MetaTrial design tokens - Visual + Product Direction Handoff:
 * calm editorial surfaces, restrained warm neutrals, one signature accent
 * (deep "attestation" teal), semantic status colors reserved for state.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#FAF9F5",
        ink: "#1C1B18",
        muted: "#6E6A61",
        line: "#E8E4DC",
        attest: {
          DEFAULT: "#0D6E5F",
          deep: "#0A584C",
          tint: "#E9F2EF",
        },
        status: {
          success: "#2E7D4F",
          pending: "#9A6A15",
          danger: "#B3372E",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "-apple-system", "sans-serif"],
        serif: ["var(--font-serif)", "Iowan Old Style", "Georgia", "serif"],
      },
      maxWidth: {
        article: "42rem",
      },
    },
  },
  plugins: [],
};

export default config;
