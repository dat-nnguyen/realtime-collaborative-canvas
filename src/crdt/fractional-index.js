import {
  generateKeyBetween as rawGenerateKeyBetween,
  generateNKeysBetween as rawGenerateNKeysBetween,
} from 'fractional-indexing';

/**
 * Generates an order key strictly between prevKey and nextKey.
 *
 * Cases handled:
 * - Empty canvas (prevKey = null, nextKey = null) -> returns "a0"
 * - Append to top (prevKey = "a1", nextKey = null) -> returns "a2"
 * - Prepend to bottom (prevKey = null, nextKey = "a0") -> returns "Zz"
 * - Insert between (prevKey = "a0", nextKey = "a1") -> returns "a0V"
 *
 * @param {string | null | undefined} prevKey - Key of the item immediately below (null if placing at bottom).
 * @param {string | null | undefined} nextKey - Key of the item immediately above (null if placing at top).
 * @returns {string} An order string guaranteed to sort: prevKey < result < nextKey.
 */
export function generateKeyBetween(prevKey, nextKey) {
  // Normalize undefined or empty strings to null
  const a = prevKey || null;
  const b = nextKey || null;

  // Defensive validation: if caller provided reversed keys, ensure consistency
  if (a !== null && b !== null && a >= b) {
    throw new Error(`Invalid fractional bounds: prevKey ("${a}") must be < nextKey ("${b}")`);
  }

  return rawGenerateKeyBetween(a, b);
}

/**
 * Generates N evenly-spaced order keys between prevKey and nextKey.
 * Useful when pasting or importing multiple shapes into a layer at once.
 *
 * @param {string | null | undefined} prevKey - Lower bound.
 * @param {string | null | undefined} nextKey - Upper bound.
 * @param {number} count - Number of keys to generate.
 * @returns {string[]} An array of N strictly increasing order keys.
 */
export function generateNKeysBetween(prevKey, nextKey, count) {
  if (count <= 0) return [];
  const a = prevKey || null;
  const b = nextKey || null;

  if (a !== null && b !== null && a >= b) {
    throw new Error(`Invalid fractional bounds: prevKey ("${a}") must be < nextKey ("${b}")`);
  }

  return rawGenerateNKeysBetween(a, b, count);
}
