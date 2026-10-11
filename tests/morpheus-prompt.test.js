import test from 'node:test';
import assert from 'node:assert/strict';
import {SYSTEM_PROMPT} from '../grok-relay/morpheus-prompt.js';
test('prompt priorities preserve accuracy and latest-topic relevance above advocacy',()=>{
  assert.match(SYSTEM_PROMPT,/Accuracy comes first, relevance second, character voice third/);
  assert.match(SYSTEM_PROMPT,/not to sell them Arman/);
  assert.match(SYSTEM_PROMPT,/rather than an automatic yes/);
  assert.match(SYSTEM_PROMPT,/research prototype, simulation or benchmark remains exactly that/);
  assert.doesNotMatch(SYSTEM_PROMPT,/For a plausible role fit, say yes|lead with a clear favorable judgment/);
  assert.match(SYSTEM_PROMPT,/LaTeX inside \\\( \.\.\. \\\)/);
});
