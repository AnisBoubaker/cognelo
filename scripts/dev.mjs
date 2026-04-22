import { spawn, spawnSync } from "node:child_process";
import process from "node:process";

const services = [
  {
    name: "api",
    port: 3001,
    command: "npm",
    args: ["run", "dev", "--workspace", "@cognelo/api"]
  },
  {
    name: "web",
    port: 3000,
    command: "npm",
    args: ["run", "dev", "--workspace", "@cognelo/web"]
  }
];

function findPortListeners(port) {
  const result = spawnSync("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"], {
    encoding: "utf8"
  });

  if (result.status !== 0 && !result.stdout.trim()) {
    return [];
  }

  return result.stdout
    .split("\n")
    .map((value) => value.trim())
    .filter(Boolean);
}

const blockedServices = services
  .map((service) => ({
    ...service,
    listeners: findPortListeners(service.port)
  }))
  .filter((service) => service.listeners.length > 0);

if (blockedServices.length > 0) {
  const lines = blockedServices.map(
    (service) => `Port ${service.port} is already in use by PID${service.listeners.length > 1 ? "s" : ""} ${service.listeners.join(", ")}.`
  );
  console.error(lines.join("\n"));
  console.error("Stop the existing dev servers first, or run `npm run dev:stop`.");
  process.exit(1);
}

const children = [];
let shuttingDown = false;

function shutdown(exitCode = 0) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;

  for (const child of children) {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  }

  setTimeout(() => {
    for (const child of children) {
      if (!child.killed) {
        child.kill("SIGKILL");
      }
    }
  }, 1500).unref();

  setTimeout(() => {
    process.exit(exitCode);
  }, 1600).unref();
}

for (const service of services) {
  const child = spawn(service.command, service.args, {
    stdio: "inherit",
    shell: true,
    env: process.env
  });

  children.push(child);

  child.on("exit", (code, signal) => {
    if (shuttingDown) {
      return;
    }

    if (signal) {
      console.error(`${service.name} exited from signal ${signal}.`);
      shutdown(1);
      return;
    }

    if ((code ?? 0) !== 0) {
      console.error(`${service.name} exited with code ${code}.`);
      shutdown(code ?? 1);
      return;
    }

    shutdown(0);
  });
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
