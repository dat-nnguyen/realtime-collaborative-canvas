import * as Y from 'yjs';

/**
 * @typedef {Object} CanvasElement
 * @property {string} id - Unique identifier (UUID or nanoid). Required.
 * @property {'rectangle'|'circle'|'text'} [type] - Kind of shape.
 * @property {number} [x] - Horizontal coordinate on canvas.
 * @property {number} [y] - Vertical coordinate on canvas.
 * @property {number} [width] - Shape width in pixels.
 * @property {number} [height] - Shape height in pixels.
 * @property {string} [fill] - Hex/RGB fill color (e.g., "#3b82f6").
 * @property {string} [stroke] - Outline color.
 * @property {string} [order] - Fractional index string for layer order (e.g., "a0", "a0V").
 */

const ELEMENT_KEY = 'elements';

/**
 * Initializes and returns a new canvas Y.Doc.
 *
 * @returns {Y.Doc} An isolated Yjs document instance with the elements map initialized.
 */
export function createCanvasDoc() {
  const doc = new Y.Doc();
  doc.getMap(ELEMENT_KEY);
  return doc;
}

/**
 * Upserts a canvas element. If the element exists, patches only the provided properties.
 * All property changes are applied atomically in a single Yjs transaction.
 *
 * @param {Y.Doc} doc - The target canvas Y.Doc.
 * @param {Partial<CanvasElement> & { id: string }} elementPatch - Shape properties with required id.
 * @throws {Error} If elementPatch is missing or lacks an id property.
 */
export function setElement(doc, elementPatch) {
  if (!elementPatch || !elementPatch.id) {
    throw new Error('Element patch must contain an "id" property');
  }

  const elementMap = doc.getMap(ELEMENT_KEY);

  doc.transact(() => {
    let shapeMap = elementMap.get(elementPatch.id);

    if (!shapeMap) {
      shapeMap = new Y.Map();
      elementMap.set(elementPatch.id, shapeMap);
    }

    for (const [key, value] of Object.entries(elementPatch)) {
      if (value !== undefined) {
        shapeMap.set(key, value);
      }
    }
  });
}

/**
 * Retrieves a plain detached snapshot of an element by ID.
 *
 * @param {Y.Doc} doc - The canvas Y.Doc.
 * @param {string} id - The unique element identifier.
 * @returns {CanvasElement | null} Detached element object or null if not found.
 */
export function getElement(doc, id) {
  const shapeMap = doc.getMap(ELEMENT_KEY).get(id);
  if (!shapeMap) return null;
  return shapeMap.toJSON();
}

/**
 * Deletes an element from the canvas by ID.
 *
 * @param {Y.Doc} doc - The canvas Y.Doc.
 * @param {string} id - The unique element identifier to delete.
 * @returns {boolean} True if the element was found and deleted, false otherwise.
 */
export function deleteElement(doc, id) {
  const elementMap = doc.getMap(ELEMENT_KEY);

  if (!elementMap.has(id)) return false;
  elementMap.delete(id);
  return true;
}

/**
 * Returns all canvas elements, sorted in ascending layer order (lowest order drawn first).
 *
 * @param {Y.Doc} doc - The canvas Y.Doc.
 * @returns {CanvasElement[]} Array of elements sorted by their fractional index order.
 */
export function getAllElements(doc) {
  const elementMap = doc.getMap(ELEMENT_KEY);
  const elements = [];

  for (const shapeMap of elementMap.values()) {
    elements.push(shapeMap.toJSON());
  }

  return elements.sort((a, b) => (a.order || '').localeCompare(b.order || ''));
}

// Alias for convenience
export const getAllElement = getAllElements;
export const getElements = getAllElements;

/**
 * Encodes the entire canvas state into a compact binary snapshot.
 * Used for database persistence and full client synchronization.
 *
 * @param {Y.Doc} doc - The canvas Y.Doc.
 * @returns {Uint8Array} Binary CRDT snapshot representation.
 */
export function encodeSnapshot(doc) {
  return Y.encodeStateAsUpdate(doc);
}

/**
 * Ingests and applies a binary CRDT update from WebSocket or Redis.
 *
 * @param {Y.Doc} doc - The target canvas Y.Doc.
 * @param {Uint8Array | Buffer} updateBinary - The binary delta update to apply.
 * @param {any} [origin] - Identifier of the update sender to prevent echo loops.
 */
export function applyDelta(doc, updateBinary, origin) {
  Y.applyUpdate(doc, updateBinary, origin);
}