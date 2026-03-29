# Security Audits

---

## 2026-03-29

**Auditor:** Claude (claude-sonnet-4-6)
**Scope:** Full codebase review — threat model: user downloads and opens `index.html` locally in a browser.

### No significant vulnerabilities found

This codebase has a very small attack surface. Key properties:

**No network activity**
- Zero `fetch()`, `XMLHttpRequest`, `WebSocket`, or CDN calls in any `.js` file.
- `p5.min.js` and `creepster.ttf` are fully vendored. The game is 100% offline.

**No code execution from user input**
- No `eval()`, `new Function()`, or `setTimeout`/`setInterval` with string arguments anywhere in the game code.
- The dev console (`_execDevCommand`) processes typed commands via string comparison only — no dynamic evaluation.

**No DOM manipulation**
- No `innerHTML`, `outerHTML`, `document.write`, or `insertAdjacentHTML` calls in game code.
- All user-visible output (names, scores, console text) goes through p5.js's canvas `text()` call, which renders to a `<canvas>` bitmap. Canvas `text()` cannot execute scripts regardless of content.

**localStorage is safe**
- Only writes scores: `{ score, floor, name }`.
- Reads back with `JSON.parse` in a try/catch, so corrupt data fails silently.
- Names are capped at 12 chars at input time and `.slice(0, 12)` again before display — no way to smuggle anything meaningful.
- No user PII stored.

**No filesystem access**
- Browser JS has no filesystem API access that could read files from the user's computer (no `File` API usage, no drag/drop handling).

### Low-severity notes (not exploitable)

**1. `p5.min.js` integrity** — No Subresource Integrity hash. Irrelevant for local `file://` use, but if ever served from a web server with a CDN-hosted p5, add an `integrity=` attribute. Anyone who tampers with `p5.min.js` before distribution could compromise everything.

**2. No Content-Security-Policy** — No CSP header or meta-tag. Irrelevant for local use; if moved to a web server, `script-src 'self'` would prevent injected scripts.

**3. localStorage origin collision** — On some browsers all `file://` pages share the same localStorage origin, so another local HTML file could clash on the key `hauntedHouseHiScores`. Cosmetic only (corrupt scores), not a security risk.

### Verdict

**Safe to distribute and run.** No code paths that can access the user's filesystem, make network requests, execute injected code, or exfiltrate data. The only persistent side effect of running the game is a handful of bytes written to localStorage.
