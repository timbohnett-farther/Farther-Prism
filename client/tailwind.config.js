/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Farther Brand Colors
        farther: {
          navy: '#0A1628',      // Deep navy - primary brand
          blue: '#1E3A5F',      // Medium blue
          gold: '#D4A574',      // Premium gold accent
          lightGold: '#E8D4B8', // Light gold
          slate: '#F8FAFC',     // Background
          gray: {
            50: '#F9FAFB',
            100: '#F3F4F6',
            200: '#E5E7EB',
            300: '#D1D5DB',
            600: '#4B5563',
            700: '#374151',
            900: '#111827',
          },
        },
        // Semantic colors
        success: '#10B981',
        warning: '#F59E0B',
        error: '#EF4444',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
