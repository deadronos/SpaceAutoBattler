type Counts = { active: number; pending: number };
const map = new Map<number, Counts>();

export function setRippleCounts(id: number, c: Counts): void {
  map.set(id, c);
}

export function getAllRippleCounts(): Array<{ id: number; active: number; pending: number }> {
  const out: Array<{ id: number; active: number; pending: number }> = [];
  for (const [id, c] of map) out.push({ id, active: c.active, pending: c.pending });
  return out.sort((a, b) => a.id - b.id);
}

export function clearRippleCounts(): void {
  map.clear();
}
