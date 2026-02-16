// Minimal dense linear solver (Gaussian elimination with partial pivoting)
// Good enough for small circuits (<= ~50 unknowns). We can swap to a sparse solver later.

export function solveLinearSystem(A: number[][], b: number[]): number[] {
  const n = A.length;
  if (A.some((row) => row.length !== n)) throw new Error("A must be square");
  if (b.length !== n) throw new Error("b length mismatch");

  // Create augmented matrix
  const M = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    // pivot
    let pivotRow = col;
    let pivotVal = Math.abs(M[col][col]);
    for (let r = col + 1; r < n; r++) {
      const v = Math.abs(M[r][col]);
      if (v > pivotVal) {
        pivotVal = v;
        pivotRow = r;
      }
    }
    if (pivotVal === 0) throw new Error("Singular matrix");
    if (pivotRow !== col) {
      const tmp = M[col];
      M[col] = M[pivotRow];
      M[pivotRow] = tmp;
    }

    // eliminate
    for (let r = col + 1; r < n; r++) {
      const factor = M[r][col] / M[col][col];
      if (factor === 0) continue;
      for (let c = col; c <= n; c++) {
        M[r][c] -= factor * M[col][c];
      }
    }
  }

  // back-substitution
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = M[i][n];
    for (let j = i + 1; j < n; j++) {
      sum -= M[i][j] * x[j];
    }
    x[i] = sum / M[i][i];
  }
  return x;
}
