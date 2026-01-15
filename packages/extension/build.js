/**
 * Build script for the browser extension
 * 
 * Bundles TypeScript files using esbuild and copies static assets
 */

import * as esbuild from 'esbuild'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const isWatch = process.argv.includes('--watch')

// ============================================================================
// Configuration
// ============================================================================

const buildConfig = {
  bundle: true,
  format: 'esm',
  target: 'es2020',
  platform: 'browser',
  sourcemap: true,
  minify: !isWatch,
  logLevel: 'info',
}

// ============================================================================
// Clean dist directory
// ============================================================================

const distDir = path.join(__dirname, 'dist')
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true })
}
fs.mkdirSync(distDir, { recursive: true })

// ============================================================================
// Build background service worker
// ============================================================================

await esbuild.build({
  ...buildConfig,
  entryPoints: ['src/background/service-worker.ts'],
  outfile: 'dist/background.js',
})

// ============================================================================
// Build popup
// ============================================================================

await esbuild.build({
  ...buildConfig,
  entryPoints: ['src/popup/popup.ts'],
  outfile: 'dist/popup.js',
})

// ============================================================================
// Build content script
// ============================================================================

await esbuild.build({
  ...buildConfig,
  entryPoints: ['src/content/content-script.ts'],
  outfile: 'dist/content.js',
})

// ============================================================================
// Copy static files
// ============================================================================

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true })
  const entries = fs.readdirSync(src, { withFileTypes: true })
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)
    
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath)
    } else {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

// Copy public directory
copyDir(path.join(__dirname, 'public'), distDir)

console.log('✓ Build complete!')
console.log('→ Extension files are in ./dist')
console.log('→ Load the extension in Chrome from chrome://extensions/')

// ============================================================================
// Watch mode
// ============================================================================

if (isWatch) {
  console.log('\n👀 Watching for changes...\n')
  
  const contexts = await Promise.all([
    esbuild.context({
      ...buildConfig,
      entryPoints: ['src/background/service-worker.ts'],
      outfile: 'dist/background.js',
    }),
    esbuild.context({
      ...buildConfig,
      entryPoints: ['src/popup/popup.ts'],
      outfile: 'dist/popup.js',
    }),
    esbuild.context({
      ...buildConfig,
      entryPoints: ['src/content/content-script.ts'],
      outfile: 'dist/content.js',
    }),
  ])
  
  await Promise.all(contexts.map(ctx => ctx.watch()))
}
