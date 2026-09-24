import test from 'node:test';
import assert from 'node:assert/strict';
import { canvasPoint } from '../src/pointer.js';

test('desktop coordinates preserve logical canvas position', () => {
  const rect = { left: 30, top: 70, width: 960, height: 600 };
  assert.deepEqual(canvasPoint(510, 370, rect, 960, 600), { x: 480, y: 300, inside: true });
});

test('mobile cover coordinates compensate for cropped horizontal edges', () => {
  const rect = { left: 10, top: 20, width: 330, height: 300 };
  assert.deepEqual(canvasPoint(175, 170, rect, 960, 600, 'cover'), { x: 480, y: 300, inside: true });
  assert.deepEqual(canvasPoint(10, 170, rect, 960, 600, 'cover'), { x: 150, y: 300, inside: true });
});

test('fullscreen contain ignores letterboxing and rejects taps in its bars', () => {
  const rect = { left: 0, top: 0, width: 960, height: 1000 };
  assert.deepEqual(canvasPoint(480, 500, rect, 960, 600, 'contain'), { x: 480, y: 300, inside: true });
  assert.equal(canvasPoint(480, 100, rect, 960, 600, 'contain').inside, false);
});
