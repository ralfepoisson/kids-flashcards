export function shuffled<T>(cards: readonly T[]): T[] {
  const result = [...cards];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
export function navigate(index: number, direction: number, length: number): number {
  return Math.max(0, Math.min(Math.max(0, length - 1), index + direction));
}
