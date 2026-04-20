/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        night: {
          void: '#050507',
          deep: '#0a0a0f',
          surface: '#12121a',
          raised: '#1a1a24',
          border: '#2a2a36',
          muted: '#4a4a5a'
        },
        ink: {
          primary: '#f5f5f0',
          secondary: '#b8b8b0',
          tertiary: '#78786e',
          whisper: '#4a4a42'
        },
        accent: {
          blood: '#5a1010',
          amber: '#8a6a20',
          ghost: '#3a4a5a'
        }
      },
      fontFamily: {
        serif: ['Cormorant Garamond', 'serif'],
        sans: ['Inter', 'sans-serif']
      },
      fontSize: {
        whisper: ['11px', { lineHeight: '1.5', letterSpacing: '0.3em' }],
        caption: ['13px', { lineHeight: '1.5' }],
        body: ['15px', { lineHeight: '1.6' }],
        'ombra-s': ['18px', { lineHeight: '1.5' }],
        'ombra-m': ['22px', { lineHeight: '1.45' }],
        'ombra-l': ['28px', { lineHeight: '1.35' }],
        display: ['36px', { lineHeight: '1.2' }]
      },
      borderRadius: {
        none: '0px',
        xs: '2px',
        pill: '9999px'
      },
      boxShadow: {
        subtle: '0 2px 20px rgba(0,0,0,0.4)',
        glow: '0 0 40px rgba(138,106,32,0.08)'
      },
      transitionTimingFunction: {
        fast: 'cubic-bezier(0.4, 0, 0.2, 1)',
        base: 'cubic-bezier(0.4, 0, 0.2, 1)',
        slow: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
        ritual: 'cubic-bezier(0.19, 1, 0.22, 1)'
      },
      keyframes: {
        breathe: {
          '0%, 100%': { opacity: '0.5' },
          '50%': { opacity: '1' }
        },
        vignette: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.02)' }
        },
        whisper: {
          '0%, 100%': { opacity: '0.6' },
          '50%': { opacity: '0.9' }
        },
        ellipsis: {
          '0%': { content: '"."' },
          '33%': { content: '".."' },
          '66%, 100%': { content: '"..."' }
        }
      },
      animation: {
        breathe: 'breathe 3s cubic-bezier(0.25, 0.1, 0.25, 1) infinite',
        vignette: 'vignette 8s cubic-bezier(0.25, 0.1, 0.25, 1) infinite',
        whisper: 'whisper 4s cubic-bezier(0.25, 0.1, 0.25, 1) infinite'
      },
      maxWidth: {
        shell: '448px'
      }
    }
  },
  plugins: []
};
