import { readFileSync } from 'fs';

const html = readFileSync('dist/spaceautobattler.html', 'utf8');
console.log('Original HTML length:', html.length);

const scriptTag = '<script type="module" src="./bundled.js"></script>';
console.log('Contains script tag:', html.includes(scriptTag));

const index = html.indexOf(scriptTag);
console.log('Script tag position:', index);

if (index !== -1) {
  console.log('Content around script tag:');
  console.log(html.substring(index - 20, index + scriptTag.length + 20));
}

// Test the regex from build-standalone.mjs
const scriptRegex = /<script[^>]+src=["'][^"']+["'][^>]*><\/script>/i;
const match = html.match(scriptRegex);
console.log('Regex match:', match ? match[0] : 'null');

// Test replacement
const inlineScript = 'console.log("test");';
const replacement = `<script type="module">${inlineScript}</script>`;
const newHtml = html.replace(scriptRegex, replacement);
console.log('Replacement successful:', newHtml !== html);
console.log('New HTML length:', newHtml.length);