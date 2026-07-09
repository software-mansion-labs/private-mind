import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';
import prettierPlugin from 'eslint-plugin-prettier';

const __dirname = dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory: __dirname });

export default tseslint.config(
  {
    ignores: [
      'node_modules/',
      'dist/',
      '.expo/',
      'web-build/',
      'android/',
      'ios/',
      'babel.config.js',
      'metro.config.js',
      'jest.setup.js',
      'scripts/',
      'patches/',
      '__mocks__/',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...compat.extends('@react-native'),
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'prettier': prettierPlugin,
    },
    rules: {
      'prettier/prettier': 'error',

      // Downgrade strictness from @react-native config to warnings we can live with.
      'react-hooks/exhaustive-deps': 'warn',
      'react-native/no-inline-styles': 'off',
      'react/no-unstable-nested-components': 'warn',
      '@typescript-eslint/no-shadow': 'warn',

      // Project overrides
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  prettierConfig
);
