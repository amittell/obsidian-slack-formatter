#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

// Read the file
const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: node replace-console-log.js <file-path>');
  process.exit(1);
}

const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

// Track if we've imported Logger
let hasLoggerImport = false;
let lastImportLine = -1;
let className = 'UnknownClass';

// Extract class name from file path
const fileName = path.basename(filePath, '.ts');
className = fileName.split('-').map(word => 
  word.charAt(0).toUpperCase() + word.slice(1)
).join('');

// Process each line
const newLines = lines.map((line, index) => {
  // Check for Logger import
  if (line.includes('import') && line.includes('Logger')) {
    hasLoggerImport = true;
  }
  
  // Track last import line
  if (line.startsWith('import ')) {
    lastImportLine = index;
  }
  
  // Check for class name
  const classMatch = line.match(/export\s+class\s+(\w+)/);
  if (classMatch) {
    className = classMatch[1];
  }
  
  // Replace console.log
  if (line.includes('console.log(')) {
    // Extract the console.log content
    const match = line.match(/console\.log\((.*)\);?$/);
    if (match) {
      const content = match[1];
      const indent = line.match(/^\s*/)[0];
      
      // Check if it's a simple string or has multiple arguments
      if (content.startsWith("'") || content.startsWith('"')) {
        // Simple string log
        return `${indent}Logger.debug('${className}', ${content});`;
      } else if (content.includes(',')) {
        // Multiple arguments - treat first as message, rest as data
        const parts = content.split(',').map(p => p.trim());
        const message = parts[0];
        const data = parts.slice(1).join(', ');
        
        // If message is a variable, use it as-is
        if (message.startsWith("'") || message.startsWith('"')) {
          return `${indent}Logger.debug('${className}', ${message}, { data: ${data} });`;
        } else {
          return `${indent}Logger.debug('${className}', 'Debug log', { message: ${message}, data: ${data} });`;
        }
      } else {
        // Single variable or expression
        return `${indent}Logger.debug('${className}', 'Debug log', ${content});`;
      }
    }
  }
  
  return line;
});

// Add Logger import if needed and not already present
if (!hasLoggerImport && newLines.some(line => line.includes('Logger.debug'))) {
  const importLine = "import { Logger } from '../../utils/logger.js';";
  if (lastImportLine >= 0) {
    newLines.splice(lastImportLine + 1, 0, importLine);
  } else {
    newLines.unshift(importLine);
  }
}

// Write the file back
fs.writeFileSync(filePath, newLines.join('\n'));
console.log(`Processed ${filePath}`);