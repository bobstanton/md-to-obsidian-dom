/**
 * Front matter metadata for a help page
 */
export interface HelpPageMeta {
    id: string;
    title: string;
    [key: string]: unknown;
}
/**
 * AST node types for parsed markdown
 */
export type HelpNode = HeadingNode | ParagraphNode | ListNode | TableNode | CodeBlockNode | DynamicNode | LinkNode | HtmlNode | BlockquoteNode | CalloutNode | HorizontalRuleNode;
export interface HeadingNode {
    type: 'heading';
    level: 1 | 2 | 3 | 4 | 5 | 6;
    text: string;
    children?: InlineNode[];
}
export interface ParagraphNode {
    type: 'paragraph';
    children: InlineNode[];
}
export interface ListNode {
    type: 'list';
    ordered: boolean;
    items: ListItemNode[];
}
export interface ListItemNode {
    type: 'listItem';
    children: InlineNode[];
    nestedList?: ListNode;
}
export interface TableNode {
    type: 'table';
    headers: string[];
    rows: string[][];
}
export interface CodeBlockNode {
    type: 'codeBlock';
    language: string;
    content: string;
}
export interface DynamicNode {
    type: 'dynamic';
    key: string;
}
export interface LinkNode {
    type: 'link';
    pageId: string;
    text?: string;
}
export interface HtmlNode {
    type: 'html';
    content: string;
}
export interface BlockquoteNode {
    type: 'blockquote';
    children: HelpNode[];
}
export interface HorizontalRuleNode {
    type: 'horizontalRule';
}
export interface CalloutNode {
    type: 'callout';
    calloutType: string;
    title?: string;
    children: HelpNode[];
}
/**
 * Inline formatting nodes
 */
export type InlineNode = TextNode | BoldNode | ItalicNode | StrikethroughNode | CodeNode | InlineLinkNode | InlineImageNode | InlineDynamicNode | LineBreakNode;
export interface TextNode {
    type: 'text';
    content: string;
}
export interface BoldNode {
    type: 'bold';
    content: string;
}
export interface ItalicNode {
    type: 'italic';
    content: string;
}
export interface StrikethroughNode {
    type: 'strikethrough';
    content: string;
}
export interface CodeNode {
    type: 'code';
    content: string;
}
export interface InlineLinkNode {
    type: 'inlineLink';
    url: string;
    text: string;
}
export interface InlineImageNode {
    type: 'inlineImage';
    src: string;
    alt: string;
    title?: string;
}
export interface InlineDynamicNode {
    type: 'inlineDynamic';
    key: string;
}
export interface LineBreakNode {
    type: 'lineBreak';
}
/**
 * Parsed help page structure
 */
export interface HelpPage {
    meta: HelpPageMeta;
    nodes: HelpNode[];
}
/**
 * Context passed to render functions
 */
export interface RenderContext {
    /** Obsidian App instance used for native markdown rendering */
    app: unknown;
    /** Component used for rendered markdown lifecycle management */
    component: unknown;
    /** Render dynamic content by key */
    renderDynamic: (container: HTMLElement, key: string) => void;
    /** Set an icon on an element */
    setIcon: (element: HTMLElement, iconId: string) => void;
}
/**
 * Configuration for the generator
 */
export interface GeneratorConfig {
    /** Input directory containing markdown files */
    inputDir: string;
    /** Output directory for generated TypeScript */
    outputDir: string;
    /** CSS class prefix for generated elements */
    classPrefix?: string;
    /** File extension for output (default: .generated.ts) */
    outputExtension?: string;
    /** Path to a highlight grammar module; covered languages are tokenized at build time */
    grammarPath?: string;
}
/**
 * Contract for a `--grammar` module. Display-fence languages the module
 * covers are tokenized during generation and emitted as static token spans,
 * so the page needs no runtime Prism registration. Uncovered languages keep
 * the runtime Prism fallback.
 */
export interface HighlightGrammarModule {
    /** Whether this grammar applies to a fence language. */
    covers(language: string): boolean;
    /** Prism-style grammar used to tokenize every covered language. */
    grammar?: unknown;
    /** Per-language grammar; takes precedence over `grammar` when both exist. */
    grammarFor?(language: string): unknown;
}
/**
 * Result of preprocessing a markdown file
 */
export interface PreprocessResult {
    /** Processed content with includes resolved */
    content: string;
    /** Front matter metadata */
    meta: HelpPageMeta;
    /** Dynamic placeholders found */
    dynamicKeys: string[];
    /** Referenced page IDs (from [[id]] links) */
    linkedPages: string[];
}
/**
 * Source location for source map generation
 */
export interface SourceLocation {
    line: number;
    column: number;
}
/**
 * Validation warning
 */
export interface ValidationWarning {
    type: 'broken-link' | 'undefined-dynamic-key' | 'missing-image';
    message: string;
    location?: SourceLocation;
    file: string;
}
/**
 * Result of validation
 */
export interface ValidationResult {
    warnings: ValidationWarning[];
    errors: ValidationWarning[];
}
//# sourceMappingURL=types.d.ts.map