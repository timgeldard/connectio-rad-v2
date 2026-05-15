// @ts-check
import { FlatCompat } from '@eslint/eslintrc'
import tsParser from '@typescript-eslint/parser'
import tsPlugin from '@typescript-eslint/eslint-plugin'
import nxPlugin from '@nx/eslint-plugin'
import jsdocPlugin from 'eslint-plugin-jsdoc'
import reactHooksPlugin from 'eslint-plugin-react-hooks'

const compat = new FlatCompat({ baseDirectory: import.meta.dirname })

/** @type {import('eslint').Linter.Config[]} */
export default [
  { ignores: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.nx/**', '**/packages/design-system/components/ui/**'] },

  // TypeScript base rules
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { project: true },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      '@nx': nxPlugin,
      jsdoc: jsdocPlugin,
      'react-hooks': reactHooksPlugin,
    },
    rules: {
      ...tsPlugin.configs['recommended'].rules,
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },

  // Nx module boundary enforcement
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { '@nx': nxPlugin },
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: [],
          depConstraints: [
            // Contracts layer: depends only on itself
            {
              sourceTag: 'layer:product-model',
              onlyDependOnLibsWithTags: ['layer:product-model'],
            },
            {
              sourceTag: 'layer:data-contracts',
              onlyDependOnLibsWithTags: ['layer:product-model', 'layer:data-contracts'],
            },
            // Design system: no @connectio/* imports
            {
              sourceTag: 'layer:design-system',
              onlyDependOnLibsWithTags: ['layer:design-system'],
            },
            // Service packages: depend on contracts only
            {
              sourceTag: 'layer:feature-flags',
              onlyDependOnLibsWithTags: ['layer:product-model', 'layer:feature-flags'],
            },
            {
              sourceTag: 'layer:telemetry',
              onlyDependOnLibsWithTags: ['layer:telemetry'],
            },
            {
              sourceTag: 'layer:source-adapters',
              onlyDependOnLibsWithTags: [
                'layer:data-contracts',
                'layer:product-model',
                'layer:source-adapters',
              ],
            },
            {
              sourceTag: 'layer:auth-scope',
              onlyDependOnLibsWithTags: [
                'layer:product-model',
                'layer:data-contracts',
                'layer:auth-scope',
              ],
            },
            {
              sourceTag: 'layer:personalization',
              onlyDependOnLibsWithTags: [
                'layer:product-model',
                'layer:data-contracts',
                'layer:personalization',
              ],
            },
            // Runtime packages
            {
              sourceTag: 'layer:evidence-panel-runtime',
              onlyDependOnLibsWithTags: [
                'layer:design-system',
                'layer:product-model',
                'layer:data-contracts',
                'layer:evidence-panel-runtime',
              ],
            },
            {
              sourceTag: 'layer:workspace-runtime',
              onlyDependOnLibsWithTags: [
                'layer:design-system',
                'layer:product-model',
                'layer:data-contracts',
                'layer:evidence-panel-runtime',
                'layer:workspace-runtime',
              ],
            },
            // Domain integrations
            {
              sourceTag: 'layer:integration',
              onlyDependOnLibsWithTags: [
                'layer:design-system',
                'layer:product-model',
                'layer:data-contracts',
                'layer:evidence-panel-runtime',
                'layer:workspace-runtime',
                'layer:source-adapters',
                'layer:telemetry',
                'layer:feature-flags',
                'layer:auth-scope',
                'layer:personalization',
                'layer:integration',
              ],
            },
            // App layer
            {
              sourceTag: 'layer:app',
              onlyDependOnLibsWithTags: [
                'layer:design-system',
                'layer:product-model',
                'layer:data-contracts',
                'layer:evidence-panel-runtime',
                'layer:workspace-runtime',
                'layer:source-adapters',
                'layer:telemetry',
                'layer:feature-flags',
                'layer:auth-scope',
                'layer:personalization',
                'layer:integration',
                'layer:app',
              ],
            },
            // Cross-integration scope isolation
            { sourceTag: 'scope:traceability', onlyDependOnLibsWithTags: ['scope:traceability', 'scope:shared'] },
            { sourceTag: 'scope:quality', onlyDependOnLibsWithTags: ['scope:quality', 'scope:shared'] },
            { sourceTag: 'scope:operations', onlyDependOnLibsWithTags: ['scope:operations', 'scope:shared'] },
            { sourceTag: 'scope:warehouse', onlyDependOnLibsWithTags: ['scope:warehouse', 'scope:shared'] },
            { sourceTag: 'scope:envmon', onlyDependOnLibsWithTags: ['scope:envmon', 'scope:shared'] },
            { sourceTag: 'scope:spc', onlyDependOnLibsWithTags: ['scope:spc', 'scope:shared'] },
            { sourceTag: 'scope:maintenance', onlyDependOnLibsWithTags: ['scope:maintenance', 'scope:shared'] },
            { sourceTag: 'scope:analytics', onlyDependOnLibsWithTags: ['scope:analytics', 'scope:shared'] },
            { sourceTag: 'scope:shared', onlyDependOnLibsWithTags: ['scope:shared'] },
          ],
        },
      ],
    },
  },

  // Block direct shadcn/Radix imports outside design-system
  {
    files: ['**/*.{ts,tsx}'],
    ignores: ['packages/design-system/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['@radix-ui/*'], message: 'Import from @connectio/design-system instead.' },
            { group: ['class-variance-authority'], message: 'Import from @connectio/design-system instead.' },
            { group: ['clsx'], message: 'Import from @connectio/design-system instead.' },
            { group: ['tailwind-merge'], message: 'Import from @connectio/design-system instead.' },
            { group: ['lucide-react'], message: 'Import from @connectio/design-system instead.' },
          ],
        },
      ],
    },
  },

  // Block @connectio/* imports inside design-system
  {
    files: ['packages/design-system/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@connectio/*'],
              message: 'design-system must not import other @connectio packages.',
            },
          ],
        },
      ],
    },
  },
]
