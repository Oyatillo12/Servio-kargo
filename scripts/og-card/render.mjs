/* Renders og.html at exactly 1200x630 into apps/web/public/og.png (D-013).
 *
 * Headless Chrome over raw CDP — Node 22's global WebSocket, no dependencies.
 * Needs `pnpm dev` running (og.html loads the favicon from localhost:3000)
 * and internet for the Google-hosted TERMINAL faces.
 *
 * Run from the repo root: node scripts/og-card/render.mjs */
import { spawn } from 'node:child_process';
import { rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9345;
const profile = join(tmpdir(), 'kt-og-profile');
rmSync(profile, { recursive: true, force: true });

const proc = spawn(CHROME, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`,
  '--no-first-run',
  '--hide-scrollbars',
  'about:blank',
]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let targets = null;
for (let i = 0; i < 50; i++) {
  await sleep(200);
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
    targets = await res.json();
    if (targets.some((t) => t.type === 'page')) break;
  } catch {}
}
const page = targets.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => ((ws.onopen = res), (ws.onerror = rej)));
let id = 0;
const pending = new Map();
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m.result ?? m.error);
    pending.delete(m.id);
  }
};
const cdp = (method, params = {}) =>
  new Promise((res) => {
    pending.set(++id, res);
    ws.send(JSON.stringify({ id, method, params }));
  });

await cdp('Page.enable');
await cdp('Emulation.setDeviceMetricsOverride', {
  width: 1200,
  height: 630,
  deviceScaleFactor: 1,
  mobile: false,
});
await cdp('Page.navigate', {
  url: pathToFileURL(resolve(here, 'og.html')).href,
});
await sleep(3500); // fonts from Google + the favicon from localhost
const shot = await cdp('Page.captureScreenshot', { format: 'png' });
const out = resolve(here, '../../apps/web/public/og.png');
writeFileSync(out, Buffer.from(shot.data, 'base64'));
console.log('saved', out);
ws.close();
proc.kill();
