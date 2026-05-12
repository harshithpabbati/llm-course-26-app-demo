import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        cream: {
          50: '#fefdfb',
          100: '#faf8f3',
          200: '#f5f0e6',
          300: '#ede4d4',
          400: '#e2d4bc',
          500: '#d4c4a8',
        },
        sage: {
          400: '#9caa8a',
          500: '#7d8b6a',
          600: '#5f6d4e',
        },
        terracotta: {
          400: '#c17f6a',
          500: '#a86b57',
          600: '#8b5343',
        },
        lavender: {
          300: '#ddd6fe',
          400: '#c4b5fd',
          500: '#a78bfa',
          600: '#8b5cf6',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-lora)', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
};

export default config;
