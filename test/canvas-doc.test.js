import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createCanvasDoc,
  setElement,
  getElement,
  deleteElement,
  getAllElements,
  encodeSnapshot,
  applyDelta
} from '../src/crdt/canvas-doc.js';

test('createCanvasDoc initializes empty document', () => {
  const doc = createCanvasDoc();
  assert.ok(doc, 'Document should be created');
  const elements = getAllElements(doc);
  assert.deepEqual(elements, [], 'Elements array should be empty on init');
});

test('setElement throws error when id is missing', () => {
  const doc = createCanvasDoc();
  assert.throws(
    () => setElement(doc, { x: 10, y: 20 }),
    /Element patch must contain an "id" property/
  );
});

test('setElement creates and partially updates an element', () => {
  const doc = createCanvasDoc();

  // Create
  setElement(doc, {
    id: 'rect-1',
    type: 'rectangle',
    x: 100,
    y: 150,
    width: 200,
    height: 100,
    fill: '#ff0000',
    order: 'a0'
  });

  const created = getElement(doc, 'rect-1');
  assert.equal(created.id, 'rect-1');
  assert.equal(created.x, 100);
  assert.equal(created.fill, '#ff0000');

  // Partial update: only change x and fill
  setElement(doc, {
    id: 'rect-1',
    x: 250,
    fill: '#00ff00'
  });

  const updated = getElement(doc, 'rect-1');
  assert.equal(updated.x, 250, 'x should be updated');
  assert.equal(updated.fill, '#00ff00', 'fill should be updated');
  assert.equal(updated.y, 150, 'y should remain untouched');
  assert.equal(updated.width, 200, 'width should remain untouched');
  assert.equal(updated.height, 100, 'height should remain untouched');
  assert.equal(updated.order, 'a0', 'order should remain untouched');
});

test('deleteElement removes element from doc', () => {
  const doc = createCanvasDoc();

  setElement(doc, { id: 'circle-1', type: 'circle', x: 50, y: 50 });
  assert.ok(getElement(doc, 'circle-1'));

  const deleted = deleteElement(doc, 'circle-1');
  assert.equal(deleted, true);
  assert.equal(getElement(doc, 'circle-1'), null);

  // Deleting non-existent element returns false
  assert.equal(deleteElement(doc, 'non-existent'), false);
});

test('getAllElements sorts shapes by layer order string', () => {
  const doc = createCanvasDoc();

  // Insert shapes out of order
  setElement(doc, { id: 'shape-top', order: 'a2' });
  setElement(doc, { id: 'shape-bottom', order: 'a0' });
  setElement(doc, { id: 'shape-middle', order: 'a1' });

  const elements = getAllElements(doc);
  assert.equal(elements.length, 3);
  assert.equal(elements[0].id, 'shape-bottom');
  assert.equal(elements[1].id, 'shape-middle');
  assert.equal(elements[2].id, 'shape-top');
});

test('Concurrent edits merge deterministically across documents', () => {
  const docA = createCanvasDoc();
  const docB = createCanvasDoc();

  // User A creates a shape
  setElement(docA, {
    id: 'box-1',
    type: 'rectangle',
    x: 100,
    y: 100,
    fill: '#ffffff',
    order: 'a0'
  });

  // Initial sync: Doc A -> Doc B
  applyDelta(docB, encodeSnapshot(docA));
  assert.deepEqual(getElement(docB, 'box-1'), getElement(docA, 'box-1'));

  // Track local updates only (ignoring 'remote' origin)
  const updatesFromA = [];
  const updatesFromB = [];
  docA.on('update', (update, origin) => {
    if (origin !== 'remote') updatesFromA.push(update);
  });
  docB.on('update', (update, origin) => {
    if (origin !== 'remote') updatesFromB.push(update);
  });

  // Concurrent edits:
  // Alice changes fill to blue
  setElement(docA, { id: 'box-1', fill: '#0000ff' });
  // Bob changes position x to 500
  setElement(docB, { id: 'box-1', x: 500 });

  // Cross-pollinate deltas over simulated network with 'remote' origin
  for (const u of updatesFromB) applyDelta(docA, u, 'remote');
  for (const u of updatesFromA) applyDelta(docB, u, 'remote');

  const finalA = getElement(docA, 'box-1');
  const finalB = getElement(docB, 'box-1');

  // Both should have merged non-conflicting properties cleanly
  assert.equal(finalA.fill, '#0000ff', "Alice's fill color should be retained");
  assert.equal(finalA.x, 500, "Bob's x coordinate should be retained");
  assert.deepEqual(finalA, finalB, 'Doc A and Doc B must converge to the exact same state');
});

test('encodeSnapshot and applyDelta restores state from cold start', () => {
  const sourceDoc = createCanvasDoc();
  setElement(sourceDoc, { id: 'persisted-1', type: 'rectangle', x: 42, y: 84 });

  // Simulate storing snapshot to PostgreSQL BYTEA and restoring
  const snapshotBytes = encodeSnapshot(sourceDoc);

  const restoredDoc = createCanvasDoc();
  applyDelta(restoredDoc, snapshotBytes);

  const restoredElement = getElement(restoredDoc, 'persisted-1');
  assert.ok(restoredElement);
  assert.equal(restoredElement.x, 42);
  assert.equal(restoredElement.y, 84);
});
