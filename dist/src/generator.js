"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.Generator = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const url_1 = require("url");
const Prism = __importStar(require("prismjs"));
const preprocessor_1 = require("./preprocessor");
const parser_1 = require("./parser");
/**
 * Generates TypeScript code from parsed help pages
 * Output uses Obsidian's DOM API (createEl, createDiv, createSpan, etc.)
 *
 * Features:
 * - Semantic variable naming for better readability
 * - Source map comments linking back to markdown
 * - Error boundaries around dynamic content
 * - Inline RenderContext type (no runtime dependency)
 */
class Generator {
    constructor(config) {
        this.warnings = [];
        this.allPageIds = new Set();
        this.highlightGrammar = null;
        this.varCounters = {};
        this.config = {
            classPrefix: 'help',
            outputExtension: '.generated.ts',
            ...config,
        };
        this.preprocessor = new preprocessor_1.Preprocessor(config.inputDir);
        this.parser = new parser_1.Parser();
    }
    /**
     * Generate TypeScript files for all markdown files in input directory
     */
    async generateAll() {
        this.highlightGrammar = await this.loadHighlightGrammar();
        const files = await fs.promises.readdir(this.config.inputDir);
        const mdFiles = files.filter(f => f.endsWith('.md'));
        // Ensure output directory exists
        await fs.promises.mkdir(this.config.outputDir, { recursive: true });
        // First pass: collect all page IDs for validation
        for (const file of mdFiles) {
            const filePath = path.join(this.config.inputDir, file);
            const result = await this.preprocessor.processFile(filePath);
            this.allPageIds.add(result.meta.id);
        }
        // Second pass: generate files with validation
        for (const file of mdFiles) {
            await this.generateFile(file);
        }
        // Generate shared types file
        await this.generateTypesFile();
        // Generate CSS file
        await this.generateCssFile();
        // Generate index file
        await this.generateIndex(mdFiles);
        // Report warnings
        if (this.warnings.length > 0) {
            console.log(`\nValidation warnings:`);
            for (const warning of this.warnings) {
                const location = warning.location ? `:${warning.location.line}` : '';
                console.log(`  ⚠ ${warning.file}${location}: ${warning.message}`);
            }
        }
        return this.warnings;
    }
    /**
     * Generate TypeScript for a single markdown file
     */
    async generateFile(filename) {
        this.varCounters = {};
        const filePath = path.join(this.config.inputDir, filename);
        const result = await this.preprocessor.processFile(filePath);
        const nodes = this.parser.parse(result.content);
        for (const linkedPage of result.linkedPages) {
            if (!this.allPageIds.has(linkedPage)) {
                this.warnings.push({
                    type: 'broken-link',
                    message: `Link to unknown page: [[${linkedPage}]]`,
                    file: filename,
                });
            }
        }
        const page = { meta: result.meta, nodes };
        const outputFilename = filename.replace('.md', this.config.outputExtension);
        const outputPath = path.join(this.config.outputDir, outputFilename);
        const code = this.generatePageCode(page, result.dynamicKeys, result.linkedPages, filename);
        await fs.promises.writeFile(outputPath, code, 'utf-8');
        console.log(`Generated: ${outputFilename}`);
    }
    /**
     * Generate the TypeScript code for a help page
     */
    generatePageCode(page, dynamicKeys, linkedPages, sourceFile) {
        const prefix = this.config.classPrefix;
        // Generate body code first to detect if ctx is used
        const bodyLines = [];
        for (const node of page.nodes) {
            const nodeCode = this.generateNodeCode(node, prefix, 'container');
            bodyLines.push(...nodeCode.map(l => '  ' + l));
        }
        // Check if ctx is used in the generated code
        const bodyCode = bodyLines.join('\n');
        const ctxUsed = bodyCode.includes('ctx.');
        const ctxParam = ctxUsed ? 'ctx' : '_ctx';
        // Check if MarkdownRenderer is used (for ``` code blocks)
        const usesMarkdownRenderer = bodyCode.includes('MarkdownRenderer.render');
        const usesPrismTokenRenderer = bodyCode.includes('renderPrismCode');
        const lines = [];
        lines.push('// Generated by md-to-obsidian-dom');
        lines.push(`// Source: ${sourceFile}`);
        lines.push('');
        if (usesMarkdownRenderer) {
            lines.push("import { MarkdownRenderer } from 'obsidian';");
        }
        lines.push("import './styles.generated.css';");
        lines.push('');
        lines.push("import type { RenderContext } from './types.generated';");
        lines.push('');
        lines.push(`export const pageId = ${JSON.stringify(page.meta.id)};`);
        lines.push(`export const pageTitle = ${JSON.stringify(page.meta.title)};`);
        lines.push('');
        lines.push('export const meta = {');
        for (const [key, value] of Object.entries(page.meta)) {
            lines.push(`  ${key}: ${JSON.stringify(value)},`);
        }
        lines.push('};');
        lines.push('');
        lines.push(`export const dynamicKeys: string[] = ${JSON.stringify(dynamicKeys)};`);
        lines.push(`export const linkedPages: string[] = ${JSON.stringify(linkedPages)};`);
        lines.push('');
        lines.push('/**');
        lines.push(` * Render the "${page.meta.title}" help page`);
        lines.push(' * @param container - Container element to render into');
        lines.push(` * @param ${ctxParam} - Render context with code highlighting and dynamic content handlers`);
        lines.push(' */');
        lines.push(`export function render(container: HTMLElement, ${ctxParam}: RenderContext): void {`);
        lines.push(...bodyLines);
        lines.push('}');
        if (usesPrismTokenRenderer) {
            lines.push('');
            lines.push(...this.generatePrismTokenRendererCode());
        }
        return lines.join('\n');
    }
    /**
     * Generate code for a single node
     */
    generateNodeCode(node, prefix, parentVar) {
        const lines = [];
        switch (node.type) {
            case 'heading':
                if (node.children && node.children.some(c => c.type !== 'text')) {
                    lines.push(...this.generateInlineContainerCode(node.children, prefix, parentVar, `h${node.level}`, `${prefix}-heading ${prefix}-h${node.level}`, 'heading'));
                }
                else {
                    lines.push(`${parentVar}.createEl('h${node.level}', { cls: '${prefix}-heading ${prefix}-h${node.level}', text: ${JSON.stringify(node.text)} });`);
                }
                break;
            case 'paragraph':
                lines.push(...this.generateInlineContainerCode(node.children, prefix, parentVar, 'p', `${prefix}-paragraph`, 'para'));
                break;
            case 'list':
                lines.push(...this.generateListCode(node, prefix, parentVar));
                break;
            case 'table':
                lines.push(...this.generateTableCode(node, prefix, parentVar));
                break;
            case 'codeBlock': {
                // ~~~ fences have "display:" prefix - render with visible fence markers (source/edit mode style)
                // ``` fences have no prefix - use MarkdownRenderer to invoke actual code block processor
                const isDisplayMode = node.language.startsWith('display:');
                const language = isDisplayMode ? node.language.slice('display:'.length) : node.language;
                if (isDisplayMode) {
                    // Display mode (~~~ fence): render with visible fence markers like live preview
                    // Do not use language-X classes here: Obsidian scans language classes
                    // for code block processors. Prism tokens are emitted as DOM text
                    // nodes and spans so plugin review does not flag HTML assignment.
                    const varName = this.getSemanticVar('codeBlock');
                    const codeVarName = this.getSemanticVar('code');
                    lines.push(`const ${varName} = ${parentVar}.createEl('pre', { cls: 'HyperMD-codeblock HyperMD-codeblock-bg display-only' });`);
                    lines.push(`${varName}.createSpan({ cls: '${prefix}-fence cm-formatting', text: ${JSON.stringify('```' + language + '\n')} });`);
                    lines.push(`const ${codeVarName} = ${varName}.createEl('code');`);
                    const grammar = this.highlightGrammar?.covers(language)
                        ? this.highlightGrammar.grammarFor?.(language) ?? this.highlightGrammar.grammar
                        : undefined;
                    if (grammar) {
                        // The source and grammar are both known now, so tokenize here and
                        // emit static spans: the page then needs no runtime Prism state.
                        const tokens = Prism.tokenize(node.content, grammar);
                        lines.push(...this.generateStaticTokenCode(tokens, codeVarName));
                    }
                    else {
                        lines.push(`renderPrismCode(${codeVarName}, ${JSON.stringify(node.content)}, ${JSON.stringify(language)});`);
                    }
                    lines.push(`${varName}.createSpan({ cls: '${prefix}-fence cm-formatting', text: ${JSON.stringify('\n```')} });`);
                }
                else {
                    // Normal mode (``` fence): use MarkdownRenderer to invoke actual code block processor
                    const varName = this.getSemanticVar('codeBlock');
                    const codeBlockMarkdown = '```' + language + '\n' + node.content + '\n```';
                    lines.push(`const ${varName} = ${parentVar}.createDiv();`);
                    lines.push(`void MarkdownRenderer.render(ctx.app, ${JSON.stringify(codeBlockMarkdown)}, ${varName}, '', ctx.component);`);
                }
                break;
            }
            case 'dynamic':
                lines.push(`try { ctx.renderDynamic(${parentVar}, ${JSON.stringify(node.key)}); } catch (e) { console.error('Failed to render dynamic content:', ${JSON.stringify(node.key)}, e); }`);
                break;
            case 'link':
                lines.push(...this.generateLinkCode(node, prefix, parentVar));
                break;
            case 'html':
                lines.push(`${parentVar}.createDiv({ cls: '${prefix}-html', text: ${JSON.stringify(node.content)} });`);
                break;
            case 'blockquote':
                lines.push(...this.generateBlockquoteCode(node, prefix, parentVar));
                break;
            case 'callout':
                lines.push(...this.generateCalloutCode(node, prefix, parentVar));
                break;
            case 'horizontalRule':
                lines.push(`${parentVar}.createEl('hr', { cls: '${prefix}-hr' });`);
                break;
        }
        return lines;
    }
    /**
     * Load the optional --grammar module. Accepts a default export or named
     * exports; validates the contract so a broken module fails the build
     * loudly instead of silently emitting unhighlighted pages.
     */
    async loadHighlightGrammar() {
        if (!this.config.grammarPath)
            return null;
        const url = (0, url_1.pathToFileURL)(path.resolve(this.config.grammarPath)).href;
        // Native dynamic import, shielded from tsc's CommonJS downleveling
        // (which would turn it into a require() that cannot load file: URLs).
        const dynamicImport = new Function('specifier', 'return import(specifier)');
        const imported = await dynamicImport(url);
        const module = (imported.default ?? imported);
        const hasGrammar = !!module.grammar && typeof module.grammar === 'object';
        const hasGrammarFor = typeof module.grammarFor === 'function';
        if (typeof module.covers !== 'function' || (!hasGrammar && !hasGrammarFor)) {
            throw new Error(`Grammar module ${this.config.grammarPath} must export covers(language) and a grammar object or grammarFor(language)`);
        }
        return module;
    }
    /**
     * Emit static DOM code for a Prism token stream: the build-time mirror of
     * the runtime appendPrismTokens helper, producing identical markup.
     */
    generateStaticTokenCode(tokens, parentVar) {
        const lines = [];
        for (const token of tokens) {
            if (typeof token === 'string') {
                if (token)
                    lines.push(`${parentVar}.appendText(${JSON.stringify(token)});`);
                continue;
            }
            const aliases = Array.isArray(token.alias) ? token.alias : token.alias ? [token.alias] : [];
            const cls = ['token', token.type, ...aliases].join(' ');
            if (typeof token.content === 'string') {
                lines.push(`${parentVar}.createSpan({ cls: ${JSON.stringify(cls)}, text: ${JSON.stringify(token.content)} });`);
                continue;
            }
            const spanVar = this.getSemanticVar('token');
            lines.push(`const ${spanVar} = ${parentVar}.createSpan({ cls: ${JSON.stringify(cls)} });`);
            const children = Array.isArray(token.content) ? token.content : [token.content];
            lines.push(...this.generateStaticTokenCode(children, spanVar));
        }
        return lines;
    }
    generatePrismTokenRendererCode() {
        return [
            'type PrismTokenStream = string | PrismToken | PrismTokenStream[];',
            '',
            'interface PrismToken {',
            '  type: string;',
            '  content: PrismTokenStream;',
            '  alias?: string | string[];',
            '}',
            '',
            'interface PrismApi {',
            '  languages: Record<string, unknown>;',
            '  tokenize: (code: string, grammar: unknown) => PrismTokenStream[];',
            '}',
            '',
            'declare const Prism: PrismApi | undefined;',
            '',
            'function renderPrismCode(container: HTMLElement, source: string, language: string): void {',
            "  const prism = typeof Prism !== 'undefined' ? Prism : undefined;",
            '  // Optional-chain languages too: the host may define a Prism global whose languages are not loaded yet.',
            '  const grammar = prism?.languages?.[language];',
            '',
            '  if (!prism || !grammar) {',
            '    container.appendText(source);',
            '    return;',
            '  }',
            '',
            '  appendPrismTokens(container, prism.tokenize(source, grammar));',
            '}',
            '',
            'function appendPrismTokens(container: HTMLElement, tokenStream: PrismTokenStream): void {',
            "  if (typeof tokenStream === 'string') {",
            '    container.appendText(tokenStream);',
            '    return;',
            '  }',
            '',
            '  if (Array.isArray(tokenStream)) {',
            '    for (const token of tokenStream) {',
            '      appendPrismTokens(container, token);',
            '    }',
            '    return;',
            '  }',
            '',
            '  const aliases = Array.isArray(tokenStream.alias)',
            '    ? tokenStream.alias',
            '    : tokenStream.alias ? [tokenStream.alias] : [];',
            "  const span = container.createSpan({ cls: ['token', tokenStream.type, ...aliases].join(' ') });",
            '  appendPrismTokens(span, tokenStream.content);',
            '}',
        ];
    }
    /**
     * Generate code for inline content in a container
     */
    generateInlineContainerCode(children, prefix, parentVar, tag, cls, context) {
        const lines = [];
        const varName = this.getSemanticVar(context);
        lines.push(`const ${varName} = ${parentVar}.createEl('${tag}', { cls: '${cls}' });`);
        for (const child of children) {
            lines.push(...this.generateInlineCode(child, prefix, varName));
        }
        return lines;
    }
    /**
     * Generate code for inline nodes
     */
    generateInlineCode(node, prefix, parentVar) {
        const lines = [];
        switch (node.type) {
            case 'text':
                lines.push(`${parentVar}.appendText(${JSON.stringify(node.content)});`);
                break;
            case 'bold':
                lines.push(`${parentVar}.createEl('strong', { cls: '${prefix}-bold', text: ${JSON.stringify(node.content)} });`);
                break;
            case 'italic':
                lines.push(`${parentVar}.createEl('em', { cls: '${prefix}-italic', text: ${JSON.stringify(node.content)} });`);
                break;
            case 'strikethrough':
                lines.push(`${parentVar}.createEl('s', { cls: '${prefix}-strikethrough', text: ${JSON.stringify(node.content)} });`);
                break;
            case 'code':
                lines.push(`${parentVar}.createEl('code', { cls: '${prefix}-code', text: ${JSON.stringify(node.content)} });`);
                break;
            case 'inlineLink':
                if (node.url.startsWith('#')) {
                    lines.push(`${parentVar}.createSpan({ cls: '${prefix}-link ${prefix}-internal-link', text: ${JSON.stringify(node.text)} });`);
                }
                else {
                    lines.push(`${parentVar}.createEl('a', { cls: '${prefix}-link ${prefix}-external-link', text: ${JSON.stringify(node.text)}, attr: { href: ${JSON.stringify(node.url)}, target: '_blank', rel: 'noopener' } });`);
                }
                break;
            case 'inlineImage':
                lines.push(...this.generateImageCode(node, prefix, parentVar));
                break;
            case 'lineBreak':
                lines.push(`${parentVar}.createEl('br');`);
                break;
            case 'inlineDynamic':
                lines.push(`try { ctx.renderDynamic(${parentVar}, ${JSON.stringify(node.key)}); } catch (e) { console.error('Failed to render dynamic content:', ${JSON.stringify(node.key)}, e); }`);
                break;
        }
        return lines;
    }
    /**
     * Generate code for an image
     */
    generateImageCode(node, prefix, parentVar) {
        const lines = [];
        const attrs = [
            `src: ${JSON.stringify(node.src)}`,
            `alt: ${JSON.stringify(node.alt)}`,
        ];
        if (node.title) {
            attrs.push(`title: ${JSON.stringify(node.title)}`);
        }
        lines.push(`${parentVar}.createEl('img', { cls: '${prefix}-image', attr: { ${attrs.join(', ')} } });`);
        return lines;
    }
    /**
     * Generate code for a list (with nested list support)
     */
    generateListCode(node, prefix, parentVar) {
        const lines = [];
        const tag = node.ordered ? 'ol' : 'ul';
        const listVar = this.getSemanticVar('list');
        lines.push(`const ${listVar} = ${parentVar}.createEl('${tag}', { cls: '${prefix}-list ${prefix}-${node.ordered ? 'ordered' : 'unordered'}-list' });`);
        for (const item of node.items) {
            const itemVar = this.getSemanticVar('item');
            lines.push(`const ${itemVar} = ${listVar}.createEl('li', { cls: '${prefix}-list-item' });`);
            for (const child of item.children) {
                lines.push(...this.generateInlineCode(child, prefix, itemVar));
            }
            if (item.nestedList) {
                lines.push(...this.generateListCode(item.nestedList, prefix, itemVar));
            }
        }
        return lines;
    }
    /**
     * Generate code for a blockquote
     */
    generateBlockquoteCode(node, prefix, parentVar) {
        const lines = [];
        const blockquoteVar = this.getSemanticVar('quote');
        lines.push(`const ${blockquoteVar} = ${parentVar}.createEl('blockquote', { cls: '${prefix}-blockquote' });`);
        for (const child of node.children) {
            lines.push(...this.generateNodeCode(child, prefix, blockquoteVar));
        }
        return lines;
    }
    /**
     * Generate code for a callout
     * Uses Obsidian's native callout structure for proper styling
     */
    generateCalloutCode(node, prefix, parentVar) {
        const lines = [];
        const calloutVar = this.getSemanticVar('callout');
        const calloutType = node.calloutType.toLowerCase();
        // Create callout container with Obsidian's native structure
        // data-callout attribute is required for Obsidian's CSS to apply
        lines.push(`const ${calloutVar} = ${parentVar}.createDiv({ cls: 'callout', attr: { 'data-callout': ${JSON.stringify(calloutType)}, 'data-callout-metadata': '', 'data-callout-fold': '' } });`);
        // Create header with Obsidian's structure
        const headerVar = this.getSemanticVar('header');
        lines.push(`const ${headerVar} = ${calloutVar}.createDiv({ cls: 'callout-title', attr: { dir: 'auto' } });`);
        // Add icon container
        const iconVar = this.getSemanticVar('icon');
        lines.push(`const ${iconVar} = ${headerVar}.createDiv({ cls: 'callout-icon' });`);
        // Map callout types to Lucide icon names
        const iconMap = {
            note: 'pencil',
            tip: 'flame',
            warning: 'alert-triangle',
            danger: 'zap',
            important: 'alert-circle',
            caution: 'alert-triangle',
            info: 'info',
            success: 'check',
            question: 'help-circle',
            quote: 'quote',
            example: 'list',
            bug: 'bug',
            abstract: 'clipboard-list',
            todo: 'check-circle-2',
            failure: 'x',
        };
        const iconName = iconMap[calloutType] || 'pencil';
        lines.push(`ctx.setIcon(${iconVar}, ${JSON.stringify(iconName)});`);
        const title = node.title || calloutType.charAt(0).toUpperCase() + calloutType.slice(1);
        lines.push(`${headerVar}.createDiv({ cls: 'callout-title-inner', text: ${JSON.stringify(title)} });`);
        const contentVar = this.getSemanticVar('content');
        lines.push(`const ${contentVar} = ${calloutVar}.createDiv({ cls: 'callout-content' });`);
        for (const child of node.children) {
            lines.push(...this.generateNodeCode(child, prefix, contentVar));
        }
        return lines;
    }
    /**
     * Generate code for a table
     */
    generateTableCode(node, prefix, parentVar) {
        const lines = [];
        const wrapperVar = this.getSemanticVar('tableWrapper');
        const tableVar = this.getSemanticVar('table');
        // Wrap table in scrollable container for mobile responsiveness
        lines.push(`const ${wrapperVar} = ${parentVar}.createDiv({ cls: '${prefix}-table-wrapper' });`);
        lines.push(`const ${tableVar} = ${wrapperVar}.createEl('table', { cls: '${prefix}-table' });`);
        const theadVar = this.getSemanticVar('thead');
        const headerRowVar = this.getSemanticVar('row');
        lines.push(`const ${theadVar} = ${tableVar}.createEl('thead');`);
        lines.push(`const ${headerRowVar} = ${theadVar}.createEl('tr');`);
        for (const header of node.headers) {
            if (this.hasInlineFormatting(header)) {
                const headerCellVar = this.getSemanticVar('th');
                lines.push(`const ${headerCellVar} = ${headerRowVar}.createEl('th');`);
                const inlineNodes = this.parser.parseInline(header);
                for (const inlineNode of inlineNodes) {
                    lines.push(...this.generateInlineCode(inlineNode, prefix, headerCellVar));
                }
            }
            else {
                lines.push(`${headerRowVar}.createEl('th', { text: ${JSON.stringify(header)} });`);
            }
        }
        const tbodyVar = this.getSemanticVar('tbody');
        lines.push(`const ${tbodyVar} = ${tableVar}.createEl('tbody');`);
        for (const row of node.rows) {
            const rowVar = this.getSemanticVar('row');
            lines.push(`const ${rowVar} = ${tbodyVar}.createEl('tr');`);
            for (const cell of row) {
                if (this.hasInlineFormatting(cell)) {
                    const cellVar = this.getSemanticVar('td');
                    lines.push(`const ${cellVar} = ${rowVar}.createEl('td');`);
                    const inlineNodes = this.parser.parseInline(cell);
                    for (const inlineNode of inlineNodes) {
                        lines.push(...this.generateInlineCode(inlineNode, prefix, cellVar));
                    }
                }
                else {
                    lines.push(`${rowVar}.createEl('td', { text: ${JSON.stringify(cell)} });`);
                }
            }
        }
        return lines;
    }
    /**
     * Generate code for a page link
     */
    generateLinkCode(node, prefix, parentVar) {
        const lines = [];
        const text = node.text || node.pageId;
        lines.push(`${parentVar}.createSpan({ cls: '${prefix}-page-link', text: ${JSON.stringify(text)} });`);
        return lines;
    }
    /**
     * Generate the shared types file
     */
    async generateTypesFile() {
        const lines = [];
        lines.push('// Auto-generated by md-to-obsidian-dom');
        lines.push('');
        lines.push("import type { App, Component } from 'obsidian';");
        lines.push('');
        lines.push('/** Context for rendering help pages */');
        lines.push('export interface RenderContext {');
        lines.push('  /** Obsidian App instance */');
        lines.push('  app: App;');
        lines.push('  /** Component for lifecycle management */');
        lines.push('  component: Component;');
        lines.push('  /** Render dynamic content by key */');
        lines.push('  renderDynamic: (container: HTMLElement, key: string) => void;');
        lines.push('  /** Set an icon on an element (for callout icons) */');
        lines.push('  setIcon: (element: HTMLElement, iconId: string) => void;');
        lines.push('}');
        const typesPath = path.join(this.config.outputDir, `types${this.config.outputExtension}`);
        await fs.promises.writeFile(typesPath, lines.join('\n'), 'utf-8');
        console.log(`Generated: types${this.config.outputExtension}`);
    }
    /**
     * Generate CSS file with styles for generated help content
     */
    async generateCssFile() {
        const prefix = this.config.classPrefix;
        const css = `/* Auto-generated by md-to-obsidian-dom */

/* Fence markers (\`\`\`language and \`\`\`) styled to be subtle like edit mode */
.${prefix}-fence {
  color: var(--text-muted);
  opacity: 0.7;
}

/* Table wrapper for horizontal scrolling on narrow screens */
.${prefix}-table-wrapper {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}
`;
        const cssPath = path.join(this.config.outputDir, 'styles.generated.css');
        await fs.promises.writeFile(cssPath, css, 'utf-8');
        console.log('Generated: styles.generated.css');
    }
    /**
     * Generate index file that exports all pages
     */
    async generateIndex(mdFiles) {
        const lines = [];
        const pages = [];
        lines.push('// Auto-generated by md-to-obsidian-dom');
        lines.push('');
        lines.push("import './styles.generated.css';");
        lines.push('');
        lines.push("export type { RenderContext } from './types.generated';");
        lines.push('');
        for (const file of mdFiles) {
            const baseName = file.replace('.md', '');
            const varName = this.sanitizeVarName(baseName);
            const importPath = `./${baseName}${this.config.outputExtension.replace('.ts', '')}`;
            pages.push({ varName, importPath });
            lines.push(`import * as ${varName} from '${importPath}';`);
        }
        lines.push('');
        lines.push('export const pages = {');
        for (const page of pages) {
            lines.push(`  [${page.varName}.pageId]: ${page.varName},`);
        }
        lines.push('};');
        lines.push('');
        lines.push('export type PageId = keyof typeof pages;');
        lines.push('');
        lines.push('export function getPage(id: PageId) {');
        lines.push('  return pages[id];');
        lines.push('}');
        lines.push('');
        lines.push('export function getAllPageIds(): PageId[] {');
        lines.push('  return Object.keys(pages) as PageId[];');
        lines.push('}');
        const indexPath = path.join(this.config.outputDir, `index${this.config.outputExtension}`);
        await fs.promises.writeFile(indexPath, lines.join('\n'), 'utf-8');
        console.log(`Generated: index${this.config.outputExtension}`);
    }
    /**
     * Sanitize a string for use as a variable name
     */
    sanitizeVarName(name) {
        return name.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^(\d)/, '_$1');
    }
    /**
     * Generate a semantic variable name
     */
    getSemanticVar(context) {
        const count = this.varCounters[context] ?? 0;
        this.varCounters[context] = count + 1;
        return count === 0 ? context : `${context}${count}`;
    }
    /**
     * Check if text contains inline formatting that needs parsing
     */
    hasInlineFormatting(text) {
        // Matches: bold (**), italic (* or _), strikethrough (~~), code (`), links ([...](...)), images (![), dynamic placeholders ({{dynamic:...}})
        return /\*\*|(?<!\*)\*(?!\*)|\b_|~~|`|\[.*\]\(.*\)|!\[|\{\{dynamic:|<br\s*\/?>/i.test(text);
    }
}
exports.Generator = Generator;
//# sourceMappingURL=generator.js.map