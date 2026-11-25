module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'prettier'],
  rules: {
    'no-unused-vars': 'off',
    'no-undef': 'off',
    'no-control-regex': 'off',
    'no-constant-condition': ['error', { checkLoops: false }],
    'no-empty': ['error', { allowEmptyCatch: true }],
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unused-vars': [
      'warn',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }
    ],
    '@typescript-eslint/ban-ts-comment': 'warn',
    '@typescript-eslint/no-namespace': 'off',
    '@typescript-eslint/no-require-imports': 'off'
  },
  ignorePatterns: ['dist/**', 'node_modules/**']
}
