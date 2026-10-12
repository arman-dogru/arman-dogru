import test from 'node:test';
import assert from 'node:assert/strict';
import {access, readFile} from 'node:fs/promises';
import {PROFILE, PROJECTS, RESEARCH} from '../terminal-data.js';

const root = new URL('../', import.meta.url);

test('README hero is a self-contained, accessible ArmanOS animation with reduced-motion support', async () => {
  const svg = await readFile(new URL('assets/hero.svg', root), 'utf8');
  assert.match(svg, /<svg[^>]+viewBox="0 0 \d+ \d+"[^>]+role="img"/);
  assert.match(svg, /<title[^>]+>[^<]*ArmanOS/);
  assert.match(svg, /<desc[^>]+>[^<]+<\/desc>/);
  assert.match(svg, /@keyframes\s+\w+/);
  assert.match(svg, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.match(svg, /animation:\s*none/);
  assert.doesNotMatch(svg, /Istanbul|NEAT_GP|<script\b|<foreignObject\b|@import|(?:href|src)\s*=/i);

  const ids = [...svg.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length, 'SVG IDs must be unique');
  for (const reference of svg.matchAll(/url\(([^)]+)\)/g)) {
    assert.ok(reference[1].startsWith('#'), 'No external SVG dependencies');
    assert.ok(ids.includes(reference[1].slice(1)), 'Paint reference must resolve');
  }
  const label = svg.match(/aria-labelledby="([^"]+)"/);
  assert.ok(label);
  for (const id of label[1].split(/\s+/)) assert.ok(ids.includes(id));
});

test('concise README keeps established profiles, projects, publications and local links', async () => {
  const readme = await readFile(new URL('README.md', root), 'utf8');
  for (const url of [PROFILE.linkedin, PROFILE.scholar, ...PROJECTS.map(project => project.url)]) {
    assert.ok(readme.includes(url), `Missing established link: ${url}`);
  }
  for (const paper of RESEARCH) assert.ok(readme.includes(paper.title));
  assert.match(readme, /Morpheus/);
  assert.match(readme, /Istanbul Park/);
  assert.match(readme, /assets\/hero\.svg[^>]+width="100%"[^>]+alt="[^"]+"/);
  for (const link of readme.matchAll(/\]\((\.\/[^)]+)\)|(?:src|href)="(\.\/[^\"]+)"/g)) {
    await access(new URL(link[1] || link[2], root));
  }
});
