import test from 'node:test';
import assert from 'node:assert/strict';
import {RACE_CONTEXT} from '../grok-relay/portfolio-race-context.js';
test('public race reference distinguishes evolved residuals from planning and avoids optimality claims',()=>{
  const text=JSON.stringify(RACE_CONTEXT);
  assert.match(text,/hand-designed trajectory planner/);assert.match(text,/evolved NEAT residual policy/);
  assert.match(text,/same vehicle physics/);assert.match(text,/rather than gradient-based reinforcement learning/);
  assert.match(text,/does not establish globally optimal/);assert.doesNotMatch(text,/generation 25|324\/324/);
});
