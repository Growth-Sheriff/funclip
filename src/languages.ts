/**
 * Language Configurations
 */

import { Language, LanguageConfig } from './types';

export const LANGUAGE_CONFIGS: Record<Language, LanguageConfig> = {
  javascript: { extensions: ['.js', '.mjs', '.cjs'], treeSitterLang: 'javascript', queries: {} },
  typescript: { extensions: ['.ts', '.mts', '.cts'], treeSitterLang: 'typescript', queries: {} },
  tsx: { extensions: ['.tsx'], treeSitterLang: 'tsx', queries: {} },
  jsx: { extensions: ['.jsx'], treeSitterLang: 'javascript', queries: {} },
  python: { extensions: ['.py', '.pyi'], treeSitterLang: 'python', queries: {} },
  go: { extensions: ['.go'], treeSitterLang: 'go', queries: {} },
  rust: { extensions: ['.rs'], treeSitterLang: 'rust', queries: {} },
  java: { extensions: ['.java'], treeSitterLang: 'java', queries: {} },
  kotlin: { extensions: ['.kt', '.kts'], treeSitterLang: 'kotlin', queries: {} },
  csharp: { extensions: ['.cs'], treeSitterLang: 'c_sharp', queries: {} },
  cpp: { extensions: ['.cpp', '.cc', '.cxx', '.hpp'], treeSitterLang: 'cpp', queries: {} },
  c: { extensions: ['.c', '.h'], treeSitterLang: 'c', queries: {} },
  php: { extensions: ['.php'], treeSitterLang: 'php', queries: {} },
  ruby: { extensions: ['.rb'], treeSitterLang: 'ruby', queries: {} },
  swift: { extensions: ['.swift'], treeSitterLang: 'swift', queries: {} },
  dart: { extensions: ['.dart'], treeSitterLang: 'dart', queries: {} },
  vue: { extensions: ['.vue'], treeSitterLang: 'vue', queries: {} },
  svelte: { extensions: ['.svelte'], treeSitterLang: 'svelte', queries: {} },
  html: { extensions: ['.html', '.htm'], treeSitterLang: 'html', queries: {} },
  css: { extensions: ['.css'], treeSitterLang: 'css', queries: {} },
  scss: { extensions: ['.scss', '.sass'], treeSitterLang: 'scss', queries: {} },
  json: { extensions: ['.json'], treeSitterLang: 'json', queries: {} },
  yaml: { extensions: ['.yaml', '.yml'], treeSitterLang: 'yaml', queries: {} },
  markdown: { extensions: ['.md', '.mdx'], treeSitterLang: 'markdown', queries: {} },
  bash: { extensions: ['.sh', '.bash'], treeSitterLang: 'bash', queries: {} },
  sql: { extensions: ['.sql'], treeSitterLang: 'sql', queries: {} },
  unknown: { extensions: [], treeSitterLang: '', queries: {} },
};

export function getLanguageByExtension(ext: string): Language {
  const normalizedExt = ext.toLowerCase();
  for (const [lang, config] of Object.entries(LANGUAGE_CONFIGS)) {
    if (config.extensions.includes(normalizedExt)) {
      return lang as Language;
    }
  }
  return 'unknown';
}

export function getLanguageConfig(lang: Language): LanguageConfig {
  return LANGUAGE_CONFIGS[lang] || LANGUAGE_CONFIGS.unknown;
}

export function getSupportedExtensions(): string[] {
  const exts: string[] = [];
  for (const config of Object.values(LANGUAGE_CONFIGS)) {
    exts.push(...config.extensions);
  }
  return exts;
}

export const DEFAULT_EXCLUDE_DIRS = [
  'node_modules', '.git', 'dist', 'build', '.next', '.nuxt', '.output',
  'coverage', '.cache', '__pycache__', '.pytest_cache', 'venv', '.venv',
  'vendor', 'target', 'bin', 'obj', '.idea', '.vscode',
];
