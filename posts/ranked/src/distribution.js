export const MEAN = 0;
export const STD = 1;

export function pdf(x) {
  return Math.exp(-(x * x) / 2) / Math.sqrt(2 * Math.PI);
}

function erf(x) {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return x >= 0 ? y : -y;
}

export function cdf(x) {
  return 0.5 * (1 + erf(x / Math.SQRT2));
}
