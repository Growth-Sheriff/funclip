"use strict";
/**
 * Language Configurations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_EXCLUDE_DIRS = exports.LANGUAGE_CONFIGS = void 0;
exports.getLanguageByExtension = getLanguageByExtension;
exports.getLanguageConfig = getLanguageConfig;
exports.getSupportedExtensions = getSupportedExtensions;
exports.LANGUAGE_CONFIGS = {
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
function getLanguageByExtension(ext) {
    const normalizedExt = ext.toLowerCase();
    for (const [lang, config] of Object.entries(exports.LANGUAGE_CONFIGS)) {
        if (config.extensions.includes(normalizedExt)) {
            return lang;
        }
    }
    return 'unknown';
}
function getLanguageConfig(lang) {
    return exports.LANGUAGE_CONFIGS[lang] || exports.LANGUAGE_CONFIGS.unknown;
}
function getSupportedExtensions() {
    const exts = [];
    for (const config of Object.values(exports.LANGUAGE_CONFIGS)) {
        exts.push(...config.extensions);
    }
    return exts;
}
exports.DEFAULT_EXCLUDE_DIRS = [
    'node_modules', '.git', 'dist', 'build', '.next', '.nuxt', '.output',
    'coverage', '.cache', '__pycache__', '.pytest_cache', 'venv', '.venv',
    'vendor', 'target', 'bin', 'obj', '.idea', '.vscode',
];
//# sourceMappingURL=languages.js.map