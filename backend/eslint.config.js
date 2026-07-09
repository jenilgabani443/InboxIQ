export default [
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        process: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        module: 'writable',
        require: 'readonly',
        exports: 'writable',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        Buffer: 'readonly',
      },
    },
    rules: {
      'no-console': 'warn',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-var': 'error',
      'prefer-const': 'error',
      'arrow-body-style': ['error', 'as-needed'],
      eqeqeq: ['error', 'always'],
      'no-duplicate-imports': 'error',
      'no-return-await': 'error',
      'prefer-destructuring': ['warn', { object: true, array: false }],
    },
    ignores: ['node_modules/**', 'coverage/**', 'dist/**'],
  },
];
