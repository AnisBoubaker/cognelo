import { spawnSync } from "node:child_process";

const ports = [3000, 3001, 3456];
const pids = new Set();

for (const port of ports) {
  const result = spawnSync("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"], {
    encoding: "utf8"
  });

  for (const value of result.stdout.split("\n")) {
    const pid = value.trim();
    if (pid) {
      pids.add(pid);
    }
  }
}

if (pids.size === 0) {
  console.log("No dev servers are listening on ports 3000, 3001, or 3456.");
  process.exit(0);
}

for (const pid of pids) {
  const result = spawnSync("kill", [pid], { encoding: "utf8" });
  if (result.status !== 0) {
    console.error(`Failed to stop PID ${pid}.`);
    process.exit(result.status ?? 1);
  }
}

console.log(`Stopped listener PID${pids.size > 1 ? "s" : ""}: ${[...pids].join(", ")}`);
