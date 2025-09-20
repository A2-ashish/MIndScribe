/** Shared aggregation helpers */
export function rollingAverage(values: number[], window: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - window + 1);
    const slice = values.slice(start, i + 1);
    out.push(Number((slice.reduce((a,b)=>a+b,0)/slice.length).toFixed(3)));
  }
  return out;
}
