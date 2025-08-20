const fs = require('fs');
const path = require('path');
const file = path.resolve(__dirname, '..', 'src', 'webglRenderer.js');
const s = fs.readFileSync(file, 'utf8');

let line=1, col=0;
function pos(i){
  // compute line:col for index i
  const before = s.slice(0,i);
  const lines = before.split('\n');
  return `${lines.length}:${lines[lines.length-1].length+1}`;
}

let brace=0, paren=0, bracket=0;
let inSingle=false, inDouble=false, inTemplate=false, escape=false;
let templateStack = []; // track ${ nesting counts
let errors = [];
for (let i=0;i<s.length;i++){
  const ch = s[i];
  if (ch === '\n') { line++; col=0; }
  else col++;

  if (escape) { escape=false; continue; }
  if (inSingle) {
    if (ch === "\\") { escape=true; continue; }
    if (ch === "'") { inSingle = false; }
    continue;
  }
  if (inDouble) {
    if (ch === "\\") { escape=true; continue; }
    if (ch === '"') { inDouble = false; }
    continue;
  }
  if (inTemplate) {
    if (ch === '`') { inTemplate = false; templateStack.pop(); continue; }
    if (ch === "\\") { escape=true; continue; }
    // detect ${ to push a nesting marker
    if (ch === '$' && s[i+1] === '{') { templateStack.push('{'); i++; continue; }
    if (ch === '}' ) {
      if (templateStack.length>0) { templateStack.pop(); continue; }
      // else treat as normal brace inside template? we'll still allow
    }
    continue;
  }

  // not in any string/template
  if (ch === "'") { inSingle = true; continue; }
  if (ch === '"') { inDouble = true; continue; }
  if (ch === '`') { inTemplate = true; templateStack.push('`'); continue; }
  if (ch === '{') { brace++; continue; }
  if (ch === '}') { brace--; if (brace<0) { errors.push({type:'unmatched_closing_brace', pos:pos(i), idx:i}); brace=0;} continue; }
  if (ch === '(') { paren++; continue; }
  if (ch === ')') { paren--; if (paren<0) { errors.push({type:'unmatched_closing_paren', pos:pos(i), idx:i}); paren=0;} continue; }
  if (ch === '[') { bracket++; continue; }
  if (ch === ']') { bracket--; if (bracket<0) { errors.push({type:'unmatched_closing_bracket', pos:pos(i), idx:i}); bracket=0;} continue; }
}

console.log('summary:');
console.log('length', s.length);
console.log('brace', brace, 'paren', paren, 'bracket', bracket, 'inSingle', inSingle, 'inDouble', inDouble, 'inTemplate', inTemplate, 'templateStackLen', templateStack.length);
if (templateStack.length>0) {
  console.log('Template stack top index maybe unclosed at', templateStack.length);
}
if (inTemplate) console.log('File ended while inside template literal');
if (inSingle) console.log('File ended while inside single quote');
if (inDouble) console.log('File ended while inside double quote');

if (errors.length) {
  console.log('Errors found:');
  errors.forEach(e=>console.log(e));
} else {
  console.log('No early unmatched closing tokens found.');
}

// print last 200 chars for debugging
console.log('\n--- tail (last 400 chars) ---\n'+s.slice(-400));

// find last backtick index
console.log('\nlast backtick index:', s.lastIndexOf('`'), 'pos', pos(s.lastIndexOf('`')));

process.exit(0);
