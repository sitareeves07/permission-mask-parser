import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseSymbolic,
  parseOctal,
  parseNumeric,
  formatSymbolic,
  formatOctal,
  formatNumeric,
  SymbolicParseError,
  OctalParseError,
} from '../src/core.js';

describe('parseSymbolic', () => {
  it('parses rwxrwxrwx to 0o777', () => {
    assert.equal(parseSymbolic('rwxrwxrwx'), 0o777);
  });

  it('parses --------- to 0', () => {
    assert.equal(parseSymbolic('---------'), 0);
  });

  it('parses rwxr-xr-x to 0o755', () => {
    assert.equal(parseSymbolic('rwxr-xr-x'), 0o755);
  });

  it('parses rw-r--r-- to 0o644', () => {
    assert.equal(parseSymbolic('rw-r--r--'), 0o644);
  });

  it('rejects strings that are not 9 characters', () => {
    assert.throws(() => parseSymbolic('rwx'), SymbolicParseError);
    assert.throws(() => parseSymbolic('rwxrwxrwxr'), SymbolicParseError);
  });

  it('rejects invalid characters in a triplet', () => {
    // 's' is used for setuid in real chmod but we don't support it.
    assert.throws(() => parseSymbolic('rwsr-xr-x'), SymbolicParseError);
  });

  it('rejects characters in the wrong position', () => {
    // 'w' in the read position is not valid.
    assert.throws(() => parseSymbolic('w-r-xr-xr'), SymbolicParseError);
  });

  it('rejects non-string input', () => {
    assert.throws(() => parseSymbolic(0o755), SymbolicParseError);
    assert.throws(() => parseSymbolic(null), SymbolicParseError);
  });
});

describe('parseOctal', () => {
  it('parses 755 to 0o755', () => {
    assert.equal(parseOctal('755'), 0o755);
  });

  it('parses 000 to 0', () => {
    assert.equal(parseOctal('000'), 0);
  });

  it('parses 777 to 0o777', () => {
    assert.equal(parseOctal('777'), 0o777);
  });

  it('rejects 4-character octal strings', () => {
    // We deliberately do not support setuid/setgid/sticky bits.
    assert.throws(() => parseOctal('4755'), OctalParseError);
  });

  it('rejects strings with digits outside 0-7', () => {
    assert.throws(() => parseOctal('855'), OctalParseError);
    assert.throws(() => parseOctal('75a'), OctalParseError);
  });

  it('rejects non-string input', () => {
    assert.throws(() => parseOctal(755), OctalParseError);
  });
});

describe('parseNumeric', () => {
  it('accepts 0', () => {
    assert.equal(parseNumeric(0), 0);
  });

  it('accepts 0o777 (511)', () => {
    assert.equal(parseNumeric(0o777), 0o777);
  });

  it('rejects negative numbers', () => {
    assert.throws(() => parseNumeric(-1), OctalParseError);
  });

  it('rejects numbers above 0o777', () => {
    assert.throws(() => parseNumeric(0o1000), OctalParseError);
    assert.throws(() => parseNumeric(512), OctalParseError);
  });

  it('rejects non-integers', () => {
    assert.throws(() => parseNumeric(1.5), OctalParseError);
    assert.throws(() => parseNumeric(NaN), OctalParseError);
  });
});

describe('formatSymbolic', () => {
  it('formats 0o755 as rwxr-xr-x', () => {
    assert.equal(formatSymbolic(0o755), 'rwxr-xr-x');
  });

  it('formats 0 as ---------', () => {
    assert.equal(formatSymbolic(0), '---------');
  });

  it('formats 0o777 as rwxrwxrwx', () => {
    assert.equal(formatSymbolic(0o777), 'rwxrwxrwx');
  });

  it('rejects out-of-range input', () => {
    assert.throws(() => formatSymbolic(-1), OctalParseError);
    assert.throws(() => formatSymbolic(0o1000), OctalParseError);
  });
});

describe('formatOctal', () => {
  it('formats 0o755 as 755', () => {
    assert.equal(formatOctal(0o755), '755');
  });

  it('formats 0 as 000', () => {
    assert.equal(formatOctal(0), '000');
  });

  it('formats 0o7 as 007 (preserves leading zeros within the triplet)', () => {
    assert.equal(formatOctal(0o7), '007');
  });

  it('rejects out-of-range input', () => {
    assert.throws(() => formatOctal(0o1000), OctalParseError);
  });
});

describe('formatNumeric', () => {
  it('returns a valid mode unchanged', () => {
    assert.equal(formatNumeric(0o644), 0o644);
  });

  it('rejects invalid input', () => {
    assert.throws(() => formatNumeric(-1), OctalParseError);
  });
});

describe('round-trip conversions', () => {
  it('octal -> numeric -> octal is stable', () => {
    for (const oct of ['000', '100', '644', '755', '777']) {
      assert.equal(formatOctal(parseOctal(oct)), oct);
    }
  });

  it('symbolic -> numeric -> symbolic is stable', () => {
    const cases = [
      '---------',
      'r--------',
      'rw-r--r--',
      'rwxr-xr-x',
      'rwxrwxrwx',
    ];
    for (const sym of cases) {
      assert.equal(formatSymbolic(parseSymbolic(sym)), sym);
    }
  });

  it('octal -> symbolic -> octal is stable', () => {
    for (const oct of ['000', '644', '755', '777']) {
      const sym = formatSymbolic(parseOctal(oct));
      assert.equal(formatOctal(parseSymbolic(sym)), oct);
    }
  });
});
