#!/usr/bin/env node
import { analyzeMetafile } from 'esbuild';
import { readFileSync, promises as fs, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const metafilePath = join(rootDir, 'meta.json');

async function analyzeBundle() {
    console.log('🔍 Analyzing build...\n');
    
    try {
        // First, show basic bundle info
        const mainPath = join(rootDir, 'main.js');
        if (existsSync(mainPath)) {
            const stats = await fs.stat(mainPath);
            const sizeKB = (stats.size / 1024).toFixed(2);
            const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
            
            console.log(`📦 Bundle Size: ${sizeKB} KB (${sizeMB} MB)`);
            console.log(`📍 Location: ${mainPath}\n`);
        }
        
        // Show dependencies
        console.log('📚 Dependencies:');
        const packageJson = JSON.parse(await fs.readFile(join(rootDir, 'package.json'), 'utf-8'));
        
        if (packageJson.dependencies) {
            console.log('\n  Production:');
            for (const [name, version] of Object.entries(packageJson.dependencies)) {
                console.log(`    - ${name}: ${version}`);
            }
        }
        
        if (packageJson.devDependencies) {
            console.log('\n  Development:');
            for (const [name, version] of Object.entries(packageJson.devDependencies)) {
                console.log(`    - ${name}: ${version}`);
            }
        }
        
        // Check if metafile exists, if not, run build to generate it
        if (!existsSync(metafilePath)) {
            console.log('\n🔧 Running build to generate metafile...\n');
            await execAsync('node esbuild.config.mjs production --metafile=meta.json', { cwd: rootDir });
        }
        
        // Use esbuild's analyzeMetafile for detailed analysis
        try {
            const metafileContent = readFileSync(metafilePath, 'utf-8');
            const metafile = JSON.parse(metafileContent);
            
            console.log('\n--- esbuild Bundle Analysis ---');
            
            // Perform the analysis
            const analysis = await analyzeMetafile(metafile, {
                verbose: true,
                color: true,
            });
            
            console.log(analysis);
            console.log('--- End of Analysis ---\n');
            
            // Also show top 10 largest source files
            const inputs = Object.entries(metafile.inputs)
                .map(([path, info]) => ({
                    path,
                    bytes: info.bytes,
                    imports: info.imports.length
                }))
                .sort((a, b) => b.bytes - a.bytes)
                .slice(0, 10);
            
            console.log('📊 Top 10 Largest Source Files:');
            for (const input of inputs) {
                const sizeKB = (input.bytes / 1024).toFixed(2);
                console.log(`  ${input.path}: ${sizeKB} KB (${input.imports} imports)`);
            }
            
            console.log('\n💡 Review the analysis above for potential optimization opportunities.');
            console.log('   Consider factors like large dependencies, duplicated code, or opportunities for code splitting.');
            
            // Cleanup metafile if we generated it
            await fs.unlink(metafilePath).catch(() => {});
            
            console.log('\n✅ Analysis complete!');
        } catch (error) {
            if (error.code === 'ENOENT') {
                console.error(`❌ Error: Metafile not found at ${metafilePath}`);
                console.error('   Please run a production build first (e.g., `npm run build`) to generate the metafile.');
            } else {
                console.error('❌ Error reading or parsing metafile:', error);
            }
            process.exit(1);
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.log('\n💡 Tip: Make sure to run "npm run build" first to generate main.js');
        process.exit(1);
    }
}

analyzeBundle();