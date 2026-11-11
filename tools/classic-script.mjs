// Post-build step for the one-file builds: turns the inlined <script type="module"> into a classic
// script wrapped in a function, placed at the end of <body>. Some iPad/iPhone Safari setups refuse
// to run the inline module script; a classic script runs everywhere. The bundle has no import/export
// statements (everything is inlined), so it runs unchanged as a classic script.
// Usage: node tools/classic-script.mjs docs/index.html
import { readFileSync, writeFileSync } from 'node:fs';
const file = process.argv[2];
let html = readFileSync(file, 'utf8');
const open = html.search(/<script type="module"[^>]*>/);
if (open < 0) { console.log('classic-script: no module script found, nothing to do'); process.exit(0); }
const tagEnd = html.indexOf('>', open) + 1, close = html.indexOf('</script>', tagEnd);
const code = html.slice(tagEnd, close);
if (/^\s*(import|export)\s/m.test(code)) throw new Error('bundle still contains import/export; cannot convert to a classic script');
html = html.slice(0, open) + html.slice(close + '</script>'.length);
const tail = `<script>\n(function () {\n"use strict";\nif (window.__bt) window.__bt.stage = 'Running game code';\n${code}\n})();\n</script>\n`;
html = html.replace(/<\/body>/i, () => tail + '</body>');
writeFileSync(file, html);
console.log(`classic-script: converted ${(code.length / 1024).toFixed(0)} KB module to a classic script in ${file}`);
