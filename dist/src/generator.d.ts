import { GeneratorConfig, ValidationWarning } from './types';
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
export declare class Generator {
    private config;
    private preprocessor;
    private parser;
    private warnings;
    private allPageIds;
    private highlightGrammar;
    private varCounters;
    constructor(config: GeneratorConfig);
    /**
     * Generate TypeScript files for all markdown files in input directory
     */
    generateAll(): Promise<ValidationWarning[]>;
    /**
     * Generate TypeScript for a single markdown file
     */
    generateFile(filename: string): Promise<void>;
    /**
     * Generate the TypeScript code for a help page
     */
    private generatePageCode;
    /**
     * Generate code for a single node
     */
    private generateNodeCode;
    /**
     * Load the optional --grammar module. Accepts a default export or named
     * exports; validates the contract so a broken module fails the build
     * loudly instead of silently emitting unhighlighted pages.
     */
    private loadHighlightGrammar;
    /**
     * Emit static DOM code for a Prism token stream: the build-time mirror of
     * the runtime appendPrismTokens helper, producing identical markup.
     */
    private generateStaticTokenCode;
    private generatePrismTokenRendererCode;
    /**
     * Generate code for inline content in a container
     */
    private generateInlineContainerCode;
    /**
     * Generate code for inline nodes
     */
    private generateInlineCode;
    /**
     * Generate code for an image
     */
    private generateImageCode;
    /**
     * Generate code for a list (with nested list support)
     */
    private generateListCode;
    /**
     * Generate code for a blockquote
     */
    private generateBlockquoteCode;
    /**
     * Generate code for a callout
     * Uses Obsidian's native callout structure for proper styling
     */
    private generateCalloutCode;
    /**
     * Generate code for a table
     */
    private generateTableCode;
    /**
     * Generate code for a page link
     */
    private generateLinkCode;
    /**
     * Generate the shared types file
     */
    private generateTypesFile;
    /**
     * Generate CSS file with styles for generated help content
     */
    private generateCssFile;
    /**
     * Generate index file that exports all pages
     */
    private generateIndex;
    /**
     * Sanitize a string for use as a variable name
     */
    private sanitizeVarName;
    /**
     * Generate a semantic variable name
     */
    private getSemanticVar;
    /**
     * Check if text contains inline formatting that needs parsing
     */
    private hasInlineFormatting;
}
//# sourceMappingURL=generator.d.ts.map