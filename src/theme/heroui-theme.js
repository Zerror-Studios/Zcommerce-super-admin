/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
/* HeroUI reads hex values, not CSS variables. Keep these equal to src/styles/tokens.css (docs/design/tokens.css). */
const primary = {
  50: '#EEF3FF', 100: '#DCE6FF', 200: '#B9CCFF', 300: '#8DADFF', 400: '#5B8CFF',
  500: '#1F5EFF', 600: '#1A4FDB', 700: '#1745C2', 800: '#133A9E', 900: '#0F2E7D',
  DEFAULT: '#1F5EFF', foreground: '#FFFFFF',
};

export const zcHeroUI = {
  defaultTheme: 'light',
  layout: {
    // Spec corners: 6 badges/chips, 8 buttons/inputs, 12 cards/tables/popovers. Modals set 16 themselves.
    radius: { small: '6px', medium: '8px', large: '12px' },
    borderWidth: { small: '1px', medium: '1px', large: '2px' },
    disabledOpacity: '0.5',
    // Spec type scale: 12 caption, 14 body/inputs/buttons, 16 modal titles.
    fontSize: { tiny: '0.75rem', small: '0.875rem', medium: '0.875rem', large: '1rem' },
    lineHeight: { tiny: '1rem', small: '1.25rem', medium: '1.25rem', large: '1.5rem' },
  },
  themes: {
    light: {
      colors: {
        background: '#F6F7F9',
        foreground: '#111318',
        content1: '#FFFFFF',
        content2: '#FAFAFB',
        content3: '#F2F3F5',
        content4: '#EBEBEF',
        divider: '#EBEBEF',
        focus: '#1F5EFF',
        overlay: '#111318',
        default: { 50: '#FAFAFB', 100: '#F2F3F5', 200: '#EBEBEF', 300: '#E2E3E8', 400: '#B4B8C0', 500: '#6F747E', 600: '#5F646E', 700: '#454A54', 800: '#2A2D35', 900: '#111318', DEFAULT: '#F2F3F5', foreground: '#111318' },
        primary,
        danger: { 50: '#FDECEC', 100: '#F3C7C3', 500: '#D92D20', 600: '#B42318', DEFAULT: '#B42318', foreground: '#FFFFFF' },
        success: { 50: '#EAF7EF', 600: '#18794E', DEFAULT: '#18794E', foreground: '#FFFFFF' },
        warning: { 50: '#FFF4E5', 500: '#E8890C', 600: '#A15C07', DEFAULT: '#A15C07', foreground: '#FFFFFF' },
      },
    },
  },
};
