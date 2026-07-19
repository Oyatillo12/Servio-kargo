/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  extends: ['next/core-web-vitals', 'prettier'],
  rules: {
    // The admin UI is Uzbek (Latin), which uses apostrophes heavily
    // (so'm, Og'irlik, o'zgartirish). Escaping every one hurts readability.
    'react/no-unescaped-entities': 'off',
  },
};
