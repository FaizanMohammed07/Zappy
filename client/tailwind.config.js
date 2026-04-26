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
        // Primary blue ramp — #2563EB is the brand hero
        zappy: {
          50: '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#60A5FA',
          500: '#3B82F6',
          600: '#2563EB', // ← Primary Blue (brand hero)
          700: '#1D4ED8',
          800: '#1E40AF',
          900: '#1E3A8A',
        },
        // Alias so existing code using `brand-*` still works — points at Zappy blue now
        brand: {
          50: '#EFF6FF',
          100: '#DBEAFE',
          500: '#3B82F6',
          600: '#2563EB',
          700: '#1D4ED8',
        },
        // Deep navy for headings + gradient target
        navy: {
          DEFAULT: '#0F172A',
          50: '#F8FAFC',
          100: '#F1F5F9',
          700: '#334155',
          800: '#1E293B',
          900: '#0F172A',
        },
        // Success green — #22C55E
        success: {
          50: '#F0FDF4',
          100: '#DCFCE7',
          500: '#22C55E',
          600: '#16A34A',
          700: '#15803D',
        },
        // Accent orange — #F59E0B
        accent: {
          50: '#FFFBEB',
          100: '#FEF3C7',
          500: '#F59E0B',
          600: '#D97706',
          700: '#B45309',
        },
      },
      fontFamily: {
        sans: ['Poppins', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
      },
      fontSize: {
        // Style guide scale
        'h1': ['32px', { lineHeight: '40px', fontWeight: '700' }],
        'h2': ['24px', { lineHeight: '32px', fontWeight: '600' }],
        'h3': ['20px', { lineHeight: '28px', fontWeight: '500' }],
        'body': ['16px', { lineHeight: '24px', fontWeight: '400' }],
        'small': ['14px', { lineHeight: '20px', fontWeight: '400' }],
      },
      spacing: {
        // 8px grid reinforcement
        '18': '4.5rem',   // 72px
      },
      borderRadius: {
        'card': '16px',
        'btn': '12px',
      },
      boxShadow: {
        // Soft, low-opacity shadows — "soft shadows" per the guide
        'soft':    '0 2px 8px rgba(15, 23, 42, 0.04)',
        'soft-lg': '0 8px 24px rgba(15, 23, 42, 0.06)',
        'card':    '0 1px 3px rgba(15, 23, 42, 0.04), 0 1px 2px rgba(15, 23, 42, 0.02)',
      },
      backgroundImage: {
        // The signature blue → navy gradient
        'zappy-gradient': 'linear-gradient(135deg, #2563EB 0%, #0F172A 100%)',
      },
      animation: {
        'pulse-slow': 'pulse 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
};
