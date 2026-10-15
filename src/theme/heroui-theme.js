/* SYNCED FILE (zcommerce-ui-consistency): keep byte-identical in store-dashboard and super-admin */
const primary = {
  50: '#E6F3FE', 100: '#E2F2FF', 200: '#BBD8FF', 300: '#8DBDFF', 400: '#5B9BFF',
  500: '#116DFE', 600: '#0E5FDF', 700: '#0B54C7', 800: '#0A4AB0', 900: '#0B3D91',
  DEFAULT: '#116DFE', foreground: '#FFFFFF',
};

export const zcHeroUI = {
  defaultTheme: 'light',
  layout: {
    radius: { small: '6px', medium: '8px', large: '16px' },
    borderWidth: { small: '1px', medium: '1px', large: '2px' },
    disabledOpacity: '0.5',
    fontSize: { tiny: '0.75rem', small: '0.875rem', medium: '1rem', large: '1.5rem' },
    lineHeight: { tiny: '1rem', small: '1.25rem', medium: '1.5rem', large: '2rem' },
  },
  themes: {
    light: {
      colors: {
        background: '#F8F8F8',
        foreground: '#131720',
        content1: '#FFFFFF',
        content2: '#F8F8F8',
        content3: '#F1F1F3',
        content4: '#E4E4E7',
        divider: '#E4E4E7',
        focus: '#116DFE',
        overlay: '#131720',
        default: { 50: '#F8F8F8', 100: '#F1F1F3', 200: '#E4E4E7', 300: '#D4D4D8', 400: '#A1A1AA', 500: '#71717A', 600: '#52525B', 700: '#3F3F46', 800: '#27272A', 900: '#131720', DEFAULT: '#F1F1F3', foreground: '#131720' },
        primary,
        danger: { 50: '#FDECEC', 500: '#EC0102', 600: '#C40102', DEFAULT: '#EC0102', foreground: '#FFFFFF' },
        success: { 50: '#DCFCE7', 600: '#15803D', DEFAULT: '#15803D', foreground: '#FFFFFF' },
        warning: { 50: '#FEF3C7', 600: '#B45309', DEFAULT: '#B45309', foreground: '#FFFFFF' },
      },
    },
  },
};
