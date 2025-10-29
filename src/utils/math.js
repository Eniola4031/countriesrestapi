export function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function safeDivide(a, b) {
  if (!b) return 0;
  return a / b;
}

export function round(num, places = 2) {
  const factor = 10 ** places;
  return Math.round(num * factor) / factor;
}
