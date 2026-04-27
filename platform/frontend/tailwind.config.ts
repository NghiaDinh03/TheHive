import type { Config } from 'tailwindcss';

// Theme tokens mirror TheHive 4 AdminLTE skin-blue.
// Source colours pulled from frontend/app/styles/vendors/AdminLTE-skin-blue.css.
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        thehive: {
          primary:      '#3c8dbc',
          'primary-dark':'#367fa9',
          'primary-darker':'#357ca5',
          sidebar:      '#222d32',
          'sidebar-hover':'#1e282c',
          'sidebar-header':'#1a2226',
          'sidebar-text':'#b8c7ce',
          'sidebar-sub': '#8aa4af',
          body:         '#ecf0f5',
          surface:      '#ffffff',
          muted:        '#AAAAAA',
          divider:      '#cfcfcf',
          text:         '#333333',
          'login-bg':   '#eeeeee',
        },
      },
      fontFamily: {
        sans: ['var(--font-roboto)', 'Roboto', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'thehive-card': '0 1px 1px rgba(0,0,0,0.1)',
      },
    },
  },
  plugins: [],
};

export default config;
