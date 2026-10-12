/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    '@tailwindcss/postcss': {}, // <--- This is the change
    autoprefixer: {},
  },
};

export default config;