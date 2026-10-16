/**
 * Placeholder QR: a deterministic pattern drawn from the payload, with the three finder squares.
 * It does not scan. A real provider's QR image or EMV string replaces it (see PaymentModal).
 */
export function FakeQr({ payload, size = 29 }: { payload: string; size?: number }) {
  // small string hash -> a repeatable pseudo-random stream
  let state = 2166136261;
  for (const char of payload) state = Math.imul(state ^ char.charCodeAt(0), 16777619) >>> 0;
  const next = () => {
    state = (Math.imul(state, 1103515245) + 12345) >>> 0;
    return state;
  };
  const finder = (x: number, y: number) =>
    (x < 8 && y < 8) || (x >= size - 8 && y < 8) || (x < 8 && y >= size - 8);
  const ring = (x: number, y: number, ox: number, oy: number) => {
    const dx = x - ox;
    const dy = y - oy;
    if (dx < 0 || dy < 0 || dx > 6 || dy > 6) return false;
    return dx === 0 || dy === 0 || dx === 6 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4);
  };
  const cells: { x: number; y: number }[] = [];
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const on = finder(x, y)
        ? ring(x, y, 0, 0) || ring(x, y, size - 7, 0) || ring(x, y, 0, size - 7)
        : next() % 100 < 48;
      if (on) cells.push({ x, y });
    }
  }
  return (
    <svg
      viewBox={`-2 -2 ${size + 4} ${size + 4}`}
      role="img"
      aria-label="QR"
      className="h-48 w-48 rounded-lg border border-line bg-surface"
    >
      {cells.map(({ x, y }) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="#0f172a" />
      ))}
    </svg>
  );
}
