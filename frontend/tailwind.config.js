import defaultTheme from 'tailwindcss/defaultTheme'

export default {
  theme: {
    extend: {
      borderRadius: {
        lg: '8px',
        md: '6px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0, 0, 0, 0.05)',
      },
      colors: {
        border: {
          DEFAULT: '#E2E8F0',
        },
        content: {
          primary: '#1E293B',
          secondary: '#64748B',
          tertiary: '#94A3B8',
        },
        primary: {
          DEFAULT: '#4F46E5',
          hover: '#4338CA',
          light: '#EEF2FF',
        },
        status: {
          fail: '#EF4444',
          pass: '#10B981',
          warn: '#F59E0B',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          secondary: '#F5F6FA',
          tertiary: '#F8FAFC',
        },
      },
      fontFamily: {
        sans: ['Inter', ...defaultTheme.fontFamily.sans],
      },
    },
  },
}
