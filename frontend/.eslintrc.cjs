module.exports = {
  root: true,
  env: { browser: true, es2022: true, node: true },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended'
  ],
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } },
  settings: { react: { version: '18.3' } },
  rules: {
    'react/prop-types': 'off',
    'no-console': 'error'
  },
  overrides: [
    {
      files: ['**/*.test.jsx', '**/*.test.js', 'src/test/**'],
      globals: { describe: 'readonly', it: 'readonly', expect: 'readonly', vi: 'readonly', beforeEach: 'readonly', afterEach: 'readonly' }
    }
  ]
};
