const fs=require('fs');
const s=fs.readFileSync('d:/GitHub/SpaceAutoBattler/src/webglRenderer.js','utf8');
let state='normal';
let stack=[];
for(let i=0;i<s.length;i++){
  const ch=s[i];
  const prev=s[i-1];
  if(state==='normal'){
    if(ch==='"') state='dq';
    else if(ch==="'") state='sq';
    else if(ch==='`') state='tpl';
    else if(ch==='/' && s[i+1]==='*') { state='ccomment'; i++; }
    else if(ch==='/' && s[i+1]==='/') { state='linecomment'; i++; }
    else if(ch==='{') stack.push({pos:i});
    else if(ch==='}'){
      const last=stack.pop();
      if(!last){ console.log('unmatched } at',i); break; }
      last.matchPos=i;
    }
  } else if(state==='dq'){
    if(ch==='"' && prev!=='\\') state='normal';
  } else if(state==='sq'){
    if(ch==="'" && prev!=='\\') state='normal';
  } else if(state==='tpl'){
    if(ch==='`' && prev!=='\\') state='normal';
    if(ch==='\\' && s[i+1]==='`') i++; // skip escaped backtick
    if(ch==='\$' && s[i+1]==='{'){
      stack.push({pos:i+1, inTemplateExpr:true});
      i++; // skip '{'
    }
  } else if(state==='ccomment'){
    if(ch==='*' && s[i+1]==='/'){ state='normal'; i++; }
  } else if(state==='linecomment'){
    if(ch==='\n') state='normal';
  }
}
if(stack.length>0){
  console.log('stack not empty count',stack.length);
  const last=stack[stack.length-1];
  console.log('last unmatched at pos', last.pos, 'around line', s.slice(0,last.pos).split('\n').length);
  let ctx=s.slice(Math.max(0,last.pos-120), Math.min(s.length, last.pos+120));
  console.log('context:\n',ctx);
} else {
  console.log('all braces matched');
}
