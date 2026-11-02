import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, normalizePersonalState } from '../src/client/storage.js';

test('appearance defaults to light for existing backups and preserves a saved dark preference', () => {
  const state = createInitialState();
  assert.equal(state.theme, 'light');
  delete state.theme;
  assert.equal(normalizePersonalState(state).theme, 'light');
  state.theme = 'dark';
  const restored = normalizePersonalState(JSON.parse(JSON.stringify(state)));
  assert.equal(restored.theme, 'dark');
  assert.equal(restored.goals.length, state.goals.length);
  assert.equal(restored.goals[0].id, state.goals[0].id);
  state.theme = 'unknown';
  assert.equal(normalizePersonalState(state).theme, 'light');
});
