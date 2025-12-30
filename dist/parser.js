"use strict";
/**
 * Tree-sitter Parser Engine
 * Universal AST parsing for all supported languages
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ParserEngine = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const web_tree_sitter_1 = __importDefault(require("web-tree-sitter"));
const languages_1 = require("./languages");
// ========================
// Parser Engine
// ========================
class ParserEngine {
    parser = null;
    languages = new Map();
    wasmDir;
    initialized = false;
    constructor(wasmDir) {
        this.wasmDir = wasmDir || path.join(__dirname, '..', 'node_modules', 'tree-sitter-wasms', 'out');
    }
    async initialize() {
        if (this.initialized)
            return;
        await web_tree_sitter_1.default.init();
        this.parser = new web_tree_sitter_1.default();
        this.initialized = true;
    }
    async loadLanguage(lang) {
        if (this.languages.has(lang)) {
            return this.languages.get(lang);
        }
        const wasmFile = path.join(this.wasmDir, `tree-sitter-${lang}.wasm`);
        if (!fs.existsSync(wasmFile)) {
            console.warn(`WASM file not found for language: ${lang}`);
            return null;
        }
        try {
            const language = await web_tree_sitter_1.default.Language.load(wasmFile);
            this.languages.set(lang, language);
            return language;
        }
        catch (err) {
            console.error(`Failed to load language ${lang}:`, err);
            return null;
        }
    }
    async parseFile(filePath, content) {
        if (!this.initialized) {
            await this.initialize();
        }
        const ext = path.extname(filePath).toLowerCase();
        const language = (0, languages_1.getLanguageByExtension)(ext);
        if (language === 'unknown') {
            return null;
        }
        const config = (0, languages_1.getLanguageConfig)(language);
        const treeSitterLang = await this.loadLanguage(config.treeSitterLang);
        if (!treeSitterLang) {
            return null;
        }
        const fileContent = content || fs.readFileSync(filePath, 'utf-8');
        // Special handling for Vue SFC files
        if (language === 'vue') {
            return this.parseVueSFC(filePath, fileContent);
        }
        this.parser.setLanguage(treeSitterLang);
        const tree = this.parser.parse(fileContent);
        const symbols = this.extractSymbols(tree.rootNode, fileContent, filePath, language);
        const imports = this.extractImports(tree.rootNode, fileContent, filePath, language);
        const exports = this.extractExports(tree.rootNode, fileContent, filePath, language);
        const references = this.extractReferences(tree.rootNode, fileContent, filePath, language);
        return {
            file: filePath,
            language,
            hash: this.hashContent(fileContent),
            lastModified: Date.now(),
            symbols,
            imports,
            exports,
            references,
        };
    }
    // ========================
    // Symbol Extraction
    // ========================
    extractSymbols(rootNode, content, filePath, language) {
        const symbols = [];
        const visitor = new SymbolVisitor(content, filePath, language);
        this.walkTree(rootNode, (node) => {
            const symbol = visitor.visitNode(node);
            if (symbol) {
                symbols.push(symbol);
            }
        });
        return symbols;
    }
    extractImports(rootNode, content, filePath, language) {
        const imports = [];
        const visitor = new ImportVisitor(content, filePath, language);
        this.walkTree(rootNode, (node) => {
            const imp = visitor.visitNode(node);
            if (imp) {
                imports.push(imp);
            }
        });
        return imports;
    }
    extractExports(rootNode, content, filePath, language) {
        const exports = [];
        const visitor = new ExportVisitor(content, filePath, language);
        this.walkTree(rootNode, (node) => {
            const exp = visitor.visitNode(node);
            if (exp) {
                exports.push(exp);
            }
        });
        return exports;
    }
    extractReferences(rootNode, content, filePath, language) {
        const refs = [];
        const visitor = new ReferenceVisitor(content, filePath, language);
        this.walkTree(rootNode, (node) => {
            const ref = visitor.visitNode(node);
            if (ref) {
                refs.push(ref);
            }
        });
        return refs;
    }
    walkTree(node, callback) {
        callback(node);
        for (let i = 0; i < node.childCount; i++) {
            this.walkTree(node.child(i), callback);
        }
    }
    /**
     * Parse Vue Single File Component (SFC)
     * Extracts script content and parses it as TypeScript/JavaScript
     */
    async parseVueSFC(filePath, content) {
        const symbols = [];
        const imports = [];
        const exports = [];
        const references = [];
        // Get component name from filename
        const fileName = filePath.split(/[/\\]/).pop() || '';
        const componentName = fileName.replace(/\.vue$/, '');
        // Add component symbol
        symbols.push({
            name: componentName,
            kind: 'component',
            range: { start: { line: 1, column: 0, offset: 0 }, end: { line: 1, column: 0, offset: 0 } },
            selectionRange: { start: { line: 1, column: 0, offset: 0 }, end: { line: 1, column: 0, offset: 0 } },
            file: filePath,
            language: 'vue',
            signature: `<${componentName}>`,
            exported: true,
        });
        // Extract script content using regex (more reliable than tree-sitter for Vue)
        const scriptRegex = /<script\s*(?:setup)?\s*(?:lang=["']?(ts|typescript)["']?)?\s*>/gi;
        const scriptMatches = [...content.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)];
        for (const match of scriptMatches) {
            const attrs = match[1] || '';
            const scriptContent = match[2] || '';
            const isSetup = attrs.includes('setup');
            const isTS = attrs.includes('ts') || attrs.includes('typescript');
            // Calculate offset for line numbers
            const scriptStart = match.index + match[0].indexOf('>') + 1;
            const linesBeforeScript = content.substring(0, scriptStart).split('\n').length;
            // Parse script content as TypeScript
            const lang = isTS ? 'typescript' : 'javascript';
            const treeSitterLang = await this.loadLanguage(lang);
            if (treeSitterLang) {
                this.parser.setLanguage(treeSitterLang);
                const tree = this.parser.parse(scriptContent);
                // Extract symbols with line offset
                const scriptSymbols = this.extractSymbols(tree.rootNode, scriptContent, filePath, lang);
                for (const sym of scriptSymbols) {
                    // Adjust line numbers
                    sym.range.start.line += linesBeforeScript - 1;
                    sym.range.end.line += linesBeforeScript - 1;
                    sym.selectionRange.start.line += linesBeforeScript - 1;
                    sym.selectionRange.end.line += linesBeforeScript - 1;
                    sym.language = 'vue';
                    // Mark composables as hooks
                    if (sym.name.startsWith('use') && sym.name.length > 3 && sym.kind === 'function') {
                        sym.kind = 'hook';
                    }
                    symbols.push(sym);
                }
                // Extract imports
                const scriptImports = this.extractImports(tree.rootNode, scriptContent, filePath, lang);
                for (const imp of scriptImports) {
                    imp.range.start.line += linesBeforeScript - 1;
                    imp.range.end.line += linesBeforeScript - 1;
                    imports.push(imp);
                }
                // Extract exports
                const scriptExports = this.extractExports(tree.rootNode, scriptContent, filePath, lang);
                for (const exp of scriptExports) {
                    exp.range.start.line += linesBeforeScript - 1;
                    exp.range.end.line += linesBeforeScript - 1;
                    exports.push(exp);
                }
                // Extract references
                const scriptRefs = this.extractReferences(tree.rootNode, scriptContent, filePath, lang);
                for (const ref of scriptRefs) {
                    ref.range.start.line += linesBeforeScript - 1;
                    ref.range.end.line += linesBeforeScript - 1;
                    references.push(ref);
                }
                // Special handling for script setup macros
                if (isSetup) {
                    this.extractScriptSetupMacros(scriptContent, filePath, linesBeforeScript, symbols);
                }
            }
        }
        // Extract template references (component usage)
        const templateMatch = content.match(/<template[^>]*>([\s\S]*?)<\/template>/i);
        if (templateMatch) {
            const templateContent = templateMatch[1];
            const templateStart = content.indexOf(templateMatch[0]);
            const linesBeforeTemplate = content.substring(0, templateStart).split('\n').length;
            // Find PascalCase component usages
            const componentRegex = /<([A-Z][a-zA-Z0-9]+)(?:\s|\/|>)/g;
            let compMatch;
            while ((compMatch = componentRegex.exec(templateContent)) !== null) {
                const compName = compMatch[1];
                const lineInTemplate = templateContent.substring(0, compMatch.index).split('\n').length;
                references.push({
                    symbol: compName,
                    file: filePath,
                    range: {
                        start: { line: linesBeforeTemplate + lineInTemplate, column: 0, offset: 0 },
                        end: { line: linesBeforeTemplate + lineInTemplate, column: 0, offset: 0 },
                    },
                    context: compMatch[0],
                    kind: 'component-usage',
                });
            }
            // Find event handlers (@click, v-on:click, etc.)
            const handlerRegex = /(?:@|v-on:)(\w+)=["']([^"'(]+)/g;
            let handlerMatch;
            while ((handlerMatch = handlerRegex.exec(templateContent)) !== null) {
                const handlerName = handlerMatch[2].trim();
                if (handlerName && !handlerName.includes(' ')) {
                    const lineInTemplate = templateContent.substring(0, handlerMatch.index).split('\n').length;
                    references.push({
                        symbol: handlerName,
                        file: filePath,
                        range: {
                            start: { line: linesBeforeTemplate + lineInTemplate, column: 0, offset: 0 },
                            end: { line: linesBeforeTemplate + lineInTemplate, column: 0, offset: 0 },
                        },
                        context: handlerMatch[0],
                        kind: 'call',
                    });
                }
            }
        }
        return {
            file: filePath,
            language: 'vue',
            hash: this.hashContent(content),
            lastModified: Date.now(),
            symbols,
            imports,
            exports,
            references,
        };
    }
    /**
     * Extract script setup macros (defineProps, defineEmits, etc.)
     */
    extractScriptSetupMacros(content, filePath, lineOffset, symbols) {
        // defineProps
        const propsMatch = content.match(/defineProps\s*[<(]/);
        if (propsMatch) {
            const line = content.substring(0, propsMatch.index).split('\n').length + lineOffset - 1;
            symbols.push({
                name: 'props',
                kind: 'property',
                range: { start: { line, column: 0, offset: 0 }, end: { line, column: 0, offset: 0 } },
                selectionRange: { start: { line, column: 0, offset: 0 }, end: { line, column: 0, offset: 0 } },
                file: filePath,
                language: 'vue',
                signature: 'defineProps<...>',
                exported: false,
            });
        }
        // defineEmits
        const emitsMatch = content.match(/defineEmits\s*[<(]/);
        if (emitsMatch) {
            const line = content.substring(0, emitsMatch.index).split('\n').length + lineOffset - 1;
            symbols.push({
                name: 'emit',
                kind: 'event',
                range: { start: { line, column: 0, offset: 0 }, end: { line, column: 0, offset: 0 } },
                selectionRange: { start: { line, column: 0, offset: 0 }, end: { line, column: 0, offset: 0 } },
                file: filePath,
                language: 'vue',
                signature: 'defineEmits<...>',
                exported: false,
            });
        }
        // defineExpose
        const exposeMatch = content.match(/defineExpose\s*\(/);
        if (exposeMatch) {
            const line = content.substring(0, exposeMatch.index).split('\n').length + lineOffset - 1;
            symbols.push({
                name: 'expose',
                kind: 'property',
                range: { start: { line, column: 0, offset: 0 }, end: { line, column: 0, offset: 0 } },
                selectionRange: { start: { line, column: 0, offset: 0 }, end: { line, column: 0, offset: 0 } },
                file: filePath,
                language: 'vue',
                signature: 'defineExpose({...})',
                exported: false,
            });
        }
    }
    hashContent(content) {
        let hash = 0;
        for (let i = 0; i < content.length; i++) {
            const char = content.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString(16);
    }
}
exports.ParserEngine = ParserEngine;
// ========================
// Node Visitors
// ========================
class BaseVisitor {
    content;
    filePath;
    language;
    constructor(content, filePath, language) {
        this.content = content;
        this.filePath = filePath;
        this.language = language;
    }
    getPosition(node) {
        return {
            line: node.startPosition.row + 1,
            column: node.startPosition.column,
            offset: node.startIndex,
        };
    }
    getRange(node) {
        return {
            start: {
                line: node.startPosition.row + 1,
                column: node.startPosition.column,
                offset: node.startIndex,
            },
            end: {
                line: node.endPosition.row + 1,
                column: node.endPosition.column,
                offset: node.endIndex,
            },
        };
    }
    getNodeText(node) {
        return this.content.substring(node.startIndex, node.endIndex);
    }
    findChild(node, type) {
        for (let i = 0; i < node.childCount; i++) {
            const child = node.child(i);
            if (child.type === type) {
                return child;
            }
        }
        return null;
    }
    findChildByField(node, field) {
        return node.childForFieldName(field);
    }
    findAllChildren(node, type) {
        const children = [];
        for (let i = 0; i < node.childCount; i++) {
            const child = node.child(i);
            if (child.type === type) {
                children.push(child);
            }
        }
        return children;
    }
    getLineContext(node) {
        const startLine = node.startPosition.row;
        const lines = this.content.split('\n');
        return lines[startLine]?.trim() || '';
    }
}
class SymbolVisitor extends BaseVisitor {
    visitNode(node) {
        switch (this.language) {
            case 'javascript':
            case 'jsx':
                return this.visitJavaScript(node);
            case 'typescript':
            case 'tsx':
                return this.visitTypeScript(node);
            case 'python':
                return this.visitPython(node);
            case 'go':
                return this.visitGo(node);
            case 'rust':
                return this.visitRust(node);
            case 'java':
                return this.visitJava(node);
            case 'csharp':
                return this.visitCSharp(node);
            case 'php':
                return this.visitPHP(node);
            case 'ruby':
                return this.visitRuby(node);
            case 'vue':
                return this.visitVue(node);
            default:
                return this.visitGeneric(node);
        }
    }
    visitJavaScript(node) {
        // Function declarations
        if (node.type === 'function_declaration') {
            const nameNode = this.findChildByField(node, 'name');
            if (nameNode) {
                return this.createSymbol(nameNode, node, 'function');
            }
        }
        // Arrow functions & function expressions assigned to variables
        if (node.type === 'variable_declarator') {
            const nameNode = this.findChildByField(node, 'name');
            const valueNode = this.findChildByField(node, 'value');
            if (nameNode && valueNode) {
                if (valueNode.type === 'arrow_function' || valueNode.type === 'function_expression') {
                    const symbol = this.createSymbol(nameNode, node, 'function');
                    if (symbol && valueNode.type === 'arrow_function') {
                        symbol.signature = this.buildArrowSignature(nameNode, valueNode);
                    }
                    return symbol;
                }
            }
        }
        // Method definitions (in classes)
        if (node.type === 'method_definition') {
            const nameNode = this.findChildByField(node, 'name');
            if (nameNode) {
                const symbol = this.createSymbol(nameNode, node, 'method');
                if (symbol) {
                    symbol.async = node.children.some(c => c.type === 'async');
                    symbol.static = node.children.some(c => c.type === 'static');
                }
                return symbol;
            }
        }
        // Class declarations
        if (node.type === 'class_declaration') {
            const nameNode = this.findChildByField(node, 'name');
            if (nameNode) {
                return this.createSymbol(nameNode, node, 'class');
            }
        }
        // Generator functions
        if (node.type === 'generator_function_declaration') {
            const nameNode = this.findChildByField(node, 'name');
            if (nameNode) {
                return this.createSymbol(nameNode, node, 'function');
            }
        }
        return null;
    }
    visitTypeScript(node) {
        // First check JavaScript patterns
        const jsSymbol = this.visitJavaScript(node);
        if (jsSymbol)
            return jsSymbol;
        // Interface declarations
        if (node.type === 'interface_declaration') {
            const nameNode = this.findChildByField(node, 'name');
            if (nameNode) {
                return this.createSymbol(nameNode, node, 'interface');
            }
        }
        // Type alias declarations
        if (node.type === 'type_alias_declaration') {
            const nameNode = this.findChildByField(node, 'name');
            if (nameNode) {
                return this.createSymbol(nameNode, node, 'type');
            }
        }
        // Enum declarations
        if (node.type === 'enum_declaration') {
            const nameNode = this.findChildByField(node, 'name');
            if (nameNode) {
                return this.createSymbol(nameNode, node, 'enum');
            }
        }
        return null;
    }
    visitPython(node) {
        // Function definitions
        if (node.type === 'function_definition') {
            const nameNode = this.findChildByField(node, 'name');
            if (nameNode) {
                const symbol = this.createSymbol(nameNode, node, 'function');
                if (symbol) {
                    symbol.async = node.children.some(c => c.type === 'async');
                    symbol.parameters = this.extractPythonParams(node);
                }
                return symbol;
            }
        }
        // Class definitions
        if (node.type === 'class_definition') {
            const nameNode = this.findChildByField(node, 'name');
            if (nameNode) {
                return this.createSymbol(nameNode, node, 'class');
            }
        }
        // Decorated definitions
        if (node.type === 'decorated_definition') {
            const funcNode = this.findChild(node, 'function_definition');
            if (funcNode) {
                return this.visitPython(funcNode);
            }
        }
        return null;
    }
    visitGo(node) {
        // Function declarations
        if (node.type === 'function_declaration') {
            const nameNode = this.findChildByField(node, 'name');
            if (nameNode) {
                return this.createSymbol(nameNode, node, 'function');
            }
        }
        // Method declarations
        if (node.type === 'method_declaration') {
            const nameNode = this.findChildByField(node, 'name');
            if (nameNode) {
                const symbol = this.createSymbol(nameNode, node, 'method');
                if (symbol) {
                    // Extract receiver type
                    const receiverNode = this.findChildByField(node, 'receiver');
                    if (receiverNode) {
                        const typeNode = receiverNode.descendantsOfType('type_identifier')[0];
                        if (typeNode) {
                            symbol.parent = this.getNodeText(typeNode);
                        }
                    }
                }
                return symbol;
            }
        }
        // Type declarations (struct, interface)
        if (node.type === 'type_declaration') {
            const specNode = this.findChild(node, 'type_spec');
            if (specNode) {
                const nameNode = this.findChildByField(specNode, 'name');
                const typeNode = this.findChildByField(specNode, 'type');
                if (nameNode && typeNode) {
                    let kind = 'type';
                    if (typeNode.type === 'struct_type')
                        kind = 'class';
                    if (typeNode.type === 'interface_type')
                        kind = 'interface';
                    return this.createSymbol(nameNode, node, kind);
                }
            }
        }
        return null;
    }
    visitRust(node) {
        // Function items
        if (node.type === 'function_item') {
            const nameNode = this.findChildByField(node, 'name');
            if (nameNode) {
                const symbol = this.createSymbol(nameNode, node, 'function');
                if (symbol) {
                    symbol.async = node.children.some(c => c.type === 'async');
                }
                return symbol;
            }
        }
        // Struct items
        if (node.type === 'struct_item') {
            const nameNode = this.findChildByField(node, 'name');
            if (nameNode) {
                return this.createSymbol(nameNode, node, 'class');
            }
        }
        // Enum items
        if (node.type === 'enum_item') {
            const nameNode = this.findChildByField(node, 'name');
            if (nameNode) {
                return this.createSymbol(nameNode, node, 'enum');
            }
        }
        // Trait items
        if (node.type === 'trait_item') {
            const nameNode = this.findChildByField(node, 'name');
            if (nameNode) {
                return this.createSymbol(nameNode, node, 'interface');
            }
        }
        // Impl items
        if (node.type === 'impl_item') {
            const typeNode = this.findChildByField(node, 'type');
            if (typeNode) {
                return this.createSymbol(typeNode, node, 'class');
            }
        }
        return null;
    }
    visitJava(node) {
        // Method declarations
        if (node.type === 'method_declaration') {
            const nameNode = this.findChildByField(node, 'name');
            if (nameNode) {
                const symbol = this.createSymbol(nameNode, node, 'method');
                if (symbol) {
                    symbol.static = this.hasModifier(node, 'static');
                    symbol.visibility = this.getVisibility(node);
                }
                return symbol;
            }
        }
        // Constructor declarations
        if (node.type === 'constructor_declaration') {
            const nameNode = this.findChildByField(node, 'name');
            if (nameNode) {
                return this.createSymbol(nameNode, node, 'constructor');
            }
        }
        // Class declarations
        if (node.type === 'class_declaration') {
            const nameNode = this.findChildByField(node, 'name');
            if (nameNode) {
                return this.createSymbol(nameNode, node, 'class');
            }
        }
        // Interface declarations
        if (node.type === 'interface_declaration') {
            const nameNode = this.findChildByField(node, 'name');
            if (nameNode) {
                return this.createSymbol(nameNode, node, 'interface');
            }
        }
        // Enum declarations
        if (node.type === 'enum_declaration') {
            const nameNode = this.findChildByField(node, 'name');
            if (nameNode) {
                return this.createSymbol(nameNode, node, 'enum');
            }
        }
        return null;
    }
    visitCSharp(node) {
        // Method declarations
        if (node.type === 'method_declaration') {
            const nameNode = this.findChildByField(node, 'name');
            if (nameNode) {
                const symbol = this.createSymbol(nameNode, node, 'method');
                if (symbol) {
                    symbol.async = node.children.some(c => c.type === 'async');
                    symbol.static = this.hasModifier(node, 'static');
                    symbol.visibility = this.getVisibility(node);
                }
                return symbol;
            }
        }
        // Class declarations
        if (node.type === 'class_declaration') {
            const nameNode = this.findChildByField(node, 'name');
            if (nameNode) {
                return this.createSymbol(nameNode, node, 'class');
            }
        }
        // Interface declarations
        if (node.type === 'interface_declaration') {
            const nameNode = this.findChildByField(node, 'name');
            if (nameNode) {
                return this.createSymbol(nameNode, node, 'interface');
            }
        }
        // Property declarations
        if (node.type === 'property_declaration') {
            const nameNode = this.findChildByField(node, 'name');
            if (nameNode) {
                return this.createSymbol(nameNode, node, 'property');
            }
        }
        return null;
    }
    visitPHP(node) {
        // Function definitions
        if (node.type === 'function_definition') {
            const nameNode = this.findChildByField(node, 'name');
            if (nameNode) {
                return this.createSymbol(nameNode, node, 'function');
            }
        }
        // Method declarations
        if (node.type === 'method_declaration') {
            const nameNode = this.findChildByField(node, 'name');
            if (nameNode) {
                const symbol = this.createSymbol(nameNode, node, 'method');
                if (symbol) {
                    symbol.visibility = this.getVisibility(node);
                    symbol.static = this.hasModifier(node, 'static');
                }
                return symbol;
            }
        }
        // Class declarations
        if (node.type === 'class_declaration') {
            const nameNode = this.findChildByField(node, 'name');
            if (nameNode) {
                return this.createSymbol(nameNode, node, 'class');
            }
        }
        // Interface declarations
        if (node.type === 'interface_declaration') {
            const nameNode = this.findChildByField(node, 'name');
            if (nameNode) {
                return this.createSymbol(nameNode, node, 'interface');
            }
        }
        return null;
    }
    visitRuby(node) {
        // Method definitions
        if (node.type === 'method') {
            const nameNode = this.findChildByField(node, 'name');
            if (nameNode) {
                return this.createSymbol(nameNode, node, 'method');
            }
        }
        // Singleton methods
        if (node.type === 'singleton_method') {
            const nameNode = this.findChildByField(node, 'name');
            if (nameNode) {
                const symbol = this.createSymbol(nameNode, node, 'method');
                if (symbol)
                    symbol.static = true;
                return symbol;
            }
        }
        // Class definitions
        if (node.type === 'class') {
            const nameNode = this.findChildByField(node, 'name');
            if (nameNode) {
                return this.createSymbol(nameNode, node, 'class');
            }
        }
        // Module definitions
        if (node.type === 'module') {
            const nameNode = this.findChildByField(node, 'name');
            if (nameNode) {
                return this.createSymbol(nameNode, node, 'module');
            }
        }
        return null;
    }
    /**
     * Vue SFC (Single File Component) Parser
     * Handles <script>, <script setup>, defineComponent, composables
     */
    visitVue(node) {
        // ==========================================
        // 1. SCRIPT ELEMENT - Extract script blocks
        // ==========================================
        if (node.type === 'script_element') {
            // We'll parse the raw_text inside script as TypeScript
            // This is handled by VueScriptExtractor below
            return null;
        }
        // ==========================================
        // 2. COMPONENT DEFINITION PATTERNS
        // ==========================================
        // Pattern: export default defineComponent({ name: 'X', ... })
        if (node.type === 'call_expression') {
            const funcNode = this.findChildByField(node, 'function');
            if (funcNode && this.getNodeText(funcNode) === 'defineComponent') {
                // Try to extract component name from arguments
                const argsNode = this.findChildByField(node, 'arguments');
                if (argsNode) {
                    const nameFromOptions = this.extractComponentName(argsNode);
                    if (nameFromOptions) {
                        const symbol = this.createSymbol(funcNode, node, 'component');
                        symbol.name = nameFromOptions;
                        return symbol;
                    }
                }
                // Use filename as component name if no explicit name
                const componentName = this.getComponentNameFromFile();
                if (componentName) {
                    const symbol = this.createSymbol(funcNode, node, 'component');
                    symbol.name = componentName;
                    return symbol;
                }
            }
        }
        // ==========================================
        // 3. COMPOSABLES (useXxx pattern)
        // ==========================================
        // Function declarations starting with 'use'
        if (node.type === 'function_declaration') {
            const nameNode = this.findChildByField(node, 'name');
            if (nameNode) {
                const name = this.getNodeText(nameNode);
                if (name.startsWith('use') && name.length > 3) {
                    const symbol = this.createSymbol(nameNode, node, 'hook');
                    symbol.signature = this.buildSignature(node, name, 'hook');
                    return symbol;
                }
                return this.createSymbol(nameNode, node, 'function');
            }
        }
        // Arrow function composables: const useXxx = () => {}
        if (node.type === 'variable_declarator') {
            const nameNode = this.findChildByField(node, 'name');
            const valueNode = this.findChildByField(node, 'value');
            if (nameNode && valueNode) {
                const name = this.getNodeText(nameNode);
                if (valueNode.type === 'arrow_function' || valueNode.type === 'function_expression') {
                    if (name.startsWith('use') && name.length > 3) {
                        const symbol = this.createSymbol(nameNode, node, 'hook');
                        return symbol;
                    }
                    return this.createSymbol(nameNode, node, 'function');
                }
            }
        }
        // ==========================================
        // 4. SCRIPT SETUP MACROS
        // ==========================================
        // defineProps, defineEmits, defineExpose, withDefaults
        if (node.type === 'call_expression') {
            const funcNode = this.findChildByField(node, 'function');
            if (funcNode) {
                const funcName = this.getNodeText(funcNode);
                if (funcName === 'defineProps') {
                    const symbol = this.createSymbol(funcNode, node, 'property');
                    symbol.name = 'props';
                    symbol.signature = this.getNodeText(node);
                    return symbol;
                }
                if (funcName === 'defineEmits') {
                    const symbol = this.createSymbol(funcNode, node, 'event');
                    symbol.name = 'emits';
                    symbol.signature = this.getNodeText(node);
                    return symbol;
                }
                if (funcName === 'defineExpose') {
                    const symbol = this.createSymbol(funcNode, node, 'property');
                    symbol.name = 'expose';
                    return symbol;
                }
            }
        }
        // ==========================================
        // 5. STANDARD TS/JS PATTERNS (fallback)
        // ==========================================
        // Method definitions
        if (node.type === 'method_definition') {
            const nameNode = this.findChildByField(node, 'name');
            if (nameNode) {
                return this.createSymbol(nameNode, node, 'method');
            }
        }
        // Class declarations
        if (node.type === 'class_declaration') {
            const nameNode = this.findChildByField(node, 'name');
            if (nameNode) {
                return this.createSymbol(nameNode, node, 'class');
            }
        }
        // Interface declarations
        if (node.type === 'interface_declaration') {
            const nameNode = this.findChildByField(node, 'name');
            if (nameNode) {
                return this.createSymbol(nameNode, node, 'interface');
            }
        }
        // Type alias declarations
        if (node.type === 'type_alias_declaration') {
            const nameNode = this.findChildByField(node, 'name');
            if (nameNode) {
                return this.createSymbol(nameNode, node, 'type');
            }
        }
        return null;
    }
    /**
     * Extract component name from defineComponent options
     */
    extractComponentName(argsNode) {
        // Look for { name: 'ComponentName' } in arguments
        const text = this.getNodeText(argsNode);
        const nameMatch = text.match(/name:\s*['"]([^'"]+)['"]/);
        if (nameMatch) {
            return nameMatch[1];
        }
        return null;
    }
    /**
     * Get component name from file path (e.g., MyComponent.vue -> MyComponent)
     */
    getComponentNameFromFile() {
        const fileName = this.filePath.split(/[/\\]/).pop() || '';
        return fileName.replace(/\.vue$/, '');
    }
    visitGeneric(node) {
        // Generic function pattern matching
        if (node.type.includes('function') && node.type.includes('declaration')) {
            const nameNode = this.findChildByField(node, 'name');
            if (nameNode) {
                return this.createSymbol(nameNode, node, 'function');
            }
        }
        if (node.type.includes('class') && node.type.includes('declaration')) {
            const nameNode = this.findChildByField(node, 'name');
            if (nameNode) {
                return this.createSymbol(nameNode, node, 'class');
            }
        }
        return null;
    }
    // Helper methods
    createSymbol(nameNode, fullNode, kind) {
        const name = this.getNodeText(nameNode);
        return {
            name,
            kind,
            range: this.getRange(fullNode),
            selectionRange: this.getRange(nameNode),
            file: this.filePath,
            language: this.language,
            signature: this.buildSignature(fullNode, name, kind),
            exported: this.isExported(fullNode),
        };
    }
    buildSignature(node, name, kind) {
        // Get the first line of the definition
        const text = this.getNodeText(node);
        const firstLine = text.split('\n')[0];
        // Truncate if too long
        if (firstLine.length > 100) {
            return firstLine.substring(0, 97) + '...';
        }
        return firstLine.trim();
    }
    buildArrowSignature(nameNode, arrowNode) {
        const name = this.getNodeText(nameNode);
        const paramsNode = this.findChildByField(arrowNode, 'parameters');
        const params = paramsNode ? this.getNodeText(paramsNode) : '()';
        return `const ${name} = ${params} =>`;
    }
    isExported(node) {
        // Check parent for export statement
        const parent = node.parent;
        if (parent) {
            if (parent.type === 'export_statement')
                return true;
            if (parent.type === 'export_default_declaration')
                return true;
            if (parent.type.includes('export'))
                return true;
        }
        // Check for export keyword in node text
        const text = this.getNodeText(node);
        return text.startsWith('export ');
    }
    hasModifier(node, modifier) {
        const modifiers = this.findChild(node, 'modifiers');
        if (modifiers) {
            return this.getNodeText(modifiers).includes(modifier);
        }
        return this.getNodeText(node).includes(modifier + ' ');
    }
    getVisibility(node) {
        const text = this.getNodeText(node);
        if (text.includes('private '))
            return 'private';
        if (text.includes('protected '))
            return 'protected';
        if (text.includes('public '))
            return 'public';
        return undefined;
    }
    extractPythonParams(node) {
        const params = [];
        const paramsNode = this.findChildByField(node, 'parameters');
        if (paramsNode) {
            for (let i = 0; i < paramsNode.childCount; i++) {
                const child = paramsNode.child(i);
                if (child.type === 'identifier') {
                    params.push({ name: this.getNodeText(child) });
                }
                else if (child.type === 'typed_parameter' || child.type === 'default_parameter') {
                    const nameNode = this.findChild(child, 'identifier');
                    if (nameNode) {
                        params.push({ name: this.getNodeText(nameNode) });
                    }
                }
            }
        }
        return params;
    }
}
// Import visitor
class ImportVisitor extends BaseVisitor {
    visitNode(node) {
        if (node.type === 'import_statement') {
            return this.visitJSImport(node);
        }
        if (node.type === 'import_from_statement') {
            return this.visitPythonImport(node);
        }
        if (node.type === 'import_declaration') {
            return this.visitGoImport(node);
        }
        if (node.type === 'use_declaration') {
            return this.visitRustUse(node);
        }
        return null;
    }
    visitJSImport(node) {
        const sourceNode = this.findChildByField(node, 'source');
        if (!sourceNode)
            return null;
        const source = this.getNodeText(sourceNode).replace(/['"]/g, '');
        const specifiers = [];
        // Check for default import
        const clause = this.findChild(node, 'import_clause');
        if (clause) {
            const defaultId = this.findChild(clause, 'identifier');
            if (defaultId) {
                specifiers.push({
                    name: this.getNodeText(defaultId),
                    isDefault: true,
                });
            }
            // Named imports
            const namedImports = this.findChild(clause, 'named_imports');
            if (namedImports) {
                const importSpecifiers = this.findAllChildren(namedImports, 'import_specifier');
                for (const spec of importSpecifiers) {
                    const nameNode = this.findChildByField(spec, 'name');
                    const aliasNode = this.findChildByField(spec, 'alias');
                    if (nameNode) {
                        specifiers.push({
                            name: this.getNodeText(nameNode),
                            alias: aliasNode ? this.getNodeText(aliasNode) : undefined,
                        });
                    }
                }
            }
            // Namespace import
            const nsImport = this.findChild(clause, 'namespace_import');
            if (nsImport) {
                const nsId = this.findChild(nsImport, 'identifier');
                if (nsId) {
                    specifiers.push({
                        name: this.getNodeText(nsId),
                        isNamespace: true,
                    });
                }
            }
        }
        return {
            source,
            file: this.filePath,
            range: this.getRange(node),
            specifiers,
            kind: specifiers.length === 0 ? 'side-effect' :
                specifiers.some(s => s.isDefault) ? 'default' :
                    specifiers.some(s => s.isNamespace) ? 'namespace' : 'named',
        };
    }
    visitPythonImport(node) {
        const moduleNode = this.findChildByField(node, 'module_name');
        if (!moduleNode)
            return null;
        return {
            source: this.getNodeText(moduleNode),
            file: this.filePath,
            range: this.getRange(node),
            specifiers: [],
            kind: 'named',
        };
    }
    visitGoImport(node) {
        const specNode = this.findChild(node, 'import_spec');
        if (!specNode)
            return null;
        const pathNode = this.findChildByField(specNode, 'path');
        if (!pathNode)
            return null;
        return {
            source: this.getNodeText(pathNode).replace(/['"]/g, ''),
            file: this.filePath,
            range: this.getRange(node),
            specifiers: [],
            kind: 'named',
        };
    }
    visitRustUse(node) {
        const argNode = this.findChildByField(node, 'argument');
        if (!argNode)
            return null;
        return {
            source: this.getNodeText(argNode),
            file: this.filePath,
            range: this.getRange(node),
            specifiers: [],
            kind: 'named',
        };
    }
}
// Export visitor
class ExportVisitor extends BaseVisitor {
    visitNode(node) {
        if (node.type === 'export_statement') {
            return this.visitJSExport(node);
        }
        return null;
    }
    visitJSExport(node) {
        // Default export
        if (this.getNodeText(node).includes('export default')) {
            const declaration = node.childCount > 1 ? node.child(1) : null;
            const name = declaration ? this.extractExportName(declaration) : 'default';
            return {
                name,
                file: this.filePath,
                range: this.getRange(node),
                kind: 'default',
            };
        }
        // Named exports
        const declaration = this.findChildByField(node, 'declaration');
        if (declaration) {
            const name = this.extractExportName(declaration);
            if (name) {
                return {
                    name,
                    file: this.filePath,
                    range: this.getRange(node),
                    kind: 'named',
                };
            }
        }
        return null;
    }
    extractExportName(node) {
        const nameNode = this.findChildByField(node, 'name');
        if (nameNode)
            return this.getNodeText(nameNode);
        // For variable declarations
        const declarator = this.findChild(node, 'variable_declarator');
        if (declarator) {
            const varName = this.findChildByField(declarator, 'name');
            if (varName)
                return this.getNodeText(varName);
        }
        return 'unknown';
    }
}
// Reference visitor
class ReferenceVisitor extends BaseVisitor {
    visitNode(node) {
        if (node.type === 'call_expression') {
            return this.visitCallExpression(node);
        }
        if (node.type === 'new_expression' || node.type === 'object_creation_expression') {
            return this.visitNewExpression(node);
        }
        // Vue-specific: Component usage in templates
        if (this.language === 'vue') {
            return this.visitVueReference(node);
        }
        return null;
    }
    /**
     * Vue-specific reference detection
     */
    visitVueReference(node) {
        // Component tags in template: <MyComponent />
        if (node.type === 'element' || node.type === 'self_closing_tag' || node.type === 'start_tag') {
            const tagName = this.findChild(node, 'tag_name');
            if (tagName) {
                const name = this.getNodeText(tagName);
                // PascalCase = Vue component, skip HTML tags
                if (name[0] === name[0].toUpperCase() && name[0] !== name[0].toLowerCase()) {
                    return {
                        symbol: name,
                        file: this.filePath,
                        range: this.getRange(node),
                        context: this.getLineContext(node),
                        kind: 'component-usage',
                    };
                }
            }
        }
        // Directive usage: v-model, v-if, @click, :prop
        if (node.type === 'attribute') {
            const attrName = this.findChild(node, 'attribute_name');
            if (attrName) {
                const name = this.getNodeText(attrName);
                // Event handlers: @click="handleClick" or v-on:click="handleClick"
                if (name.startsWith('@') || name.startsWith('v-on:')) {
                    const valueNode = this.findChild(node, 'attribute_value') ||
                        this.findChild(node, 'quoted_attribute_value');
                    if (valueNode) {
                        const handlerName = this.getNodeText(valueNode).replace(/['"]/g, '').split('(')[0].trim();
                        if (handlerName && !handlerName.includes(' ')) {
                            return {
                                symbol: handlerName,
                                file: this.filePath,
                                range: this.getRange(node),
                                context: this.getLineContext(node),
                                kind: 'call',
                            };
                        }
                    }
                }
            }
        }
        return null;
    }
    visitCallExpression(node) {
        const funcNode = this.findChildByField(node, 'function');
        if (!funcNode)
            return null;
        let name;
        if (funcNode.type === 'identifier') {
            name = this.getNodeText(funcNode);
        }
        else if (funcNode.type === 'member_expression') {
            const propNode = this.findChildByField(funcNode, 'property');
            name = propNode ? this.getNodeText(propNode) : this.getNodeText(funcNode);
        }
        else {
            return null;
        }
        return {
            symbol: name,
            file: this.filePath,
            range: this.getRange(node),
            context: this.getLineContext(node),
            kind: 'call',
        };
    }
    visitNewExpression(node) {
        const ctorNode = this.findChildByField(node, 'constructor') ||
            this.findChildByField(node, 'type');
        if (!ctorNode)
            return null;
        return {
            symbol: this.getNodeText(ctorNode),
            file: this.filePath,
            range: this.getRange(node),
            context: this.getLineContext(node),
            kind: 'instantiate',
        };
    }
}
exports.default = ParserEngine;
//# sourceMappingURL=parser.js.map