import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, readdir, readFile, rm, symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {buildSite, PUBLIC_FILES} from '../scripts/build-site.mjs';

test('site deployment includes only public assets, not dependencies, secrets or worker code',async()=>{
  const root=await mkdtemp(join(tmpdir(),'portfolio-build-test-'));
  try {
    for(const file of PUBLIC_FILES)await writeFile(join(root,file),file);
    await mkdir(join(root,'assets'));await writeFile(join(root,'assets','portrait.svg'),'<svg/>');
    for(const dir of ['node_modules','grok-relay','work','.git']){await mkdir(join(root,dir));await writeFile(join(root,dir,'private'),'must not publish')}
    await writeFile(join(root,'.env'),'must not publish');
    const {out,count}=await buildSite(root);
    assert.equal(count,PUBLIC_FILES.length+1);
    assert.deepEqual((await readdir(out)).sort(),[...PUBLIC_FILES,'assets'].sort());
    assert.equal(await readFile(join(out,'terminal-ai-v2.js'),'utf8'),'terminal-ai-v2.js');
  } finally {await rm(root,{recursive:true,force:true})}
});

test('symlinked assets fail the release gate',async()=>{
  const root=await mkdtemp(join(tmpdir(),'portfolio-build-link-test-'));
  try {
    for(const file of PUBLIC_FILES)await writeFile(join(root,file),file);
    await mkdir(join(root,'assets'));await symlink(join(root,'index.html'),join(root,'assets','unexpected.html'));
    await assert.rejects(buildSite(root),/Not a publishable asset/);
  } finally {await rm(root,{recursive:true,force:true})}
});
