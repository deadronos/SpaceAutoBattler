#!/usr/bin/env node

// Simple script to test GLTF loading behavior by checking the server response
const http = require('http');
const url = require('url');

const serverUrl = 'http://localhost:8081';

console.log('Testing server at:', serverUrl);
console.log('Checking if main HTML loads...');

const req = http.get(serverUrl + '/spaceautobattler.html', (res) => {
  console.log('Status Code:', res.statusCode);
  console.log('Headers:', res.headers['content-type']);
  
  let body = '';
  res.on('data', (chunk) => {
    body += chunk;
  });
  
  res.on('end', () => {
    console.log('HTML Response length:', body.length);
    if (body.includes('canvas')) {
      console.log('✓ HTML contains canvas element');
    }
    if (body.includes('main.')) {
      console.log('✓ HTML includes main JS file');
    }
    
    // Test if GLTF files are accessible
    console.log('\nTesting GLTF file accessibility...');
    testGltfFile('/src/config/assets/gltf/fighter.glb');
  });
});

req.on('error', (err) => {
  console.error('Error:', err.message);
});

function testGltfFile(gltfPath) {
  const req = http.get(serverUrl + gltfPath, (res) => {
    console.log(`GLTF ${gltfPath}: Status ${res.statusCode}, Content-Type: ${res.headers['content-type']}, Length: ${res.headers['content-length']}`);
    
    if (res.statusCode === 200) {
      console.log('✓ GLTF file is accessible');
    } else {
      console.log('✗ GLTF file not accessible');
    }
  });
  
  req.on('error', (err) => {
    console.error(`Error accessing ${gltfPath}:`, err.message);
  });
}