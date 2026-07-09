#!/usr/bin/env bun
/**
 * Run board-sim multiple times and check for ghost rows (F3, F4... created by double floats)
 */
import("./board-sim.mjs").catch(() => {
  // Can't import because autoPlay runs immediately
  // Instead, re-run the script as a child process
});

import { spawnSync } from "node:child_process";

for (let run = 1; run <= 8; run++) {
  const result = spawnSync("bun", ["run", "scripts/board-sim.mjs"], {
    encoding: "utf-8",
    timeout: 10000,
  });

  const output = result.stdout;

  // Extract row keys from the TABLERO section
  const lines = output.split("\n");
  const tableStart = lines.findIndex((l) => l.trim() === "TABLERO");
  const tableEnd = lines.findIndex((l, i) => i > tableStart && l.trim() === "");
  const rows = [];

  // Extract the F* rows between TABLERO and the next empty line
  for (
    let i = tableStart + 2;
    i < (tableEnd > tableStart ? tableEnd : lines.length);
    i++
  ) {
    const line = lines[i].trim();
    if (/^F-?\d/.test(line)) {
      rows.push(line.split(/[(\s]/)[0]);
    }
  }

  // Extract "Filas usadas" line
  const filasLine = lines.find((l) => l.includes("Filas usadas"));
  const filasMatch = filasLine?.match(/\d+/);

  // Check for ghost rows: positive rows >= 2 that have data
  const positiveRows = rows.filter(
    (r) => r.startsWith("F") && !r.startsWith("F-") && r !== "F0" && r !== "F1",
  );
  const negativeRows = rows.filter((r) => r.startsWith("F-") && r !== "F0");

  // Check if there are matching positive/negative pairs
  const ghosts = positiveRows.filter((p) => {
    const neg = `-${p.slice(1)}`;
    return negativeRows.includes(`F${neg}`);
  });

  console.log(
    `Run ${run}: ${filasMatch ? `Filas=${filasMatch[0]}` : "?"} | Rows: ${rows.join(",")}`,
  );
  if (ghosts.length > 0) {
    console.log(
      `  👻 GHOST ROWS: ${ghosts.join(", ")} (exist alongside their negative counterparts)`,
    );
  }
}

console.log("\nDone.");
