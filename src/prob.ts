// Points distributions: each player-fixture carries its simulated probability mass function (pmf).
import type { Pmf } from "./types";

export const mean = (d: Pmf) => d.p.reduce((s, p, i) => s + p * (d.lo + i), 0);

/** Distribution of a sum of independent scores (convolution). */
export function convolve(a: Pmf, b: Pmf): Pmf {
  const p = new Array(a.p.length + b.p.length - 1).fill(0);
  for (let i = 0; i < a.p.length; i++) {
    if (!a.p[i]) continue;
    for (let j = 0; j < b.p.length; j++) p[i + j] += a.p[i] * b.p[j];
  }
  return { lo: a.lo + b.lo, p };
}

export const scale = (d: Pmf, k: number): Pmf => {
  // k x score (captain = 2, triple captain = 3): values lo*k, (lo+1)*k, ...
  const p = new Array((d.p.length - 1) * k + 1).fill(0);
  d.p.forEach((q, i) => (p[i * k] += q));
  return { lo: d.lo * k, p };
};

export const ZERO: Pmf = { lo: 0, p: [1] };

export const sumAll = (ds: Pmf[]) => ds.reduce(convolve, ZERO);

/** P(score >= x) */
export const atLeast = (d: Pmf, x: number) =>
  d.p.reduce((s, p, i) => (d.lo + i >= x ? s + p : s), 0);

export function quantile(d: Pmf, q: number) {
  let c = 0;
  for (let i = 0; i < d.p.length; i++) {
    c += d.p[i];
    if (c >= q - 1e-12) return d.lo + i;
  }
  return d.lo + d.p.length - 1;
}

/** P(a > b) + 0.5 P(a = b) for independent a, b */
export function beats(a: Pmf, b: Pmf) {
  const cb: number[] = [];
  let c = 0;
  for (const p of b.p) cb.push((c += p));
  const cdfB = (x: number) => {
    const i = x - b.lo;
    if (i < 0) return 0;
    if (i >= cb.length) return 1;
    return cb[i];
  };
  let win = 0;
  a.p.forEach((p, i) => {
    const x = a.lo + i;
    const below = cdfB(x - 1);
    const eq = cdfB(x) - below;
    win += p * (below + 0.5 * eq);
  });
  return win;
}

/** One random score from a pmf. */
export function sample(d: Pmf, u = Math.random()) {
  let c = 0;
  for (let i = 0; i < d.p.length; i++) {
    c += d.p[i];
    if (u <= c) return d.lo + i;
  }
  return d.lo + d.p.length - 1;
}
