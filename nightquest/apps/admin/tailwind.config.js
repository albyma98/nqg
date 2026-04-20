/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        admin: {
          bg: '#fafaf8',
          surface: '#ffffff',
          border: '#e5e5e0',
          text: '#1a1a1a',
          muted: '#6a6a60',
          accent: '#1a1a1a',
          danger: '#a82020',
          success: '#2a7a40',
          sidebar: '#0a0a0f',
          sidebarText: '#b8b8b0'
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif']
      },
      fontSize: {
        adminLabel: ['12px', { lineHeight: '1.4' }],
        adminBody: ['13px', { lineHeight: '1.5' }],
        adminHeading: ['15px', { lineHeight: '1.4' }],
        adminTitle: ['22px', { lineHeight: '1.25' }]
      },
      borderRadius: {
        sm: '4px',
        md: '8px'
      },
      maxWidth: {
        admin: '1280px'
      }
    }
  },
  plugins: []
};
