import 'vuetify/styles'
import '@mdi/font/css/materialdesignicons.css'
import { createVuetify } from 'vuetify'

export const vuetify = createVuetify({
  theme: {
    defaultTheme: 'motcarLight',
    themes: {
      motcarLight: {
        dark: false,
        colors: {
          primary: '#0E54A4',
          'primary-darken-1': '#093B75',
          secondary: '#DBB51D',
          'secondary-darken-1': '#B89714',
          accent: '#DBB51D',
          error: '#EF4444',
          info: '#3B82F6',
          success: '#10B981',
          warning: '#F59E0B',
          background: '#F8FAFC',
          surface: '#FFFFFF',
          'surface-variant': '#F1F5F9',
          'on-primary': '#FFFFFF',
          'on-secondary': '#0A2540',
          'on-background': '#0A2540',
          'on-surface': '#1E293B'
        }
      }
    }
  },
  defaults: {
    VBtn: {
      elevation: 0,
      rounded: 'md'
    },
    VCard: {
      elevation: 0,
      rounded: 'lg'
    },
    VTextField: {
      variant: 'outlined',
      density: 'comfortable'
    },
    VSelect: {
      variant: 'outlined',
      density: 'comfortable'
    },
    VTextarea: {
      variant: 'outlined',
      density: 'comfortable'
    },
    VFileInput: {
      variant: 'outlined',
      density: 'comfortable'
    },
    VDataTableServer: {
      density: 'comfortable',
      hover: true
    },
    VTooltip: {
      location: 'top'
    }
  }
})

