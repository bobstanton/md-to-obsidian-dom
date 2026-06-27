"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Parser = void 0;
/**
 * Parser for converting markdown to AST nodes
 * Supports:
 * - Headings (# to ######)
 * - Paragraphs
 * - Ordered and unordered lists (with nesting)
 * - Tables (GFM style)
 * - Code blocks (fenced)
 * - Blockquotes (>)
 * - Callouts (> [!note], > [!warning], etc.)
 * - Horizontal rules (---, ***, ___)
 * - Dynamic placeholders ({{dynamic:key}})
 * - Internal links ([[pageId]] or [[pageId|text]])
 * - Images (![alt](src) or ![alt](src "title"))
 * - HTML blocks
 * - Inline formatting (bold, italic, strikethrough, code, links)
 */
class Parser {
    /**
     * Parse markdown content into AST nodes
     */
    parse(content) {
        const nodes = [];
        const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
        let i = 0;
        while (i < lines.length) {
            const line = lines[i];
            if (line.trim() === '') {
                i++;
                continue;
            }
            const dynamicMatch = line.trim().match(/^\{\{dynamic:([^}]+)\}\}$/);
            if (dynamicMatch) {
                nodes.push({ type: 'dynamic', key: dynamicMatch[1].trim() });
                i++;
                continue;
            }
            if (line.match(/^(\*{3,}|-{3,}|_{3,})$/)) {
                nodes.push({ type: 'horizontalRule' });
                i++;
                continue;
            }
            const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
            if (headingMatch) {
                const level = headingMatch[1].length;
                const text = headingMatch[2];
                const heading = { type: 'heading', level, text, children: this.parseInline(text) };
                nodes.push(heading);
                i++;
                continue;
            }
            // Check for fenced code block (``` or ~~~)
            // Backtick fences (```) are rendered normally (may be executed by plugins)
            // Tilde fences (~~~) are display-only with "display:" prefix for syntax highlighting without execution
            // Allow up to 3 spaces of indentation per CommonMark spec
            const backtickMatch = line.match(/^(\s{0,3})```([\w.-]*)$/);
            const tildeMatch = line.match(/^(\s{0,3})~~~([\w.-]*)$/);
            const codeMatch = backtickMatch || tildeMatch;
            const isDisplayOnly = !!tildeMatch;
            if (codeMatch) {
                const indent = codeMatch[1];
                const baseLanguage = codeMatch[2] || '';
                const language = isDisplayOnly && baseLanguage ? `display:${baseLanguage}` : baseLanguage;
                const codeLines = [];
                const closingFencePattern = isDisplayOnly ? /^\s{0,3}~~~\s*$/ : /^\s{0,3}```\s*$/;
                i++;
                while (i < lines.length && !closingFencePattern.test(lines[i])) {
                    // Remove the same indentation from code lines if present
                    const codeLine = lines[i].startsWith(indent) ? lines[i].slice(indent.length) : lines[i];
                    codeLines.push(codeLine);
                    i++;
                }
                nodes.push({ type: 'codeBlock', language, content: codeLines.join('\n') });
                i++; // Skip closing fence
                continue;
            }
            // Check for HTML block
            if (line.trim().startsWith('<') && !line.trim().startsWith('<http')) {
                const htmlLines = [line];
                const tagMatch = line.match(/^<(\w+)/);
                if (tagMatch) {
                    const tagName = tagMatch[1];
                    const selfClosing = line.includes('/>') || ['br', 'hr', 'img', 'input'].includes(tagName.toLowerCase());
                    if (!selfClosing) {
                        i++;
                        // Collect until closing tag
                        while (i < lines.length) {
                            htmlLines.push(lines[i]);
                            if (lines[i].includes(`</${tagName}`)) {
                                break;
                            }
                            i++;
                        }
                    }
                }
                nodes.push({ type: 'html', content: htmlLines.join('\n') });
                i++;
                continue;
            }
            // Check for table
            if (line.includes('|') && i + 1 < lines.length && lines[i + 1].match(/^\|?[\s:-]+\|/)) {
                const tableResult = this.parseTable(lines, i);
                if (tableResult) {
                    nodes.push(tableResult.node);
                    i = tableResult.nextIndex;
                    continue;
                }
            }
            // Check for callout or blockquote
            if (line.match(/^>\s?/)) {
                // Check if this is a callout (> [!type] or > [!type] title)
                const calloutMatch = line.match(/^>\s*\[!(\w+)\]\s*(.*)$/);
                if (calloutMatch) {
                    const calloutResult = this.parseCallout(lines, i, calloutMatch[1], calloutMatch[2] || undefined);
                    nodes.push(calloutResult.node);
                    i = calloutResult.nextIndex;
                    continue;
                }
                const blockquoteResult = this.parseBlockquote(lines, i);
                nodes.push(blockquoteResult.node);
                i = blockquoteResult.nextIndex;
                continue;
            }
            // Check for ordered list
            const orderedMatch = line.match(/^\d+\.\s+(.+)$/);
            if (orderedMatch) {
                const listResult = this.parseList(lines, i, true);
                nodes.push(listResult.node);
                i = listResult.nextIndex;
                continue;
            }
            // Check for unordered list
            const unorderedMatch = line.match(/^[-*+]\s+(.+)$/);
            if (unorderedMatch) {
                const listResult = this.parseList(lines, i, false);
                nodes.push(listResult.node);
                i = listResult.nextIndex;
                continue;
            }
            // Check for internal link on its own line
            const linkMatch = line.trim().match(/^\[\[([^\]|]+)(?:\|([^\]]+))?\]\]$/);
            if (linkMatch) {
                nodes.push({ type: 'link', pageId: linkMatch[1].trim(), text: linkMatch[2]?.trim() });
                i++;
                continue;
            }
            // Default: paragraph
            const paragraphLines = [line];
            i++;
            // Collect continuation lines
            while (i < lines.length) {
                const nextLine = lines[i];
                const followingLine = lines[i + 1];
                if (this.isParagraphBreak(nextLine, followingLine)) {
                    break;
                }
                paragraphLines.push(nextLine);
                i++;
            }
            const paragraphText = paragraphLines.join(' ');
            nodes.push({ type: 'paragraph', children: this.parseInline(paragraphText) });
        }
        return nodes;
    }
    /**
     * Parse inline formatting within text
     * Public for use by Generator for table cell parsing
     */
    parseInline(text) {
        const nodes = [];
        let remaining = text;
        while (remaining.length > 0) {
            // Check for bold (**text** or __text__)
            const boldMatch = remaining.match(/^(\*\*|__)(.+?)\1/);
            if (boldMatch) {
                nodes.push({ type: 'bold', content: boldMatch[2] });
                remaining = remaining.slice(boldMatch[0].length);
                continue;
            }
            // Check for italic (*text* or _text_)
            const italicMatch = remaining.match(/^(\*|_)([^*_]+)\1/);
            if (italicMatch) {
                nodes.push({ type: 'italic', content: italicMatch[2] });
                remaining = remaining.slice(italicMatch[0].length);
                continue;
            }
            // Check for strikethrough (~~text~~)
            const strikeMatch = remaining.match(/^~~(.+?)~~/);
            if (strikeMatch) {
                nodes.push({ type: 'strikethrough', content: strikeMatch[1] });
                remaining = remaining.slice(strikeMatch[0].length);
                continue;
            }
            // Check for inline code (`text`)
            const codeMatch = remaining.match(/^`([^`]+)`/);
            if (codeMatch) {
                nodes.push({ type: 'code', content: codeMatch[1] });
                remaining = remaining.slice(codeMatch[0].length);
                continue;
            }
            // Check for image ![alt](src) or ![alt](src "title")
            const imageMatch = remaining.match(/^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/);
            if (imageMatch) {
                nodes.push({ type: 'inlineImage', alt: imageMatch[1], src: imageMatch[2], title: imageMatch[3] });
                remaining = remaining.slice(imageMatch[0].length);
                continue;
            }
            // Check for markdown link [text](url)
            const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
            if (linkMatch) {
                nodes.push({ type: 'inlineLink', text: linkMatch[1], url: linkMatch[2] });
                remaining = remaining.slice(linkMatch[0].length);
                continue;
            }
            // Check for internal link [[pageId]] or [[pageId|text]]
            const wikiMatch = remaining.match(/^\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/);
            if (wikiMatch) {
                // Convert to inline link for inline context
                nodes.push({ type: 'inlineLink', text: wikiMatch[2] || wikiMatch[1], url: `#${wikiMatch[1]}` });
                remaining = remaining.slice(wikiMatch[0].length);
                continue;
            }
            // Check for an explicit line break (<br>), the only HTML allowed inline.
            // Table cells need it: a markdown table row is one source line, so a
            // multi-line example inside a cell has no other way to break.
            const breakMatch = remaining.match(/^<br\s*\/?>/i);
            if (breakMatch) {
                nodes.push({ type: 'lineBreak' });
                remaining = remaining.slice(breakMatch[0].length);
                continue;
            }
            // Check for inline dynamic placeholder {{dynamic:key}}
            const dynamicMatch = remaining.match(/^\{\{dynamic:([^}]+)\}\}/);
            if (dynamicMatch) {
                nodes.push({ type: 'inlineDynamic', key: dynamicMatch[1].trim() });
                remaining = remaining.slice(dynamicMatch[0].length);
                continue;
            }
            // Find next special character
            const nextSpecial = remaining.search(/[\*_`\[\{~!<]/);
            if (nextSpecial === -1) {
                // No more special characters, add rest as text
                nodes.push({ type: 'text', content: remaining });
                break;
            }
            else if (nextSpecial === 0) {
                // Special character at start but didn't match patterns - treat as text
                nodes.push({ type: 'text', content: remaining[0] });
                remaining = remaining.slice(1);
            }
            else {
                // Add text before next special character
                nodes.push({ type: 'text', content: remaining.slice(0, nextSpecial) });
                remaining = remaining.slice(nextSpecial);
            }
        }
        return nodes;
    }
    /**
     * Parse a list (ordered or unordered) with support for nesting
     */
    parseList(lines, startIndex, ordered, indent = 0) {
        const items = [];
        let i = startIndex;
        const indentPattern = ' '.repeat(indent);
        const pattern = ordered
            ? new RegExp(`^${indentPattern}\\d+\\.\\s+(.+)$`)
            : new RegExp(`^${indentPattern}[-*+]\\s+(.+)$`);
        while (i < lines.length) {
            const line = lines[i];
            // Check if this line matches current indent level
            const match = line.match(pattern);
            if (match) {
                const item = { type: 'listItem', children: this.parseInline(match[1]) };
                // Check for nested list on next line
                if (i + 1 < lines.length) {
                    const nextLine = lines[i + 1];
                    const nestedIndent = indent + 2;
                    const nestedOrderedMatch = nextLine.match(new RegExp(`^${' '.repeat(nestedIndent)}\\d+\\.\\s+`));
                    const nestedUnorderedMatch = nextLine.match(new RegExp(`^${' '.repeat(nestedIndent)}[-*+]\\s+`));
                    if (nestedOrderedMatch || nestedUnorderedMatch) {
                        const nestedResult = this.parseList(lines, i + 1, !!nestedOrderedMatch, nestedIndent);
                        item.nestedList = nestedResult.node;
                        i = nestedResult.nextIndex;
                        items.push(item);
                        continue;
                    }
                }
                items.push(item);
                i++;
                continue;
            }
            // Check if this is a more deeply indented line (part of nested list we should skip)
            if (line.match(/^\s+[-*+\d]/)) {
                // Skip - this is handled by nested parsing
                break;
            }
            // No match at this indent level, we're done
            break;
        }
        return { node: { type: 'list', ordered, items }, nextIndex: i };
    }
    /**
     * Parse a blockquote (> prefix)
     */
    parseBlockquote(lines, startIndex) {
        const quotedLines = [];
        let i = startIndex;
        // Collect all blockquote lines
        while (i < lines.length) {
            const line = lines[i];
            const match = line.match(/^>\s?(.*)$/);
            if (match) {
                quotedLines.push(match[1]);
                i++;
            }
            else if (line.trim() === '' && i + 1 < lines.length && lines[i + 1].match(/^>/)) {
                // Empty line followed by another blockquote line - continue
                quotedLines.push('');
                i++;
            }
            else {
                break;
            }
        }
        // Parse the content within the blockquote recursively
        const innerContent = quotedLines.join('\n');
        const innerNodes = this.parse(innerContent);
        return { node: { type: 'blockquote', children: innerNodes }, nextIndex: i };
    }
    /**
     * Parse an Obsidian-style callout (> [!type] title)
     */
    parseCallout(lines, startIndex, calloutType, title) {
        const quotedLines = [];
        let i = startIndex + 1; // Skip the first line which contains [!type]
        // Collect all blockquote lines after the callout header
        while (i < lines.length) {
            const line = lines[i];
            // Check if this is a new callout header - stop current callout
            if (line.match(/^>\s*\[!\w+\]/)) {
                break;
            }
            const match = line.match(/^>\s?(.*)$/);
            if (match) {
                quotedLines.push(match[1]);
                i++;
            }
            else if (line.trim() === '' && i + 1 < lines.length && lines[i + 1].match(/^>/) && !lines[i + 1].match(/^>\s*\[!\w+\]/)) {
                // Empty line followed by another blockquote line (not a new callout) - continue
                quotedLines.push('');
                i++;
            }
            else {
                break;
            }
        }
        // Parse the content within the callout recursively
        const innerContent = quotedLines.join('\n');
        const innerNodes = this.parse(innerContent);
        return {
            node: {
                type: 'callout',
                calloutType: calloutType.toLowerCase(),
                title: title?.trim() || undefined,
                children: innerNodes
            },
            nextIndex: i
        };
    }
    /**
     * Parse a GFM table
     */
    parseTable(lines, startIndex) {
        const headerLine = lines[startIndex];
        const separatorLine = lines[startIndex + 1];
        // Parse header cells
        const headers = this.parseTableRow(headerLine);
        if (headers.length === 0)
            return null;
        // Verify separator line
        if (!separatorLine.match(/^\|?[\s:-]+\|/))
            return null;
        // Parse data rows
        const rows = [];
        let i = startIndex + 2;
        while (i < lines.length && lines[i].includes('|')) {
            const row = this.parseTableRow(lines[i]);
            if (row.length > 0) {
                rows.push(row);
            }
            i++;
        }
        return { node: { type: 'table', headers, rows }, nextIndex: i };
    }
    /**
     * Parse a single table row
     */
    parseTableRow(line) {
        // Remove leading/trailing pipes and split
        let trimmed = line.trim();
        if (trimmed.startsWith('|'))
            trimmed = trimmed.slice(1);
        if (trimmed.endsWith('|'))
            trimmed = trimmed.slice(0, -1);
        return trimmed.split('|').map(cell => cell.trim());
    }
    /**
     * Check if a line should break paragraph continuation
     */
    isParagraphBreak(line, followingLine) {
        const trimmed = line.trim();
        return (trimmed === '' ||
            /^#{1,6}\s/.test(line) ||
            /^\s{0,3}```/.test(line) ||
            /^\s{0,3}~~~/.test(line) ||
            /^[-*+]\s/.test(line) ||
            /^\d+\.\s/.test(line) ||
            /^>\s?/.test(line) ||
            (line.includes('|') && !!followingLine?.match(/^\|?[\s:-]+\|/)) ||
            trimmed.startsWith('<') ||
            /^\{\{dynamic:/.test(trimmed));
    }
}
exports.Parser = Parser;
//# sourceMappingURL=parser.js.map