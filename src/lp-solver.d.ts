declare module "javascript-lp-solver" {
  interface Model {
    optimize: string;
    opType: "max" | "min";
    constraints: Record<string, { min?: number; max?: number; equal?: number }>;
    variables: Record<string, Record<string, number>>;
    ints?: Record<string, 1>;
    options?: Record<string, unknown>;
  }
  const solver: { Solve(model: Model): { feasible: boolean; result: number; [k: string]: number | boolean } };
  export default solver;
}
