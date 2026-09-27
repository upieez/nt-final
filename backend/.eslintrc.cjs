module.exports = {
  root: true,
  env: { node: true, es2022: true },
  extends: ['eslint:recommended'],
  rules: {
    'no-unused-vars': ['error', { argsIgnorePattern: '^_' }]
  },
  parserOptions: { ecmaVersion: 'latest', sourceType: 'script' },
  overrides: [
    {
      files: ['test/**'],
      env: { jest: true }
    }
  ]
};
