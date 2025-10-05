import esbuild from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import path from 'path';

const pkg = JSON.parse(readFileSync('./package.json'));
const isProd = process.argv.includes('production');

const buildOptions = {
  entryPoints: ['src/main.ts'],
  bundle: true,
  format: 'cjs',
  platform: 'node', // Keep as node since Obsidian plugins run in a Node-like environment
  outfile: 'main.js',
  external: ['obsidian'], // Explicitly mark obsidian as external
  treeShaking: true, // Explicitly enable tree shaking
  minify: isProd, // Keep existing logic for minification based on isProd
  sourcemap: isProd ? false : 'inline', // Use inline sourcemaps for dev, none for prod
  metafile: isProd, // Generate metafile only for production builds for analysis
};

async function runBuild() {
  if (isProd) {
    console.log('Running production build...');
    const result = await esbuild.build(buildOptions);
    console.log('Production build complete.');
    if (result.metafile) {
      // Write metafile to root directory instead of dist
      const metaPath = 'meta.json';
      try {
        writeFileSync(metaPath, JSON.stringify(result.metafile));
        console.log(`Metafile written to ${metaPath}`);
      } catch (err) {
        console.error('Error writing metafile:', err);
      }
    }
  } else {
    const ctx = await esbuild.context(buildOptions);
    await ctx.watch();
    console.log('Watching for changes...');
  }
}

runBuild().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
