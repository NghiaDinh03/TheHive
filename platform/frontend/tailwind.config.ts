import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        thehive: {
          primary:        '#2563eb',
          'primary-dark': '#1d4ed8',
          'primary-darker':'#1e3a8a',
          'primary-light':'#3b82f6',
          sidebar:        '#0a0f1a',
          'sidebar-hover':'#141c2e',
          'sidebar-header':'#070b14',
          'sidebar-text': '#94a3b8',
          'sidebar-sub':  '#64748b',
          body:           '#0f1623',
          surface:        '#1a2332',
          muted:          '#64748b',
          divider:        '#1e293b',
          text:           '#e2e8f0',
          'login-bg':     '#0f172a',
          success:        '#22c55e',
          danger:         '#ef4444',
          warning:        '#f59e0b',
          info:           '#06b6d4',
          card:           '#131c2e',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        'thehive-card': '0 1px 3px 0 rgba(0,0,0,.2), 0 1px 2px -1px rgba(0,0,0,.15)',
      },
      borderRadius: {
        'card': '0.75rem',
      },
    },
  },
  plugins: [],
};

export default config;
