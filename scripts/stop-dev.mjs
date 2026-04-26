import { spawnSync } from "node:child_process";

const ports = [3000, 3001, 3456];
const processes = new Map();

for (const port of ports) {
  const result = spawnSync("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"], {
    encoding: "utf8"
  });

  for (const value of result.stdout.split("\n")) {
    const pid = value.trim();
    if (pid) {
      processes.set(pid, { command: readCommand(pid), port });
    }
  }
}

const killableProcesses = [...processes.entries()].filter(([, processInfo]) => !isDockerPortForwarder(processInfo.command));
const skippedProcesses = [...processes.entries()].filter(([, processInfo]) => isDockerPortForwarder(processInfo.command));

if (killableProcesses.length === 0) {
  if (skippedProcesses.length > 0) {
    console.log(
      `No Node dev servers are listening on ports 3000 or 3001. Skipped Docker-managed listener${skippedProcesses.length > 1 ? "s" : ""}: ${skippedProcesses
        .map(([pid, processInfo]) => `${pid} on ${processInfo.port}`)
        .join(", ")}.`
    );
    process.exit(0);
  }
  console.log("No dev servers are listening on ports 3000, 3001, or 3456.");
  process.exit(0);
}

for (const [pid] of killableProcesses) {
  const result = spawnSync("kill", [pid], { encoding: "utf8" });
  if (result.status !== 0) {
    console.error(`Failed to stop PID ${pid}.`);
    process.exit(result.status ?? 1);
  }
}

console.log(`Stopped listener PID${killableProcesses.length > 1 ? "s" : ""}: ${killableProcesses.map(([pid]) => pid).join(", ")}`);
if (skippedProcesses.length > 0) {
  console.log(
    `Skipped Docker-managed listener${skippedProcesses.length > 1 ? "s" : ""}: ${skippedProcesses
      .map(([pid, processInfo]) => `${pid} on ${processInfo.port}`)
      .join(", ")}.`
  );
}

function readCommand(pid) {
  const result = spawnSync("ps", ["-p", pid, "-o", "command="], {
    encoding: "utf8"
  });
  return result.stdout.trim();
}

function isDockerPortForwarder(command) {
  return command.includes("com.docker") || command.includes("Docker.app");
}
