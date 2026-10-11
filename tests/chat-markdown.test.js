import test from 'node:test';
import assert from 'node:assert/strict';
import {renderMarkdown,publicLink} from '../chat-markdown.js';
test('paragraphs, soft wraps, emphasis, lists and escaped punctuation render cleanly',()=>{
  assert.equal(renderMarkdown('Yes. **He builds.**\nAcross boundaries.\n\n- Research\n- Construction\n\n\\~5 years; `x_y`.'),'<p>Yes. <strong>He builds.</strong> Across boundaries.</p><ul><li>Research</li><li>Construction</li></ul><p>~5 years; <code>x_y</code>.</p>');
});
test('code stays literal and HTML cannot execute',()=>{
  assert.equal(renderMarkdown('```js\n<script>alert("x")</script>\n```'),'<pre><code>&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;</code></pre>');
  assert.equal(renderMarkdown('<img src=x onerror=alert(1)>'),'<p>&lt;img src=x onerror=alert(1)&gt;</p>');
});
test('citations are readable safe links, never executable or credential URLs',()=>{
  assert.match(renderMarkdown('See [[1]](https://example.com/job).'),/<a href="https:\/\/example.com\/job" target="_blank" rel="noopener noreferrer">1<\/a>/);
  for(const url of ['javascript:alert(1)','data:text/html,test','//evil.test','https://user:pass@example.com'])assert.equal(publicLink(url),'');
  for(const text of ['[click](javascript:alert(1))','[click](data:text/html,test)','[click](https://user:pass@example.com)','[click](https://example.com/" onmouseover="x)'])assert.doesNotMatch(renderMarkdown(text),/<a /);
});
test('adjacent citations remain two links rather than one corrupted URL',()=>{
  const html=renderMarkdown('Fit.[[1]](https://one.test/job)[[2]](https://two.test/team)');
  assert.equal((html.match(/<a /g)||[]).length,2);assert.match(html,/href="https:\/\/one.test\/job"/);assert.match(html,/href="https:\/\/two.test\/team"/);
});
test('identifiers, headings, quotations, ordered lists and hard breaks remain readable',()=>{
  assert.equal(renderMarkdown('## Choice\n\n> See the system.\n\n3. Look\n4. Build\n\nfoo_bar_baz  \nnext'),'<h2>Choice</h2><blockquote>See the system.</blockquote><ol start="3"><li>Look</li><li>Build</li></ol><p>foo_bar_baz<br>next</p>');
});
test('inline and display equations render as native accessible math, not raw escapes',()=>{
  for(const text of [String.raw`The slope is \(2x\).`,String.raw`\[\frac{d}{dx}x^2=2x\]`,'$$\\frac{1}{2}$$','$x^2$']){
    const html=renderMarkdown(text);assert.match(html,/<math /);assert.doesNotMatch(html,/>\\[([\]]|>\$\$/);
  }
  const html=renderMarkdown(String.raw`\[
\frac{-b \pm \sqrt{b^2-4ac}}{2a}
\]`);assert.match(html,/<mfrac>/);assert.match(html,/class="chat-math display"/);
});
test('math respects code, currency, unsupported syntax, resource bounds and trust boundaries',()=>{
  assert.equal(renderMarkdown('`\\(x\\)` and $5 and $10.'),'<p><code>\\(x\\)</code> and $5 and $10.</p>');
  assert.equal(renderMarkdown('```tex\n\\[x^2\\]\n```'),'<pre><code>\\[x^2\\]</code></pre>');
  for(const text of [String.raw`\(\href{javascript:alert(1)}{x}\)`,String.raw`\(\includegraphics{https://evil.com/a}\)`,String.raw`\(\htmlStyle{color:red}{x}\)`,String.raw`\(\unknown{x}\)`,`\\(${'x'.repeat(2001)}\\)`]){
    const html=renderMarkdown(text);assert.doesNotMatch(html,/<(?:a|img|script)\b|style="color:red/);assert.ok(html.length<15000);
  }
});
test('bare sources and URLs containing balanced parentheses are clickable',()=>{
  const html=renderMarkdown('See https://example.com/paper_(v2). [Paper](https://example.com/paper_(v2))');
  assert.equal((html.match(/<a /g)||[]).length,2);assert.equal((html.match(/href="https:\/\/example.com\/paper_\(v2\)"/g)||[]).length,2);
});
