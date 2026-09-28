import * as sync from 'y-protocols/sync';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import { MESSAGE_SYNC, MESSAGE_PING, MESSAGE_PONG } from './message-types.js';

/**
 * Creates a binary SyncStep1 message containing the document's state vector.
 * Sent by the server immediately when a client connects to initiate the handshake.
 *
 * @param {import('yjs').Doc} doc - The target Y.Doc whose state vector will be encoded.
 * @returns {Uint8Array} Wire-ready binary frame containing [MESSAGE_SYNC, ...SyncStep1].
 */
export function createSyncStep1Message(doc) {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, MESSAGE_SYNC);
  sync.writeSyncStep1(encoder, doc);
  return encoding.toUint8Array(encoder);
}

/**
 * Creates a binary Update message to broadcast an incremental change to other clients.
 *
 * @param {Uint8Array} update - Raw CRDT delta update emitted by a Y.Doc 'update' event.
 * @returns {Uint8Array} Wire-ready binary frame containing [MESSAGE_SYNC, ...Update].
 */
export function createUpdateMessage(update) {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, MESSAGE_SYNC);
  sync.writeUpdate(encoder, update);
  return encoding.toUint8Array(encoder);
}

/**
 * Handles an incoming raw binary message from a WebSocket client.
 * Dispatches to the appropriate protocol handler (Yjs sync or heartbeat ping).
 *
 * @param {Uint8Array | Buffer} messageBytes - Raw binary payload received over WebSocket.
 * @param {import('yjs').Doc} doc - The room's shared Y.Doc to sync against.
 * @param {any} origin - The originating client socket (passed to Y.Doc to prevent echo loops).
 * @returns {{ reply: Uint8Array | null, messageType: number }} Result object containing optional reply bytes.
 */
export function handleBinaryMessage(messageBytes, doc, origin) {
  // Ensure we are working with a native Uint8Array
  const uint8 = messageBytes instanceof Uint8Array
    ? messageBytes
    : new Uint8Array(messageBytes.buffer, messageBytes.byteOffset, messageBytes.byteLength);

  const decoder = decoding.createDecoder(uint8);
  const encoder = encoding.createEncoder();
  const messageType = decoding.readVarUint(decoder);

  switch (messageType) {
    case MESSAGE_SYNC: {
      encoding.writeVarUint(encoder, MESSAGE_SYNC);
      // readSyncMessage applies any updates to `doc` and writes a reply if missing state was requested
      sync.readSyncMessage(decoder, encoder, doc, origin);

      // If encoder has more than just the 1-byte opcode, we have a reply to send back to the socket!
      const reply = encoding.length(encoder) > 1
        ? encoding.toUint8Array(encoder)
        : null;

      return { messageType, reply };
    }

    case MESSAGE_PING: {
      encoding.writeVarUint(encoder, MESSAGE_PONG);
      return { messageType, reply: encoding.toUint8Array(encoder) };
    }

    default:
      // Unknown message type, safely ignore
      return { messageType, reply: null };
  }
}
