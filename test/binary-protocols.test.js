import test from 'node:test';
import assert from 'node:assert/strict';
import * as decoding from 'lib0/decoding';
import {
  MESSAGE_SYNC,
  MESSAGE_PING,
  MESSAGE_PONG,
} from '../src/protocols/message-types.js';
import {
  createSyncStep1Message,
  createUpdateMessage,
  handleBinaryMessage,
} from '../src/protocols/binary-protocols.js';
import {
  createCanvasDoc,
  setElement,
  getElement,
} from '../src/crdt/canvas-doc.js';

test('createSyncStep1Message formats a valid SyncStep1 binary frame', () => {
  const doc = createCanvasDoc();
  const message = createSyncStep1Message(doc);

  assert.ok(message instanceof Uint8Array, 'Message must be a Uint8Array');
  assert.ok(message.byteLength > 1, 'Message must contain opcode and payload');

  const decoder = decoding.createDecoder(message);
  const opcode = decoding.readVarUint(decoder);
  assert.equal(opcode, MESSAGE_SYNC, 'First byte must be MESSAGE_SYNC');
});

test('createUpdateMessage wraps CRDT delta into a binary frame', () => {
  const doc = createCanvasDoc();
  let capturedUpdate = null;
  doc.on('update', (u) => { capturedUpdate = u; });

  setElement(doc, { id: 'shape-1', type: 'rectangle', x: 50, y: 50 });
  assert.ok(capturedUpdate, 'Update must be captured from Y.Doc');

  const frame = createUpdateMessage(capturedUpdate);
  assert.ok(frame instanceof Uint8Array);

  const decoder = decoding.createDecoder(frame);
  const opcode = decoding.readVarUint(decoder);
  assert.equal(opcode, MESSAGE_SYNC);
});

test('handleBinaryMessage handles PING with PONG reply', () => {
  const doc = createCanvasDoc();
  // Build a 1-byte PING message
  const pingMessage = new Uint8Array([MESSAGE_PING]);

  const { messageType, reply } = handleBinaryMessage(pingMessage, doc, null);
  assert.equal(messageType, MESSAGE_PING);
  assert.ok(reply instanceof Uint8Array, 'Reply must be provided');

  const decoder = decoding.createDecoder(reply);
  const replyOpcode = decoding.readVarUint(decoder);
  assert.equal(replyOpcode, MESSAGE_PONG, 'Reply must be MESSAGE_PONG');
});

test('handleBinaryMessage safely ignores unknown message types', () => {
  const doc = createCanvasDoc();
  const unknownMessage = new Uint8Array([99]); // Unknown opcode

  const { messageType, reply } = handleBinaryMessage(unknownMessage, doc, null);
  assert.equal(messageType, 99);
  assert.equal(reply, null);
});

test('End-to-End Handshake: Synchronizes client and server through binary messages', () => {
  const serverDoc = createCanvasDoc();
  const clientDoc = createCanvasDoc();

  // Server already has an existing shape on the canvas
  setElement(serverDoc, {
    id: 'box-existing',
    type: 'rectangle',
    x: 100,
    y: 200,
    fill: '#ff0000',
    order: 'a0',
  });

  // 1. Client connects and initiates handshake by sending its SyncStep1 to Server
  const clientStep1 = createSyncStep1Message(clientDoc);

  // 2. Server receives Client's SyncStep1 and replies with SyncStep2 (containing the missing shape)
  const serverResponse = handleBinaryMessage(clientStep1, serverDoc, 'client-socket');
  assert.equal(serverResponse.messageType, MESSAGE_SYNC);
  assert.ok(serverResponse.reply, 'Server must generate SyncStep2 containing missing state');

  // 3. Client receives Server's SyncStep2 and applies it
  handleBinaryMessage(serverResponse.reply, clientDoc, 'server');

  // Verification: Client has successfully received the shape from Server!
  const clientElement = getElement(clientDoc, 'box-existing');
  assert.ok(clientElement, 'Client must have synchronized box-existing');
  assert.equal(clientElement.x, 100);
  assert.equal(clientElement.fill, '#ff0000');
});

test('Live updates propagate and apply via createUpdateMessage', () => {
  const serverDoc = createCanvasDoc();
  const clientDoc = createCanvasDoc();

  // Synchronize initial state
  const step1 = createSyncStep1Message(serverDoc);
  const clientStep = handleBinaryMessage(step1, clientDoc, 'server');
  if (clientStep.reply) {
    const srvStep = handleBinaryMessage(clientStep.reply, serverDoc, 'client');
    if (srvStep.reply) handleBinaryMessage(srvStep.reply, clientDoc, 'server');
  }

  // Client creates a new shape during live session
  let updateDelta = null;
  clientDoc.on('update', (u, origin) => {
    if (origin !== 'server') updateDelta = u;
  });

  setElement(clientDoc, { id: 'box-new', type: 'circle', x: 350, y: 450 });
  assert.ok(updateDelta);

  // Pack into binary frame and send to server
  const frame = createUpdateMessage(updateDelta);
  handleBinaryMessage(frame, serverDoc, 'client-socket');

  // Verification: Server has received and applied the update
  const serverElement = getElement(serverDoc, 'box-new');
  assert.ok(serverElement, 'Server must have the new element');
  assert.equal(serverElement.x, 350);
  assert.equal(serverElement.type, 'circle');
});
