import type { Config } from 'tailwindcss'
import typography from '@tailwindcss/typography'
import forms from '@tailwindcss/forms'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Public Sans"', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'Noto Sans', 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji']
      },
      colors: {
        civic: {
          blue: {
            50: '#e6f0fa',
            100: '#cce0f5',
            200: '#99c2eb',
            300: '#66a3e0',
            400: '#3385d6',
            500: '#005ea2', // USWDS blue-60
            600: '#0b4778', // blue-70
            700: '#112f4e', // blue-80
            800: '#0b2239',
            900: '#061728'
          },
          gold: {
            50: '#fff8e1',
            100: '#ffefb3',
            200: '#ffe380',
            300: '#ffd54d',
            400: '#ffc726',
            500: '#e6b000',
            600: '#b38700',
            700: '#805f00'
          }
        }
      },
      boxShadow: {
        subtle: '0 1px 2px 0 rgb(0 0 0 / 0.04), 0 1px 3px 0 rgb(0 0 0 / 0.06)'
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.25rem'
      }
    }
  },
  plugins: [typography, forms]
}
export default config;