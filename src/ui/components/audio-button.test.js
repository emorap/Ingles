import '../../test-utils/dom-env.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from '../../test-utils/dom-env.js';
import { audioButton } from './audio-button.js';

beforeEach(() => { installDom(); });

// In node:test there is no speechSynthesis, so ttsAvailable() is false. That is
// exactly the case an injected `speak` (speakSmart, wired by the app) must
// rescue: the natural/cached voice still works even when the browser voice does
// not, so the button must stay visible and clickable.
test('with an injected speak, the button stays visible and click calls it', () => {
  const calls = [];
  const btn = audioButton('Hello', { speak: (t) => calls.push(t) });

  assert.equal(btn.hasAttribute('hidden'), false, 'not hidden when speak is injected');
  assert.equal(btn.hasAttribute('disabled'), false, 'not disabled when speak is injected');

  btn.dispatchEvent(new window.Event('click'));
  assert.deepEqual(calls, ['Hello']);
});

test('without any speak path and no browser TTS, the button is hidden and disabled', () => {
  const btn = audioButton('Hello');
  assert.equal(btn.hasAttribute('hidden'), true);
  assert.equal(btn.hasAttribute('disabled'), true);
});
