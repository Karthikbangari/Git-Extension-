import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    files: ['tf-diff-explainer/scripts/**/*.js'],
    languageOptions: {
      globals: {
        require: 'readonly',
        module: 'readonly',
        __dirname: 'readonly',
        Buffer: 'readonly',
        console: 'readonly',
        process: 'readonly',
      },
    },
    rules: {
      'no-console': 'off',
      'no-unused-vars': 'error',
    },
  },
  {
    ignores: ['**/*.ts', '**/dist/**', '**/node_modules/**', '**/.tools/**'],
  },
];
