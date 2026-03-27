// ── High Score Table ──────────────────────────────────────────────────────
// Persists top-5 entries in localStorage as JSON.
// Each entry: { score, floor }

const HighScores = (() => {
  const KEY         = 'hauntedHouseHiScores';
  const MAX_ENTRIES = 5;

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return [];
  }

  function _save(table) {
    try { localStorage.setItem(KEY, JSON.stringify(table)); } catch (_) {}
  }

  // Returns true if score would enter the table.
  function qualifies(score) {
    if (!score) return false;
    const table = load();
    return table.length < MAX_ENTRIES || score > table[table.length - 1].score;
  }

  // Submit a score with a player name. Returns 1-based rank, or null if not in table.
  function submit(score, floor, name) {
    if (!score) return null;
    const label = (name || 'unknown').trim() || 'unknown';
    const table = load();
    const entry = { score, floor, name: label };
    table.push(entry);
    table.sort((a, b) => b.score - a.score);
    const rank    = table.indexOf(entry) + 1;
    const trimmed = table.slice(0, MAX_ENTRIES);
    _save(trimmed);
    return rank <= MAX_ENTRIES ? rank : null;
  }

  function get() {
    return load().slice(0, MAX_ENTRIES);
  }

  return { qualifies, submit, get };
})();
