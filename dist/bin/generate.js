#!/usr/bin/env node
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
const path = __importStar(require("path"));
const generator_1 = require("../src/generator");
/**
 * CLI for generating help documentation
 *
 * Usage:
 *   help-generator <input-dir> <output-dir> [options]
 *
 * Options:
 *   --prefix <prefix>    CSS class prefix (default: "help")
 *   --ext <extension>    Output file extension (default: ".generated.ts")
 *   --help               Show this help message
 *
 * Examples:
 *   help-generator ./docs/help ./src/generated-help
 *   help-generator ./help-md ./src/help --prefix places-help
 */
function showHelp() {
    console.log(`
help-generator - Generate TypeScript help pages from Markdown

Usage:
  help-generator <input-dir> <output-dir> [options]

Arguments:
  input-dir     Directory containing markdown help files
  output-dir    Directory for generated TypeScript files

Options:
  --prefix <prefix>    CSS class prefix (default: "help")
  --ext <extension>    Output file extension (default: ".generated.ts")
  --grammar <module>   Highlight grammar module; covered display-fence
                       languages are tokenized at build time
  --help               Show this help message

Examples:
  help-generator ./docs/help ./src/generated-help
  help-generator ./help-md ./src/help --prefix places-help
  help-generator ./help ./src/help --ext .help.ts
  help-generator ./help-md ./src/help --grammar ./help-grammar.mjs

Markdown Format:
  Each markdown file must have front matter with 'id' and 'title':

  ---
  id: getting-started
  title: Getting Started
  ---

  # Getting Started

  Your content here...

Special Syntax:
  ![[path/to/file.md]]          Embed another file (Obsidian embed syntax)
  ![[file.md#Section]]          Embed specific section (heading to next same-level heading)
  {{dynamic:keyName}}           Dynamic content placeholder
  [[pageId]]                    Link to another help page
  [[pageId|Custom Text]]        Link with custom text

Supported Markdown:
  # Headings                    H1 through H6
  **bold** *italic* ~~strike~~  Inline formatting
  \`code\` [link](url)            Code and links
  - lists (nested)              Ordered and unordered
  > blockquotes                 Quote blocks
  --- or ***                    Horizontal rules
  | tables |                    GFM tables
  \`\`\`lang code \`\`\`              Fenced code blocks
`);
}
function parseArgs(args) {
    const result = { config: {}, help: false };
    let i = 0;
    while (i < args.length) {
        const arg = args[i];
        if (arg === '--help' || arg === '-h') {
            result.help = true;
            i++;
        }
        else if (arg === '--prefix') {
            result.config.classPrefix = args[++i];
            i++;
        }
        else if (arg === '--ext') {
            result.config.outputExtension = args[++i];
            i++;
        }
        else if (arg === '--grammar') {
            result.config.grammarPath = args[++i];
            i++;
        }
        else if (!arg.startsWith('-')) {
            if (!result.inputDir) {
                result.inputDir = arg;
            }
            else if (!result.outputDir) {
                result.outputDir = arg;
            }
            i++;
        }
        else {
            console.error(`Unknown option: ${arg}`);
            process.exit(1);
        }
    }
    return result;
}
async function main() {
    const args = process.argv.slice(2);
    if (args.length === 0) {
        showHelp();
        process.exit(0);
    }
    const parsed = parseArgs(args);
    if (parsed.help) {
        showHelp();
        process.exit(0);
    }
    if (!parsed.inputDir || !parsed.outputDir) {
        console.error('Error: Both input-dir and output-dir are required');
        console.error('Run "help-generator --help" for usage information');
        process.exit(1);
    }
    const inputDir = path.resolve(process.cwd(), parsed.inputDir);
    const outputDir = path.resolve(process.cwd(), parsed.outputDir);
    const config = {
        inputDir,
        outputDir,
        ...parsed.config,
    };
    console.log(`Generating help documentation...`);
    console.log(`  Input:  ${inputDir}`);
    console.log(`  Output: ${outputDir}`);
    if (config.classPrefix) {
        console.log(`  Prefix: ${config.classPrefix}`);
    }
    try {
        const generator = new generator_1.Generator(config);
        await generator.generateAll();
        console.log('Done!');
    }
    catch (error) {
        console.error('Generation failed:', error);
        process.exit(1);
    }
}
main();
//# sourceMappingURL=generate.js.map