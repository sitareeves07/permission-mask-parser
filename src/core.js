/**
 * Permission Mask Parser — core implementation.
 *
 * Design decisions (stated plainly so the tests and README agree):
 *
 * 1. Symbolic notation is the FULL form only: "rwxrwxrwx" (9 characters) or
 *    "---------" (9 dashes). We do not support the setuid/setgid/sticky bits
 *    in symbolic form, nor do we support chmod-style delta strings like
 *    "u+rw,go-w". Supporting deltas would mean tracking a "before" state and
 *    applying operations in order, which is a different problem. Keeping to
 *    absolute symbolic strings keeps this library small and its behaviour
 *    predictable.
 *
 * 2. Octal mode strings are exactly 3 characters: "644", "0755" is REJECTED
 *    (leading zero implies 4-digit octal which we don't support), and "755"
 *    is accepted. We reject 4-digit octal (setuid/setgid/sticky) because the
 *    symbolic side cannot represent it, and mixing the two would produce
 *    silent data loss.
 *
 * 3. Numeric mode is a non-negative integer 0–0o777 (0–511). Same range
 *    restriction as octal strings.
 *
 * 4. Position in the symbolic string maps to a bit: r=4, w=2, x=1, dash=0.
 *    This is the standard POSIX mapping and the only one that round-trips
 *    cleanly with octal.
 */

/**
 * Thrown when a symbolic permission string is malformed.
 */
export class SymbolicParseError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SymbolicParseError';
  }
}

/**
 * Thrown when an octal string is malformed or out of range.
 */
export class OctalParseError extends Error {
  constructor(message) {
    super(message);
    this.name = 'OctalParseError';
  }
}

// Each triplet is [read, write, execute]. The bit values are fixed by POSIX.
const TRIPLET_BITS = { r: 4, w: 2, x: 1 };

/**
 * Parse a single 3-character triplet like "rwx" or "r-x" into a number 0–7.
 * Throws SymbolicParseError on any deviation. We are strict because lenient
 * parsing of permissions is a security smell — "rw-" and "rw" must not both
 * silently succeed.
 */
function parseTriplet(triplet) {
  if (triplet.length !== 3) {
    throw new SymbolicParseError(
      `Triplet must be exactly 3 characters, got ${triplet.length}`,
    );
  }
  let value = 0;
  const positions = ['r', 'w', 'x'];
  for (let i = 0; i < 3; i++) {
    const ch = triplet[i];
    const expected = positions[i];
    if (ch === '-') {
      // dash means the bit is off; nothing to add
    } else if (ch === expected) {
      value += TRIPLET_BITS[expected];
    } else {
      throw new SymbolicParseError(
        `Invalid character '${ch}' at position ${i} of triplet; expected '${expected}' or '-'`,
      );
    }
  }
  return value;
}

/**
 * Parse a full 9-character symbolic permission string (e.g. "rwxr-xr-x")
 * into a numeric mode (0–0o777).
 *
 * @param {string} str
 * @returns {number}
 * @throws {SymbolicParseError}
 */
export function parseSymbolic(str) {
  if (typeof str !== 'string') {
    throw new SymbolicParseError('Input must be a string');
  }
  if (str.length !== 9) {
    throw new SymbolicParseError(
      `Symbolic permission must be exactly 9 characters, got ${str.length}`,
    );
  }
  const user = parseTriplet(str.slice(0, 3));
  const group = parseTriplet(str.slice(3, 6));
  const other = parseTriplet(str.slice(6, 9));
  return (user << 6) | (group << 3) | other;
}

/**
 * Parse a 3-character octal mode string like "755" into a numeric mode.
 * Leading zeros ("0755") are rejected — see the design note at the top.
 *
 * @param {string} str
 * @returns {number}
 * @throws {OctalParseError}
 */
export function parseOctal(str) {
  if (typeof str !== 'string') {
    throw new OctalParseError('Input must be a string');
  }
  if (str.length !== 3) {
    throw new OctalParseError(
      `Octal mode must be exactly 3 characters, got ${str.length}`,
    );
  }
  if (!/^[0-7]{3}$/.test(str)) {
    throw new OctalParseError(
      `Octal mode must contain only digits 0-7, got '${str}'`,
    );
  }
  // parseInt with radix 8 is safe here because we already validated the charset.
  return parseInt(str, 8);
}

/**
 * Validate and accept a numeric mode. Must be an integer in [0, 0o777].
 * We check Number.isInteger rather than just truthiness so that NaN and
 * floats are rejected explicitly rather than coercing silently.
 *
 * @param {number} n
 * @returns {number}
 * @throws {OctalParseError}
 */
export function parseNumeric(n) {
  if (!Number.isInteger(n)) {
    throw new OctalParseError(`Numeric mode must be an integer, got ${n}`);
  }
  if (n < 0 || n > 0o777) {
    throw new OctalParseError(
      `Numeric mode must be in range 0–0o777 (0–511), got ${n}`,
    );
  }
  return n;
}

/**
 * Format a single 3-bit value (0–7) as a 3-character triplet.
 */
function formatTriplet(value) {
  let out = '';
  out += (value & 4) ? 'r' : '-';
  out += (value & 2) ? 'w' : '-';
  out += (value & 1) ? 'x' : '-';
  return out;
}

/**
 * Format a numeric mode as a 9-character symbolic string.
 *
 * @param {number} n
 * @returns {string}
 * @throws {OctalParseError} if n is out of range
 */
export function formatSymbolic(n) {
  const mode = parseNumeric(n);
  const user = (mode >> 6) & 7;
  const group = (mode >> 3) & 7;
  const other = mode & 7;
  return formatTriplet(user) + formatTriplet(group) + formatTriplet(other);
}

/**
 * Format a numeric mode as a 3-character octal string (no leading zero).
 *
 * @param {number} n
 * @returns {string}
 * @throws {OctalParseError} if n is out of range
 */
export function formatOctal(n) {
  const mode = parseNumeric(n);
  const user = (mode >> 6) & 7;
  const group = (mode >> 3) & 7;
  const other = mode & 7;
  return `${user}${group}${other}`;
}

/**
 * Identity-with-validation: returns the numeric mode if it is valid.
 * Exists so that callers can normalise any input through a single pipeline
 * (parse → number → format) without writing their own validation.
 *
 * @param {number} n
 * @returns {number}
 * @throws {OctalParseError}
 */
export function formatNumeric(n) {
  return parseNumeric(n);
}
