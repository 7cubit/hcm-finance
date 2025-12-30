import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: "#8b5cf6", // Violet-500
        secondary: "#06b6d4", // Cyan-500
        "background-light": "#f8fafc", // Slate-50
        "background-dark": "#020617", // Slate-950 (Deep dark)
        "surface-dark": "#0f172a", // Slate-900
        "surface-light": "#ffffff",
        // Keep existing slate for compatibility if needed, but prioritizing user's palette
        slate: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'sans-serif'],
        mono: ['var(--font-jetbrains-mono)', 'monospace'],
      },
      boxShadow: {
        'neon': '0 0 5px theme("colors.primary"), 0 0 20px theme("colors.primary")',
        'neon-cyan': '0 0 5px theme("colors.secondary"), 0 0 20px theme("colors.secondary")',
      }
    },
  },
  plugins: [],
};

export default config;
