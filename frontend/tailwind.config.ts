import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/features/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['var(--font-jetbrains-mono)', 'JetBrains Mono', 'monospace'],
      },
      colors: {
        // Geist Design System Colors
        geist: {
          // Surface ladder
          canvas: '#ffffff',
          'canvas-soft': '#fafafa',
          'canvas-soft-2': '#f5f5f5',
          // Text
          ink: '#171717',
          body: '#4d4d4d',
          mute: '#888888',
          // Borders
          hairline: '#ebebeb',
          'hairline-strong': '#a1a1a1',
          // Brand & Accent
          primary: '#171717',
          'on-primary': '#ffffff',
          cyan: '#50e3c2',
          violet: '#7928ca',
          pink: '#ff0080',
          link: '#0070f3',
          'link-deep': '#0761d1',
          'link-bg-soft': '#d3e5ff',
          // Semantic
          error: '#ee0000',
          'error-soft': '#f7d4d6',
          'error-deep': '#c50000',
          warning: '#f5a623',
          'warning-soft': '#ffefcf',
          'warning-deep': '#ab570a',
          success: '#0070f3',
          // Gradient stops
          'gradient-develop-start': '#007cf0',
          'gradient-develop-end': '#00dfd8',
          'gradient-preview-start': '#7928ca',
          'gradient-preview-end': '#ff0080',
          'gradient-ship-start': '#ff4d4d',
          'gradient-ship-end': '#f9cb28',
        },
      },
      spacing: {
        'geist-xxs': '4px',
        'geist-xs': '8px',
        'geist-sm': '12px',
        'geist-md': '16px',
        'geist-lg': '24px',
        'geist-xl': '32px',
        'geist-2xl': '40px',
        'geist-3xl': '48px',
        'geist-4xl': '64px',
        'geist-5xl': '96px',
        'geist-6xl': '128px',
        'geist-section': '192px',
      },
      borderRadius: {
        'geist-none': '0px',
        'geist-xs': '4px',
        'geist-sm': '6px',
        'geist-md': '8px',
        'geist-lg': '12px',
        'geist-xl': '16px',
        'geist-pill-sm': '64px',
        'geist-pill': '100px',
        'geist-full': '9999px',
      },
      boxShadow: {
        'geist-1': 'inset 0 0 0 1px rgba(0,0,0,0.08)',
        'geist-2':
          '0px 1px 1px rgba(0,0,0,0.02), 0px 2px 2px rgba(0,0,0,0.04), inset 0 0 0 1px rgba(0,0,0,0.08)',
        'geist-3':
          '0px 2px 2px rgba(0,0,0,0.04), 0px 8px 8px -8px rgba(0,0,0,0.04), inset 0 0 0 1px rgba(0,0,0,0.08)',
        'geist-4':
          '0px 2px 2px rgba(0,0,0,0.04), 0px 8px 16px -4px rgba(0,0,0,0.04), inset 0 0 0 1px rgba(0,0,0,0.08)',
        'geist-5':
          '0px 1px 1px rgba(0,0,0,0.02), 0px 8px 16px -4px rgba(0,0,0,0.04), 0px 24px 32px -8px rgba(0,0,0,0.06), inset 0 0 0 1px rgba(0,0,0,0.08)',
        // Dark mode equivalents — border-based, very subtle
        'geist-dark-1': 'inset 0 0 0 1px rgba(255,255,255,0.08)',
        'geist-dark-2': '0px 1px 1px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(255,255,255,0.08)',
        'geist-dark-3': '0px 2px 4px rgba(0,0,0,0.3), inset 0 0 0 1px rgba(255,255,255,0.08)',
        'geist-dark-4': '0px 4px 8px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(255,255,255,0.08)',
        'geist-dark-5': '0px 8px 24px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.1)',
      },
      letterSpacing: {
        'geist-display-xl': '-0.05em',
        'geist-display-lg': '-0.04em',
        'geist-display-md': '-0.04em',
        'geist-display-sm': '-0.03em',
        'geist-body-sm': '-0.02em',
      },
      maxWidth: {
        'geist-page': '1400px',
        'geist-content': '1200px',
      },
      height: {
        'geist-nav': '64px',
        'geist-form': '40px',
        'geist-form-sm': '32px',
        'geist-form-lg': '48px',
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          from: { opacity: '0', transform: 'translateY(-8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          from: { opacity: '0', transform: 'scale(0.97)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
