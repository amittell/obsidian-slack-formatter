#!/usr/bin/env node
/**
 * Documentation Coverage Checker
 * Validates JSDoc documentation completeness and quality
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.join(__dirname, '..', 'src');

/**
 * Documentation statistics
 */
const stats = {
  totalFunctions: 0,
  documentedFunctions: 0,
  totalClasses: 0,
  documentedClasses: 0,
  totalInterfaces: 0,
  documentedInterfaces: 0,
  exampleCount: 0,
  issues: [],
};

/**
 * Check if a function/method has JSDoc documentation
 */
function hasJSDoc(lines, functionLine) {
  // Look backwards for JSDoc comment
  for (let i = functionLine - 1; i >= Math.max(0, functionLine - 5); i--) {
    const line = lines[i].trim();
    if (line === '*/') {
      // Found end of JSDoc, look for start
      for (let j = i; j >= 0; j--) {
        if (lines[j].trim() === '/**') {
          return true;
        }
      }
    }
    if (line && !line.startsWith('*') && !line.startsWith('//')) {
      break; // Non-comment line, stop looking
    }
  }
  return false;
}

/**
 * Analyze TypeScript file for documentation
 */
function analyzeFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const relativePath = path.relative(srcDir, filePath);

  console.log(`Analyzing: ${relativePath}`);

  // Find functions, methods, classes, and interfaces
  lines.forEach((line, index) => {
    const trimmed = line.trim();

    // Skip comments and empty lines
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || !trimmed) {
      return;
    }

    // Check for classes
    if (trimmed.match(/^export\s+(abstract\s+)?class\s+\w+/)) {
      stats.totalClasses++;
      if (hasJSDoc(lines, index)) {
        stats.documentedClasses++;
      } else {
        stats.issues.push(`${relativePath}:${index + 1} - Class missing JSDoc`);
      }
    }

    // Check for interfaces
    if (trimmed.match(/^export\s+interface\s+\w+/)) {
      stats.totalInterfaces++;
      if (hasJSDoc(lines, index)) {
        stats.documentedInterfaces++;
      } else {
        stats.issues.push(`${relativePath}:${index + 1} - Interface missing JSDoc`);
      }
    }

    // Check for functions and methods
    const functionMatch = trimmed.match(
      /^\s*(export\s+)?(public\s+|private\s+|protected\s+)?(static\s+)?(async\s+)?(\w+)\s*\(/
    );
    if (functionMatch && !trimmed.includes('=') && !trimmed.includes('=>')) {
      const functionName = functionMatch[5];

      // Skip constructors, keywords, and common patterns that aren't actual functions
      const skipPatterns = [
        'constructor',
        'if',
        'for',
        'while',
        'switch',
        'return',
        'super',
        'throw',
        'catch',
        'try',
        'new',
        'delete',
        'typeof',
        'instanceof',
        'in',
        'with',
        'debugger',
        'var',
        'let',
        'const',
        'function',
        'class',
        'interface',
        'type',
        'enum',
        'namespace',
        'module',
        'import',
        'export',
        'default',
        'extends',
        'implements',
        'readonly',
        'declare',
      ];

      if (skipPatterns.includes(functionName)) {
        return;
      }

      // Also skip if the line looks like a control structure or statement
      if (trimmed.match(/^\s*(if|for|while|switch|return|super|throw|catch|try)\s*\(/)) {
        return;
      }

      stats.totalFunctions++;
      if (hasJSDoc(lines, index)) {
        stats.documentedFunctions++;
      } else {
        stats.issues.push(
          `${relativePath}:${index + 1} - Function '${functionName}' missing JSDoc`
        );
      }
    }

    // Count @example tags
    if (trimmed.includes('@example')) {
      stats.exampleCount++;
    }
  });
}

/**
 * Recursively find TypeScript files
 */
function findTypeScriptFiles(dir) {
  const files = [];
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      // Skip node_modules, tests, coverage
      if (!['node_modules', 'tests', 'coverage', '.git'].includes(item)) {
        files.push(...findTypeScriptFiles(fullPath));
      }
    } else if (item.endsWith('.ts') && !item.endsWith('.d.ts')) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Main documentation check
 */
function main() {
  console.log('🔍 Checking JSDoc documentation coverage...\n');

  try {
    const tsFiles = findTypeScriptFiles(srcDir);

    if (tsFiles.length === 0) {
      console.log('❌ No TypeScript files found in src directory');
      process.exit(1);
    }

    // Analyze each file
    tsFiles.forEach(analyzeFile);

    // Calculate coverage percentages
    const functionCoverage =
      stats.totalFunctions > 0
        ? ((stats.documentedFunctions / stats.totalFunctions) * 100).toFixed(1)
        : 100;

    const classCoverage =
      stats.totalClasses > 0
        ? ((stats.documentedClasses / stats.totalClasses) * 100).toFixed(1)
        : 100;

    const interfaceCoverage =
      stats.totalInterfaces > 0
        ? ((stats.documentedInterfaces / stats.totalInterfaces) * 100).toFixed(1)
        : 100;

    // Report results
    console.log('\n📊 Documentation Coverage Report:');
    console.log('=====================================');
    console.log(
      `Functions: ${stats.documentedFunctions}/${stats.totalFunctions} (${functionCoverage}%)`
    );
    console.log(`Classes: ${stats.documentedClasses}/${stats.totalClasses} (${classCoverage}%)`);
    console.log(
      `Interfaces: ${stats.documentedInterfaces}/${stats.totalInterfaces} (${interfaceCoverage}%)`
    );
    console.log(`Examples: ${stats.exampleCount}`);

    // Show issues if any
    if (stats.issues.length > 0) {
      console.log('\n⚠️  Documentation Issues:');
      stats.issues.slice(0, 10).forEach(issue => console.log(`  ${issue}`));
      if (stats.issues.length > 10) {
        console.log(`  ... and ${stats.issues.length - 10} more issues`);
      }
    }

    // Check minimum thresholds
    const minFunctionCoverage = 80;
    const minClassCoverage = 90;
    const minInterfaceCoverage = 90;

    let passed = true;

    if (parseFloat(functionCoverage) < minFunctionCoverage) {
      console.log(
        `\n❌ Function documentation coverage too low: ${functionCoverage}% (minimum: ${minFunctionCoverage}%)`
      );
      passed = false;
    }

    if (parseFloat(classCoverage) < minClassCoverage) {
      console.log(
        `\n❌ Class documentation coverage too low: ${classCoverage}% (minimum: ${minClassCoverage}%)`
      );
      passed = false;
    }

    if (parseFloat(interfaceCoverage) < minInterfaceCoverage) {
      console.log(
        `\n❌ Interface documentation coverage too low: ${interfaceCoverage}% (minimum: ${minInterfaceCoverage}%)`
      );
      passed = false;
    }

    if (stats.exampleCount < Math.max(5, stats.totalClasses)) {
      console.log(
        `\n⚠️  Consider adding more @example tags: ${stats.exampleCount} found (recommended: ${Math.max(5, stats.totalClasses)})`
      );
    }

    if (passed) {
      console.log('\n✅ Documentation coverage check passed!');
    } else {
      console.log('\n❌ Documentation coverage check failed!');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error checking documentation:', error.message);
    process.exit(1);
  }
}

// Run the check
main();
