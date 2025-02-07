import esbuild from 'esbuild';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('./package.json'));
const isProd = process.argv.includes('production');

const buildOptions = {
  entryPoints: ['src/main.ts'],
  bundle: true,
  format: 'cjs',
  platform: 'node',
  outfile: 'main.js',
  external: Object.keys(pkg.dependencies),
  minify: isProd,
  sourcemap: !isProd
};

async function runBuild() {
  if (isProd) {
    await esbuild.build(buildOptions);
  } else {
    const ctx = await esbuild.context(buildOptions);
    await ctx.watch();
    console.log('Watching for changes...');
  }
}

runBuild().catch(() => process.exit(1));
