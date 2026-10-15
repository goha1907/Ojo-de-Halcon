/**
 * A random number from 1 to `count`, chosen per request. A function of its own so server pages do not
 * call the random generator while rendering (used to try several wordings of one phrase).
 */
export function randomVariant(count: number): number {
  return 1 + Math.floor(Math.random() * count);
}
