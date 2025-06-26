#!/usr/bin/env node
/**
 * Script to clean up console.log statements in test files
 * Replaces them with conditional TestLogger.log calls
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function findTestFiles() {
    try {
        const output = execSync('find tests -name "*.test.ts" -exec grep -l "console\\.log" {} \\;', { 
            encoding: 'utf-8',
            cwd: process.cwd()
        });
        return output.trim().split('\n').filter(file => file.length > 0);
    } catch (error) {
        console.log('No test files with console.log found');
        return [];
    }
}

function processTestFile(filePath) {
    console.log(`Processing: ${filePath}`);
    
    let content = fs.readFileSync(filePath, 'utf-8');
    let modified = false;
    
    // Add TestLogger import if not present
    if (!content.includes('TestLogger')) {
        // Find the last import statement
        const importRegex = /import.*from.*['"];/g;
        const imports = content.match(importRegex);
        
        if (imports && imports.length > 0) {
            const lastImport = imports[imports.length - 1];
            const importIndex = content.lastIndexOf(lastImport);
            const insertIndex = importIndex + lastImport.length;
            
            content = content.slice(0, insertIndex) + 
                     '\nimport { TestLogger } from \'../helpers\';' + 
                     content.slice(insertIndex);
            modified = true;
        }
    }
    
    // Replace console.log with TestLogger.log
    const originalConsoleCount = (content.match(/console\.log\(/g) || []).length;
    content = content.replace(/console\.log\(/g, 'TestLogger.log(');
    const newConsoleCount = (content.match(/console\.log\(/g) || []).length;
    
    if (originalConsoleCount > newConsoleCount) {
        modified = true;
        console.log(`  - Replaced ${originalConsoleCount - newConsoleCount} console.log statements`);
    }
    
    // Replace console.error and console.warn if they exist
    content = content.replace(/console\.error\(/g, 'TestLogger.error(');
    content = content.replace(/console\.warn\(/g, 'TestLogger.warn(');
    
    if (modified) {
        fs.writeFileSync(filePath, content, 'utf-8');
        console.log(`  ✓ Updated ${filePath}`);
        return true;
    }
    
    return false;
}

function main() {
    console.log('🧹 Cleaning up console.log statements in test files...\n');
    
    const testFiles = findTestFiles();
    
    if (testFiles.length === 0) {
        console.log('✅ No test files with console.log statements found');
        return;
    }
    
    console.log(`Found ${testFiles.length} test files with console.log statements\n`);
    
    let processedCount = 0;
    
    for (const file of testFiles) {
        if (processTestFile(file)) {
            processedCount++;
        }
    }
    
    console.log(`\n✅ Processed ${processedCount} test files`);
    console.log('✅ All console.log statements have been replaced with TestLogger.log');
    console.log('\n💡 To enable test logging, set TEST_DEBUG=true in your environment');
}

if (require.main === module) {
    main();
}

module.exports = { processTestFile, findTestFiles };