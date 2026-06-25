/** @type {import('tailwindcss').Config}
 *
 * Zappy brand system.
 * Colors, fonts, spacing all mirror the style guide exactly.
 */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Primary indigo/violet ramp — electric vibes
        zappy: {
          50: '#EEF2FF',
          100: '#E0E7FF',
          200: '#C7D2FE',
          300: '#A5B4FC',
          400: '#818CF8',
          500: '#6366F1', // Primary Indigo
          600: '#4F46E5', // Electric Violet
          700: '#4338CA',
          800: '#3730A3',
          900: '#312E81',
          950: '#1E1B4B',
        },
        success: {
          50: '#F0FDF4',
          100: '#DCFCE7',
          500: '#22C55E',
          600: '#16A34A',
          700: '#15803D',
        },
        accent: { // Amber energetic accents
          50: '#FFFBEB',
          100: '#FEF3C7',
          400: '#FBBF24',
          500: '#F5A524', // Amber accent
          600: '#D97706',
          700: '#B45309',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Poppins', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        // Updated V2 typography scale
        'display': ['30px', { lineHeight: '36px', fontWeight: '800' }],
        'h1': ['22px', { lineHeight: '28px', fontWeight: '700' }],
        'h2': ['18px', { lineHeight: '24px', fontWeight: '700' }],
        'h3': ['15px', { lineHeight: '20px', fontWeight: '600' }],
        'body': ['14px', { lineHeight: '20px', fontWeight: '400' }],
        'caption': ['13px', { lineHeight: '18px', fontWeight: '500' }],
        'micro': ['11px', { lineHeight: '14px', letterSpacing: '0.04em', fontWeight: '600' }],
      },
      spacing: {
        '18': '4.5rem',
      },
      borderRadius: {
        'card': '22px',
        'card-lg': '24px',
        'card-xl': '32px',
        'squircle': '20px', // Super rounded for Gen-Z feel
        'btn': '9999px', // Full pill for buttons
      },
      boxShadow: {
        'sm': 'var(--shadow-sm, 0 1px 2px rgba(20,21,42,0.06))',
        'md': 'var(--shadow-md, 0 4px 16px rgba(20,21,42,0.08))',
        'lg': 'var(--shadow-lg, 0 12px 32px rgba(20,21,42,0.12))',
        'soft':    'var(--shadow-md)',
        'soft-lg': 'var(--shadow-lg)',
        'card':    'var(--shadow-sm)',
      },
      backgroundImage: {
        'zappy-gradient': 'linear-gradient(135deg, #4F46E5 0%, #0B0F19 100%)',
        'glass-gradient': 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)',
      },
      animation: {
        'pulse-slow': 'pulse 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        }
      }
    },
  },
  plugins: [],
};
