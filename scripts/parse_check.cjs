const fs = require('fs');
const vm = require('vm');
const s = fs.readFileSync('d:/GitHub/SpaceAutoBattler/src/webglRenderer.js','utf8');
try{
  new vm.Script(s, {filename: 'webglRenderer.js'});
  console.log('compiled OK');
}catch(e){
  console.error('Syntax error:', e.message);
  console.error(e.stack);
}
