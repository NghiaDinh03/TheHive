import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        border: 'var(--border)',
        input: 'var(--input)',
        ring: 'var(--ring)',
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--primary-foreground)',
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          foreground: 'var(--secondary-foreground)',
        },
        destructive: {
          DEFAULT: 'var(--destructive)',
          foreground: 'var(--destructive-foreground)',
        },
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          foreground: 'var(--accent-foreground)',
        },
        popover: {
          DEFAULT: 'var(--popover)',
          foreground: 'var(--popover-foreground)',
        },
        card: {
          DEFAULT: 'var(--card)',
          foreground: 'var(--card-foreground)',
        },
        ncs: {
          primary:          '#2563eb',
          'primary-dark':   '#1d4ed8',
          'primary-darker': '#1e3a8a',
          'primary-light':  '#3b82f6',
          sidebar:          '#0a0f1a',
          'sidebar-hover':  '#141c2e',
          'sidebar-header': '#070b14',
          body:             '#0f1623',
          surface:          '#1a2332',
          'surface-hover':  '#1e293b',
          muted:            '#64748b',
          divider:          '#1e293b',
          text:             '#e2e8f0',
          'text-secondary': '#94a3b8',
          success:          '#22c55e',
          danger:           '#ef4444',
          warning:          '#f59e0b',
          info:             '#06b6d4',
          card:             '#131c2e',
          'card-border':    '#1e293b',
        },
        glass: {
          bg:       'rgba(15, 22, 35, 0.6)',
          surface:  'rgba(26, 35, 50, 0.5)',
          panel:    'rgba(10, 15, 26, 0.7)',
          border:   'rgba(255, 255, 255, 0.07)',
          'border-strong': 'rgba(255, 255, 255, 0.12)',
          hover:    'rgba(37, 99, 235, 0.08)',
          glow:     'rgba(37, 99, 235, 0.15)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Cascadia Code', 'ui-monospace', 'monospace'],
      },
      backdropBlur: {
        'glass-sm': '8px',
        glass:      '16px',
        'glass-lg': '24px',
        'glass-xl': '40px',
      },
      boxShadow: {
        'glass-sm':   '0 2px 8px 0 rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
        glass:        '0 4px 16px 0 rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)',
        'glass-lg':   '0 8px 32px 0 rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)',
        'glass-glow': '0 0 20px 0 rgba(37,99,235,0.25), 0 4px 16px 0 rgba(0,0,0,0.4)',
        'ncs-card':   '0 1px 3px 0 rgba(0,0,0,.2), 0 1px 2px -1px rgba(0,0,0,.15)',
      },
      borderRadius: {
        card: '0.75rem',
      },
      keyframes: {
        'fade-in': {
          '0%':   { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-up': {
          '0%':   { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 8px rgba(37,99,235,0.2)' },
          '50%':       { boxShadow: '0 0 20px rgba(37,99,235,0.4)' },
        },
        'shimmer': {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'fade-in':    'fade-in 0.2s ease-out',
        'slide-up':   'slide-up 0.25s ease-out',
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
        'shimmer':    'shimmer 2s linear infinite',
      },
    },
  },
  plugins: [],
};

export default config;
