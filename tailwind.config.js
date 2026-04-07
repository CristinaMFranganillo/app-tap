/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {

      // ─── TIPOGRAFÍA ───────────────────────────────────────────────
      // Escala ×1.250 (Major Third) sobre base 12px
      // 12 · 15 · 19 · 24 · 30 · 37 · 47
      fontFamily: {
        sans: ['Montserrat', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'xs':   ['12px', { lineHeight: '16px', letterSpacing: '0.02em' }],
        'sm':   ['13px', { lineHeight: '18px', letterSpacing: '0.01em' }],
        'base': ['14px', { lineHeight: '20px', letterSpacing: '0em'    }],
        'md':   ['16px', { lineHeight: '22px', letterSpacing: '-0.01em'}],
        'lg':   ['19px', { lineHeight: '26px', letterSpacing: '-0.02em'}],
        'xl':   ['24px', { lineHeight: '32px', letterSpacing: '-0.02em'}],
        '2xl':  ['30px', { lineHeight: '38px', letterSpacing: '-0.03em'}],
        '3xl':  ['37px', { lineHeight: '46px', letterSpacing: '-0.03em'}],
      },
      fontWeight: {
        regular:   '400',
        medium:    '500',
        semibold:  '600',
        bold:      '700',
        extrabold: '800',
        black:     '900',
      },

      // ─── PALETA DE COLORES ────────────────────────────────────────
      colors: {
        // Primary — Amarillo vibrante (CTAs, énfasis, marca)
        primary: {
          DEFAULT: '#F5E000',
          light:   '#FAF066',
          dark:    '#C9B800',
        },

        // Secondary — Negro profundo (texto, fondos oscuros)
        secondary: {
          DEFAULT: '#1A1A1A',
          light:   '#2E2E2E',
          muted:   '#4A4A4A',
        },

        // Neutral — Escala de grises funcional
        neutral: {
          50:  '#FAFAFA',
          100: '#F5F5F5',   // surface background
          200: '#E5E7EB',   // borders
          300: '#9CA3AF',   // placeholder, muted text
          400: '#6B7280',   // secondary text
          500: '#374151',   // primary text
          white: '#FFFFFF',
        },

        // Semantic — Estado del sistema
        success: {
          DEFAULT: '#22C55E',
          light:   '#DCFCE7',
          dark:    '#16A34A',
        },
        danger: {
          DEFAULT: '#EF4444',
          light:   '#FEE2E2',
          dark:    '#DC2626',
        },
        warning: {
          DEFAULT: '#F59E0B',
          light:   '#FEF3C7',
          dark:    '#D97706',
        },
        info: {
          DEFAULT: '#3B82F6',
          light:   '#DBEAFE',
          dark:    '#2563EB',
        },

        // Aliases semánticos (retrocompatibilidad)
        'brand-yellow': '#F5E000',
        'brand-dark':   '#1A1A1A',
        surface:        '#F5F5F5',
      },

      // ─── ESPACIADO (base 4px) ──────────────────────────────────────
      // Los tokens de Tailwind ya son base-4 (1=4px, 2=8px…)
      // Añadimos aliases semánticos para componentes
      spacing: {
        'px-card':    '12px',  // padding horizontal card
        'py-card':    '10px',  // padding vertical card
        'gap-form':   '12px',  // gap entre campos de formulario
        'nav-height': '54px',  // altura header
        'tab-height': '52px',  // altura bottom nav
        'fab-offset': '60px',  // distancia FAB desde bottom nav
      },

      // ─── BORDES ───────────────────────────────────────────────────
      borderRadius: {
        'input':  '10px',
        'card':   '12px',
        'modal':  '20px',
        'badge':  '999px',
      },

      // ─── SOMBRAS ──────────────────────────────────────────────────
      boxShadow: {
        'card':   '0 1px 3px 0 rgb(0 0 0 / 0.08)',
        'fab':    '0 4px 12px 0 rgb(0 0 0 / 0.15)',
        'modal':  '0 -4px 24px 0 rgb(0 0 0 / 0.12)',
        'input':  '0 1px 2px 0 rgb(0 0 0 / 0.06)',
      },

      // ─── TRANSICIONES ─────────────────────────────────────────────
      transitionDuration: {
        fast:   '100ms',
        base:   '150ms',
        slow:   '250ms',
      },
    },
  },
  plugins: [],
}
