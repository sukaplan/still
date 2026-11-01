import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const outputDirectory = path.join(projectRoot, 'dist');
const readText = (filename) => readFile(path.join(projectRoot, filename), 'utf8');

async function bundle(entryPoint, options = {}) {
  const result = await build({
    absWorkingDir: projectRoot,
    entryPoints: [entryPoint],
    bundle: true,
    write: false,
    minify: true,
    charset: 'utf8',
    target: ['es2022', 'safari16.4'],
    ...options,
  });
  return result.outputFiles[0].text;
}

async function readHostingManifest() {
  try {
    return await readText('.openai/hosting.json');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    // A clone from GitHub can build and run without an account-specific Sites ID.
    return '{}\n';
  }
}

async function readImageAssets() {
  const contentTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
  };
  const assets = {};

  for (const filename of await readdir(path.join(projectRoot, 'assets'))) {
    const contentType = contentTypes[path.extname(filename).toLowerCase()];
    if (!contentType) continue;
    const bytes = await readFile(path.join(projectRoot, 'assets', filename));
    assets[`/assets/${filename}`] = { type: contentType, data: bytes.toString('base64') };
  }
  return assets;
}

const [javascript, css, astronomyEngine, template, manifest, images] = await Promise.all([
  bundle('src/app.js', { platform: 'browser', format: 'esm' }),
  bundle('src/style.css'),
  readText('vendor/astronomy.browser.min.js'),
  readText('src/index.html'),
  readHostingManifest(),
  readImageAssets(),
]);

const version = createHash('sha256')
  .update(javascript + css + astronomyEngine)
  .digest('hex')
  .slice(0, 12);
const html = template
  .replace('/app.js', `/app.js?v=${version}`)
  .replace('/style.css', `/style.css?v=${version}`)
  .replace('/astronomy.js', `/astronomy.js?v=${version}`);
const favicon =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="15" fill="#e2e7d6"/><text x="16" y="47" font-family="Georgia" font-size="46" fill="#586a49">S</text></svg>';
const resources = {
  '/': { type: 'text/html; charset=utf-8', body: html },
  '/style.css': { type: 'text/css; charset=utf-8', body: css },
  '/app.js': { type: 'application/javascript; charset=utf-8', body: javascript },
  '/astronomy.js': { type: 'application/javascript; charset=utf-8', body: astronomyEngine },
  '/favicon.svg': { type: 'image/svg+xml', body: favicon },
};

// The deployed Worker is self-contained: source modules stay readable, while
// browser bundles and image bytes are embedded only in the generated artifact.
const worker = await build({
  absWorkingDir: projectRoot,
  stdin: {
    contents: `import { createWorker } from './src/worker.mjs';\nexport default createWorker(${JSON.stringify(resources)}, ${JSON.stringify(images)});`,
    resolveDir: projectRoot,
    sourcefile: 'generated-worker-entry.mjs',
  },
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  charset: 'utf8',
});

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(path.join(outputDirectory, 'server'), { recursive: true });
await mkdir(path.join(outputDirectory, '.openai'), { recursive: true });
await writeFile(path.join(outputDirectory, 'server/index.js'), worker.outputFiles[0].text);
await writeFile(path.join(outputDirectory, '.openai/hosting.json'), manifest);
console.log(
  `Built Still: ${Math.round(worker.outputFiles[0].contents.length / 1024)} KB Worker, ${Object.keys(images).length} embedded images.`,
);
