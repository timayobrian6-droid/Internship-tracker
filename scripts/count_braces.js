const fs = require('fs');
const s = fs.readFileSync('server.js','utf8');
let o = 0, max = 0, maxLine = 0;
s.split('\n').forEach((ln,i)=>{
  for (let c of ln){ if (c === '{') o++; if (c === '}') o--; }
  if (o > max){ max = o; maxLine = i+1; }
});
console.log('maxDepth:', max, 'atLine:', maxLine);
// show surrounding lines
const lines = s.split('\n');
const start = Math.max(0, maxLine-6);
const end = Math.min(lines.length, maxLine+5);
for (let i=start;i<end;i++){
  console.log((i+1).toString().padStart(4,' ')+': '+lines[i]);
}
