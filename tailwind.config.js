/** @type {import('tailwindcss').Config} */
export default {
  // `admin.html` entra por lo mismo que entra `index.html`: la terminal de
  // administración es una segunda página, y las clases que suscriben SOLO en el
  // HTML (el `min-h-dvh` del body, por ejemplo) no se generaban sin esto.
  content: [
    "./index.html",
    "./admin.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {},
  },
  plugins: [],
}