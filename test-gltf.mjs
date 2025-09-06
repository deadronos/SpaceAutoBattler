#!/usr/bin/env node

// Simple script to inspect GLTF file structure using Node.js and file system
import fs from 'fs';
import path from 'path';

const gltfPath = './src/config/assets/gltf/fighter.glb';
const absolutePath = path.resolve(gltfPath);

console.log('Testing GLTF file structure...');
console.log('Path:', absolutePath);

if (fs.existsSync(absolutePath)) {
  const stats = fs.statSync(absolutePath);
  console.log('File size:', stats.size, 'bytes');
  console.log('File exists and is accessible');
  
  // Read the first few bytes to check if it's a valid GLTF binary
  const buffer = fs.readFileSync(absolutePath);
  const header = buffer.slice(0, 12);
  
  console.log('Header bytes:', header);
  console.log('Magic bytes:', header.slice(0, 4).toString());
  
  if (header.slice(0, 4).toString() === 'glTF') {
    console.log('✓ Valid GLTF binary file');
    
    // Extract version
    const version = buffer.readUInt32LE(4);
    const length = buffer.readUInt32LE(8);
    
    console.log('GLTF version:', version);
    console.log('Total length:', length);
    
  } else {
    console.log('✗ Not a valid GLTF binary file');
  }
} else {
  console.log('✗ File does not exist at:', absolutePath);
}

console.log('\nListing all GLTF files...');
const gltfDir = './src/config/assets/gltf/';
if (fs.existsSync(gltfDir)) {
  const files = fs.readdirSync(gltfDir).filter(file => file.endsWith('.glb'));
  console.log('Found GLTF files:', files);
  
  files.forEach(file => {
    const filePath = path.join(gltfDir, file);
    const stats = fs.statSync(filePath);
    console.log(`  ${file}: ${Math.round(stats.size / 1024)}KB`);
  });
} else {
  console.log('GLTF directory does not exist');
}