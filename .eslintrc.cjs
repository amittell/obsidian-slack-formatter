module.exports = {
  root: true,
  env: {
    es2021: true,
    node: true,
    jest: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint', 'import'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:import/recommended',
    'plugin:import/typescript',
    'prettier',
  ],
  settings: {
    'import/resolver': {
      typescript: {
        project: ['./tsconfig.json', './tsconfig.ci.json'],
      },
    },
  },
  ignorePatterns: [
    'coverage/',
    'dist/',
    'main.js',
    'meta.json',
    'node_modules/',
    '**/*.d.ts',
  ],
  rules: {
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'import/order': 'off',
    'import/no-unresolved': 'error',
    'no-useless-escape': 'off',
    'prefer-const': 'warn',
    'no-misleading-character-class': 'off',
    '@typescript-eslint/no-var-requires': 'off',
    '@typescript-eslint/ban-ts-comment': 'off',
    'no-prototype-builtins': 'off',
    'no-control-regex': 'off',
  },
};
