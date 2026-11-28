// Recent generated text belongs to one account in this browser tab only.
// It is never a shared server cache and never rewrites saved analysis records.
export function createAdviceSession(storageProvider = () => globalThis.sessionStorage) {
  const memory = new Map();
  const keyFor = (scope, label) => `doo-pet-advice-v1:${JSON.stringify([scope, label])}`;
  function read(key) {
    if (memory.has(key)) return memory.get(key);
    try {
      const raw = JSON.parse(storageProvider()?.getItem(key) || 'null');
      if (raw && Number.isSafeInteger(raw.sequence) && raw.sequence >= 0) return raw;
    } catch { /* The session also works when browser storage is unavailable. */ }
    return { sequence: 0, previous: null };
  }
  function write(key, value) {
    memory.set(key, value);
    try { storageProvider()?.setItem(key, JSON.stringify(value)); } catch { /* Use memory. */ }
  }
  return {
    begin(scope, label) {
      const key = keyFor(scope, label);
      const current = read(key);
      const sequence = current.sequence + 1;
      write(key, { ...current, sequence });
      return { key, sequence, variation_index: current.sequence % 6, previous_advice: current.previous };
    },
    remember(ticket, advice) {
      const current = read(ticket.key);
      if (current.sequence !== ticket.sequence) return; // Ignore a late response from an older check.
      const previous = { ...current.previous };
      if (advice.source === 'gemini') previous.items = [...advice.items];
      if (advice.context_tips?.source === 'gemini') previous.tips = [...advice.context_tips.items];
      if (Object.keys(previous).length) write(ticket.key, { ...current, previous });
    },
  };
}

export const adviceSession = createAdviceSession();
