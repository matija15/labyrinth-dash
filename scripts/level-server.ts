/**
 * Dev-only level server for the in-game editor: saves levels straight into src/levels/release/.
 * Usage: npm run levels  (port 8790, or LEVEL_SERVER_PORT). Reachable from Expo Go on the same Wi-Fi.
 */
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { RELEASE_DIR, StoreError, deleteLevel, listLevels, reorder, saveLevel } from './level-store';

const PORT = Number(process.env.LEVEL_SERVER_PORT ?? 8790);
const DIR = process.argv[2] ? path.resolve(process.argv[2]) : RELEASE_DIR;

function readBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (c) => {
      raw += c;
      if (raw.length > 8e6) reject(new StoreError(413, 'Level too large'));
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new StoreError(400, 'Invalid JSON'));
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  const send = (status: number, data: unknown) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  };
  try {
    const url = new URL(req.url ?? '/', 'http://x');
    const m = /^\/levels\/([^/]+)$/.exec(url.pathname);
    if (req.method === 'OPTIONS') return void res.writeHead(204).end();
    if (req.method === 'GET' && url.pathname === '/levels') return send(200, { levels: listLevels(DIR) });
    if (req.method === 'PUT' && m) {
      const body = await readBody(req);
      if (body.level?.id !== decodeURIComponent(m[1])) throw new StoreError(400, 'Level id does not match the URL');
      const result = saveLevel(DIR, body.level, body.previousId);
      console.log(`saved ${body.level.id}.json (#${result.position})`);
      return send(200, result);
    }
    if (req.method === 'DELETE' && m) {
      deleteLevel(DIR, decodeURIComponent(m[1]));
      console.log(`deleted ${m[1]}.json`);
      return send(200, { ok: true });
    }
    if (req.method === 'PUT' && url.pathname === '/order') {
      reorder(DIR, (await readBody(req)).ids);
      return send(200, { ok: true });
    }
    send(404, { error: 'Not found' });
  } catch (e) {
    send(e instanceof StoreError ? e.status : 500, { error: (e as Error).message });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  const ips = Object.values(os.networkInterfaces()).flat().filter((a) => a && a.family === 'IPv4' && !a.internal);
  console.log(`Level server: saving to ${path.relative(process.cwd(), DIR) || DIR}`);
  for (const a of [{ address: 'localhost' }, ...ips]) console.log(`  http://${a!.address}:${PORT}`);
});
