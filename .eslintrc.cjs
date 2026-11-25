module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
    node: true
  },
  parser: 'vue-eslint-parser',
  parserOptions: {
    parser: '@typescript-eslint/parser',
    ecmaVersion: 'latest',
    sourceType: 'module',
    extraFileExtensions: ['.vue']
  },
  plugins: ['@typescript-eslint', 'vue'],
  extends: [
    'eslint:recommended',
    'plugin:vue/vue3-essential',
    'plugin:@typescript-eslint/recommended',
    'prettier'
  ],
  globals: {
    uni: 'readonly',
    wx: 'readonly',
    getCurrentPages: 'readonly',
    plus: 'readonly'
  },
  rules: {
    'vue/multi-word-component-names': 'off',
    'vue/no-v-html': 'error',
    'no-unused-vars': 'off',
    'no-undef': 'off',
    'no-constant-condition': ['error', { checkLoops: false }],
    'no-empty': ['error', { allowEmptyCatch: true }],
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unused-vars': [
      'warn',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }
    ],
    '@typescript-eslint/ban-ts-comment': 'warn'
  },
  ignorePatterns: [
    'dist/**',
    'unpackage/**',
    'node_modules/**',
    'server/**',
    'src/static/**',
    'src/types/api-generated.ts'
  ]
}
