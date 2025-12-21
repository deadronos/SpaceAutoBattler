#!/usr/bin/env node
/**
 * Verify compression headers on deployed GitHub Pages site
 * 
 * Usage: node scripts/verify-compression.mjs [url]
 * 
 * If no URL is provided, uses the default GitHub Pages URL for this repo.
 */

import https from 'https';
import http from 'http';

const DEFAULT_URL = 'https://deadronos.github.io/SpaceAutoBattler/';

async function checkCompression(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    
    const options = {
      headers: {
        'Accept-Encoding': 'gzip, deflate, br',
        'User-Agent': 'Mozilla/5.0 (compression verification script)'
      }
    };

    client.get(url, options, (res) => {
      const contentEncoding = res.headers['content-encoding'];
      const contentType = res.headers['content-type'];
      const contentLength = res.headers['content-length'];
      
      resolve({
        url,
        statusCode: res.statusCode,
        contentEncoding,
        contentType,
        contentLength: contentLength ? parseInt(contentLength) : null
      });
      
      // Consume response to free up memory
      res.resume();
    }).on('error', reject);
  });
}

async function main() {
  const baseUrl = process.argv[2] || DEFAULT_URL;
  
  console.log('=== GitHub Pages Compression Verification ===\n');
  console.log(`Testing: ${baseUrl}\n`);

  try {
    // Test the main HTML page
    const htmlResult = await checkCompression(baseUrl);
    console.log('HTML Page:');
    console.log(`  Status: ${htmlResult.statusCode}`);
    console.log(`  Content-Encoding: ${htmlResult.contentEncoding || 'none (not compressed)'}`);
    console.log(`  Content-Type: ${htmlResult.contentType}`);
    console.log('');

    // Try to fetch and check a JS file (we need to know the hash from a real deployment)
    console.log('To verify JavaScript bundle compression:');
    console.log('  1. Visit the deployed site');
    console.log('  2. Open DevTools > Network tab');
    console.log('  3. Look for main.[hash].js or vendors.[hash].js');
    console.log('  4. Check Response Headers for "content-encoding"');
    console.log('  5. Verify it shows "br" (brotli) or "gzip"');
    console.log('');
    
    if (htmlResult.contentEncoding && (htmlResult.contentEncoding.includes('gzip') || htmlResult.contentEncoding.includes('br'))) {
      console.log('✅ Compression is enabled!');
      console.log(`   Detected encoding: ${htmlResult.contentEncoding}`);
    } else {
      console.log('⚠️  Compression not detected in response headers');
      console.log('   This might be normal for the HTML page');
      console.log('   Check JavaScript bundles for compression');
    }
    
  } catch (error) {
    console.error('Error checking compression:', error.message);
    console.log('\nNote: The site might not be deployed yet.');
    console.log('Run this script after deploying to GitHub Pages.');
    process.exit(1);
  }
}

main();
