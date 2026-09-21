/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        navy: "#1B2A4A",
        "navy-light": "#2C4066",
        parchment: "#F7F5F0",
        "parchment-dark": "#ECE7DC",
        brass: "#8B6F1F",
        "brass-light": "#B79A3D",
        line: "#D9D2C1",
        pass: "#2F6B3A",
        "pass-bg": "#E7F0E6",
        review: "#B3690F",
        "review-bg": "#FBF0DF",
        fail: "#A63328",
        "fail-bg": "#F8E7E4",
      },
      fontFamily: {
        display: ["Fraunces", "serif"],
        body: ["Inter", "sans-serif"],
        data: ["IBM Plex Mono", "monospace"],
      },
    },
  },
  plugins: [],
};
