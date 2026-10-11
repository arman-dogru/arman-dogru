// Publish an explicit public surface, never the repository, dependencies or secrets.
import {cp, mkdir, readdir, rm, stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve, join} from 'node:path';

export const PUBLIC_FILES = [
  'index.html', 'terminal-v2.js', 'terminal-v2.css', 'terminal-v3.css',
  'terminal-data.js', 'terminal-map.js', 'terminal-race-v5.js', 'race-engine-v5.js', 'race-sim.js',
  'race-track-istanbul.json', 'neat-champions-v5.json', 'leaderboard-client.js',
  'terminal-ai-v2.js', 'chat-markdown.js', 'chat-version.js', 'portfolio-context.json'
];
const ROOT = fileURLToPath(new URL('../', import.meta.url));

export async function buildSite(root = ROOT) {
  // Fixed, generated target. No caller-supplied output path or broad cleanup.
  const out = join(root, 'dist');
  await rm(out, {recursive: true, force: true});
  await mkdir(out, {recursive: true});
  for (const file of PUBLIC_FILES) await cp(join(root, file), join(out, file), {dereference: false});
  await cp(join(root, 'assets'), join(out, 'assets'), {recursive: true, dereference: false});
  let count = 0;
  async function inspect(dir) {
    for (const entry of await readdir(dir, {withFileTypes: true})) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) await inspect(path);
      else {
        if (!entry.isFile() || (await stat(path)).size > 25 * 1024 * 1024) throw new Error(`Not a publishable asset: ${path}`);
        count++;
      }
    }
  }
  await inspect(out);
  return {out, count};
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const {count} = await buildSite();
  console.log(`Prepared ${count} public assets in dist/`);
}
