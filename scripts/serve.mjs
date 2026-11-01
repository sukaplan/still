import http from 'node:http';
import { stat } from 'node:fs/promises';

const host = '127.0.0.1';
const port = Number(process.env.PORT || 4174);
const workerFile = new URL('../dist/server/index.js', import.meta.url);
const responseCache = new Map();
let loadedVersion;

// Emulate the optional Worker cache during local development.
globalThis.caches = {
  default: {
    async match(request) {
      return responseCache.get(request.url)?.clone();
    },
    async put(request, response) {
      responseCache.set(request.url, response.clone());
    },
  },
};

const server = http.createServer(async (incoming, outgoing) => {
  try {
    const version = (await stat(workerFile)).mtimeMs;
    if (version !== loadedVersion) {
      responseCache.clear();
      loadedVersion = version;
    }
    const { default: worker } = await import(`${workerFile.href}?v=${version}`);
    const request = new Request(`http://${host}:${port}${incoming.url}`, {
      method: incoming.method,
    });
    const response = await worker.fetch(
      request,
      {},
      {
        waitUntil: (promise) => promise.catch(console.error),
      },
    );
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    console.error(error);
    outgoing.writeHead(500);
    outgoing.end('Server error');
  }
});

server.listen(port, host, () => console.log(`Local: http://${host}:${port}`));
process.on('SIGTERM', () => server.close());
