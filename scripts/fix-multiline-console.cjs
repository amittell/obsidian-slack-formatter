#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

// Read the file
const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: node fix-multiline-console.cjs <file-path>');
  process.exit(1);
}

const content = fs.readFileSync(filePath, 'utf8');

// Extract class name from file path
const fileName = path.basename(filePath, '.ts');
const className = 'IntelligentMessageParser';

// Replace multi-line console.log statements
let result = content;

// Pattern to match console.log with multiline content
const multilinePattern = /console\.log\s*\(\s*([^)]*\n[^)]*)\)/gm;

result = result.replace(multilinePattern, (match, args) => {
  // Clean up the arguments - remove newlines and extra spaces
  const cleanArgs = args.replace(/\s*\n\s*/g, ' ').trim();
  
  // Check if it's a template literal
  if (cleanArgs.startsWith('`')) {
    return `Logger.debug('${className}', ${cleanArgs});`;
  } else {
    // Handle other cases
    return `Logger.debug('${className}', 'Debug log', ${cleanArgs});`;
  }
});

// Also handle single-line console.log that might remain
result = result.replace(/console\.log\s*\(([^)]+)\);?/g, (match, args) => {
  const cleanArgs = args.trim();
  
  if (cleanArgs.startsWith('`') || cleanArgs.startsWith('"') || cleanArgs.startsWith("'")) {
    return `Logger.debug('${className}', ${cleanArgs});`;
  } else {
    return `Logger.debug('${className}', 'Debug log', ${cleanArgs});`;
  }
});

// Write the file back
fs.writeFileSync(filePath, result);
console.log(`Processed ${filePath}`);