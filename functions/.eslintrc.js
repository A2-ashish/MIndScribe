module.exports = {
  root: true,
  env: {
    es6: true,
    node: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: ['tsconfig.json'],
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended'
  ],
  rules: {
    // Relaxed for hackathon speed:
    'quotes': ['warn', 'single', { avoidEscape: true }],
    'linebreak-style': 'off',        // Allow CRLF on Windows
    'max-len': ['off'],
    'object-curly-spacing': 'off',
    'comma-dangle': 'off',
    'require-jsdoc': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
    'eol-last': 'off'
  },
  ignorePatterns: [
    '/lib/**/*',
  ]
};