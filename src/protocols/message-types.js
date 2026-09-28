/**
 * Binary WebSocket Message Opcodes.
 * Transmitted as a variable-length unsigned integer at the start of each binary frame.
 */
export const MESSAGE_SYNC = 0;
export const MESSAGE_AWARENESS = 1;
export const MESSAGE_PING = 2;
export const MESSAGE_PONG = 3;
