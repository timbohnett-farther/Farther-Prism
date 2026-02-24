/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Farther Official Brand Colors
        farther: {
          charcoal: '#333333',    // Primary background, text
          white: '#ffffff',       // Text on dark, backgrounds  
          slate: '#5b6a71',       // Secondary background, subtle borders
          teal: '#1a7a82',        // PRIMARY accent, CTAs, links (use sparingly!)
          lightBlue: '#6d9dbe',   // Secondary highlights, charts, data viz
        },
        // Semantic colors
        success: '#10B981',
        warning: '#F59E0B',
        error: '#EF4444',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      animation: {
        'shine': 'shine 2s ease-in-out infinite',
      },
      keyframes: {
        shine: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
      },
    },
  },
  plugins: [],
}
