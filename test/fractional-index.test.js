import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyBetween, generateNKeysBetween } from '../src/crdt/fractional-index.js';
import { createCanvasDoc, setElement, getAllElements } from '../src/crdt/canvas-doc.js';

test('generateKeyBetween handles boundary conditions', () => {
  // Empty canvas
  const first = generateKeyBetween(null, null);
  assert.equal(first, 'a0', 'Initial key should be "a0"');

  // Append to top
  const second = generateKeyBetween(first, null);
  assert.ok(first < second, `second ("${second}") should be > first ("${first}")`);

  // Prepend to bottom
  const bottom = generateKeyBetween(null, first);
  assert.ok(bottom < first, `bottom ("${bottom}") should be < first ("${first}")`);

  // Insert between
  const middle = generateKeyBetween(first, second);
  assert.ok(first < middle && middle < second, `middle ("${middle}") must be between first and second`);
});

test('generateKeyBetween throws when prevKey >= nextKey', () => {
  assert.throws(
    () => generateKeyBetween('b0', 'a0'),
    /Invalid fractional bounds/
  );
  assert.throws(
    () => generateKeyBetween('a0', 'a0'),
    /Invalid fractional bounds/
  );
});

test('generateNKeysBetween produces N strictly ordered keys', () => {
  const keys = generateNKeysBetween('a0', 'a5', 5);
  assert.equal(keys.length, 5);

  let prev = 'a0';
  for (const k of keys) {
    assert.ok(prev < k, `Key "${k}" should be > prev "${prev}"`);
    prev = k;
  }
  assert.ok(prev < 'a5', `Last key "${prev}" should be < "a5"`);
});

test('Deep insertion stress test: 50 consecutive insertions in same spot', () => {
  let left = 'a0';
  let right = 'a1';
  const inserted = [];

  // Repeatedly insert immediately next to 'left'
  for (let i = 0; i < 50; i++) {
    const mid = generateKeyBetween(left, right);
    inserted.push(mid);
    right = mid;
  }

  assert.equal(inserted.length, 50);

  // Verify strict descending order (since each was inserted before the previous right)
  for (let i = 0; i < inserted.length - 1; i++) {
    assert.ok(
      inserted[i] > inserted[i + 1],
      `Expected ${inserted[i]} > ${inserted[i + 1]}`
    );
  }

  // Verify all remain strictly > left ('a0')
  for (const key of inserted) {
    assert.ok(key > left, `Key ${key} must be > ${left}`);
  }
});

test('Canvas integration: Layer reordering without affecting other shapes', () => {
  const doc = createCanvasDoc();

  // Create 3 shapes
  const k1 = generateKeyBetween(null, null); // Bottom shape
  const k2 = generateKeyBetween(k1, null);    // Middle shape
  const k3 = generateKeyBetween(k2, null);    // Top shape

  setElement(doc, { id: 'shape-bottom', order: k1 });
  setElement(doc, { id: 'shape-middle', order: k2 });
  setElement(doc, { id: 'shape-top', order: k3 });

  // Initial order verification
  let elements = getAllElements(doc);
  assert.deepEqual(elements.map(e => e.id), ['shape-bottom', 'shape-middle', 'shape-top']);

  // Move bottom shape to the very top:
  const newTopOrder = generateKeyBetween(k3, null);
  setElement(doc, { id: 'shape-bottom', order: newTopOrder });

  elements = getAllElements(doc);
  assert.deepEqual(elements.map(e => e.id), ['shape-middle', 'shape-top', 'shape-bottom']);

  // Move shape-bottom between shape-middle and shape-top:
  const betweenOrder = generateKeyBetween(k2, k3);
  setElement(doc, { id: 'shape-bottom', order: betweenOrder });

  elements = getAllElements(doc);
  assert.deepEqual(elements.map(e => e.id), ['shape-middle', 'shape-bottom', 'shape-top']);
});
