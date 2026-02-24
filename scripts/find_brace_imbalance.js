const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'server.js');
const txt = fs.readFileSync(file, 'utf8');
const lines = txt.split(/\r?\n/);
let depth = 0;
let maxDepth = 0;
let maxLine = 0;
let openCount = 0;
let closeCount = 0;
const stack = [];
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  for (let ch of line) {
    if (ch === '{') { depth++; openCount++; if (depth > maxDepth) { maxDepth = depth; maxLine = i+1; } }
    else if (ch === '}') { depth--; closeCount++; if (stack.length) stack.pop(); }
    if (ch === '{') stack.push({ line: i+1, col: line.indexOf('{') + 1 });
  }
}
console.log('Open braces:', openCount, 'Close braces:', closeCount, 'Final depth:', depth);
console.log('Max depth:', maxDepth, 'at line', maxLine);
const start = Math.max(0, maxLine - 6);
const end = Math.min(lines.length, maxLine + 4);
console.log('\nContext around max depth (lines', start+1, '-', end, '):\n');
for (let i = start; i < end; i++) {
  const prefix = (i+1 === maxLine) ? '>>' : '  ';
  console.log(prefix, (i+1).toString().padStart(4, ' '), '|', lines[i]);
}
if (depth !== 0) {
  console.error('\nBrace imbalance detected. Final depth != 0');
  if (stack.length) {
    console.error('Unclosed opening brace(s) start at:');
    stack.slice(-10).forEach(s => console.error('  line', s.line, 'col', s.col));
  }
  process.exit(2);
}
console.log('\nNo imbalance detected.');
