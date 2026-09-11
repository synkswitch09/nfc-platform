import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { unlink, writeFile } from "node:fs/promises";

const origin = process.env.TAPKIN_PRINT_AGENT_URL?.replace(/\/$/, "");
const token = process.env.TAPKIN_PRINT_AGENT_TOKEN;
const command = process.env.TAPKIN_PRINT_COMMAND;
const printer = process.env.TAPKIN_PRINTER_NAME ?? "";
const interval = Math.max(2_000, Number(process.env.TAPKIN_PRINT_POLL_MS ?? 5_000));
let argumentTemplate;
try { argumentTemplate = JSON.parse(process.env.TAPKIN_PRINT_ARGS_JSON ?? '["{file}"]'); } catch { throw new Error("TAPKIN_PRINT_ARGS_JSON must be a JSON string array"); }
if (!origin || !token || !command || !Array.isArray(argumentTemplate) || argumentTemplate.some(value => typeof value !== "string")) throw new Error("Set TAPKIN_PRINT_AGENT_URL, TAPKIN_PRINT_AGENT_TOKEN, TAPKIN_PRINT_COMMAND and a valid TAPKIN_PRINT_ARGS_JSON array");

function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function runPrint(file) {
  const args = argumentTemplate.map(value => value.replaceAll("{file}", file).replaceAll("{printer}", printer));
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { shell: false, stdio: "inherit", windowsHide: true });
    child.once("error", reject);
    child.once("exit", code => code === 0 ? resolve() : reject(new Error(`Print command exited with ${code}`)));
  });
}

async function request(path, init = {}) {
  return fetch(`${origin}${path}`, { ...init, headers: { authorization: `Bearer ${token}`, ...(init.headers ?? {}) } });
}

async function poll() {
  const claimed = await request("/api/print-agent/claim", { method: "POST" });
  if (claimed.status === 204) return;
  if (!claimed.ok) throw new Error(`Print queue returned ${claimed.status}`);
  const { job } = await claimed.json();
  const document = await request(job.documentUrl, { headers: { "x-print-lease": job.leaseToken } });
  if (!document.ok) throw new Error(`Label download returned ${document.status}`);
  const file = join(tmpdir(), `tapkin-label-${randomUUID()}.pdf`);
  let success = false; let errorMessage;
  try {
    await writeFile(file, Buffer.from(await document.arrayBuffer()), { flag: "wx", mode: 0o600 });
    for (let copy = 0; copy < job.copies; copy += 1) await runPrint(file);
    success = true;
  } catch (error) {
    errorMessage = error instanceof Error ? error.message.slice(0, 500) : "Print failed";
  } finally {
    await unlink(file).catch(() => undefined);
    await request("/api/print-agent/complete", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jobId: job.id, leaseToken: job.leaseToken, success, errorMessage }) });
  }
}

console.info("Tapkin Print Agent is running. Credentials are not logged.");
for (;;) {
  try { await poll(); } catch (error) { console.error(error instanceof Error ? error.message : "Print agent error"); }
  await delay(interval);
}
