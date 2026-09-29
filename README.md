# Permission Mask Parser

Parses and converts between octal mode strings ("755"), numeric modes (0o755), and symbolic permission notation ("rwxr-xr-x").

```js
import {
  parseSymbolic,
  parseOctal,
  formatSymbolic,
  formatOctal,
} from 'permission-mask-parser';

parseSymbolic('rwxr-xr-x'); // 0o755 (493)
parseOctal('644');         // 0o644 (420)
formatSymbolic(0o755);      // 'rwxr-xr-x'
formatOctal(0o644);         // '644'
```

## Why this exists

Every codebase that touches filesystem permissions eventually reinvents the
string-to-number-to-string dance for mode bits. This library does that one
job with strict validation and no dependencies.

The trade-off: this library only handles the 9-bit permission mask (user,
group, other — each r/w/x). It does **not** support setuid, setgid, or sticky
bits (the 4th octal digit), nor does it support chmod-style delta notation
("u+rw,go-w"). Both were considered and cut deliberately: supporting special
bits without a symbolic representation for them would cause silent data loss
on round-trip, and delta notation is a stateful operation that belongs
in a different library.

## Edge cases you will hit

- **"0755" is rejected.** A leading zero implies a 4-digit octal string,
  which this library does not support. Use "755".
- **"rwsr-xr-x" is rejected.** The `s` bit (setuid) has no representation
  here. If you need special bits, this is the wrong library.
- **Octal strings must be exactly 3 characters.** "75" and "0755" both throw.
- **Numeric modes must be integers in [0, 511].** Floats, NaN, and out-of-range
  values all throw rather than coercing.

## Exports

- `parseSymbolic(str)` → `number` — parses "rwxr-xr-x" to 0o755.
- `parseOctal(str)` → `number` — parses "755" to 0o755.
- `parseNumeric(n)` → `number` — validates and returns a numeric mode.
- `formatSymbolic(n)` → `string` — formats 0o755 as "rwxr-xr-x".
- `formatOctal(n)` → `string` — formats 0o755 as "755".
- `formatNumeric(n)` → `number` — validates and returns a numeric mode.
- `SymbolicParseError` — thrown on malformed symbolic input.
- `OctalParseError` — thrown on malformed octal or out-of-range numeric input.
