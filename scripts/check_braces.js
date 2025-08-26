const fs = require('fs');
const path = process.argv[2];
if(!path) { console.error('Usage: node check_braces.js <file>'); process.exit(2);} 
const s = fs.readFileSync(path,'utf8');
let stack = [];
let state = 'normal';
let quote = null;
for(let i=0;i<s.length;i++){
  const ch = s[i];
  const next = s[i+1];
  if(state==='normal'){
    if(ch==='"' || ch=="'" || ch==='`') { state='string'; quote=ch; }
    else if(ch==='/' && next==='*'){ state='block'; i++; }
    else if(ch==='/' && next==='/'){ state='line'; i++; }
    else if(ch==='{') stack.push(i);
    else if(ch==='}'){
      if(stack.length===0){
        console.log('Unmatched closing } at index',i,'line',s.slice(0,i).split('\n').length);
      } else stack.pop();
    }
  } else if(state==='string'){
    if(ch==='\\') { i++; } else if(ch===quote) { state='normal'; quote=null; }
  } else if(state==='block'){
    if(ch==='*' && next==='/'){ state='normal'; i++; }
  } else if(state==='line'){
    if(ch==='\n') state='normal';
  }
}
if(stack.length){ console.log('UNMATCHED OPENINGS:', stack.length); const loc = stack.slice(-10).map(i=>{ const pre = s.slice(0,i); return {index:i,line:pre.split('\n').length}; }); console.log(loc); } else console.log('ALL MATCHED');
