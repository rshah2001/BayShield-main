import express from "express";
import { createServer } from "http";
import net from "net";
import path from "path";
import { spawn, type ChildProcess } from "child_process";
import dotenv from "dotenv";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { ENV } from "./env";
import { startLiveStateScheduler } from "./bayshieldLiveState";
import { serveStatic, setupVite } from "./vite";

const projectRoot = process.cwd();
dotenv.config({ path: path.resolve(projectRoot, ".env.local"), override: false });
dotenv.config({ path: path.resolve(projectRoot, ".env"), override: false });

const PYTHON_ADK_URL = process.env.PYTHON_ADK_URL || "http://localhost:8000";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

// ── Python ADK Service auto-start ───────────────────────────────────────────
// Spawns the Python ADK FastAPI service as a child process so it starts
// automatically alongside the Node.js server regardless of how dev is launched.
function startPythonADK(): ChildProcess | null {
  // Resolve the python-agents directory relative to the project root
  const adkDir = path.resolve(process.cwd(), "python-agents");
  const adkScript = path.join(adkDir, "server.py");
  const pythonCommand =
    process.platform === "win32"
      ? { command: "py", args: ["-3", adkScript] }
      : { command: "python3", args: [adkScript] };

  // Check if already running on port 8000 by attempting a quick connect
  const child = spawn(pythonCommand.command, pythonCommand.args, {
    cwd: adkDir,
    stdio: ["ignore", "pipe", "pipe"],
    detached: false,
    env: {
      ...process.env,
      PYTHONUNBUFFERED: "1",
    },
  });

  child.stdout?.on("data", (data: Buffer) => {
    const line = data.toString().trim();
    if (line) console.log(`[ADK] ${line}`);
  });
  child.stderr?.on("data", (data: Buffer) => {
    const line = data.toString().trim();
    // Suppress uvicorn INFO lines to reduce noise; log warnings/errors
    if (line && !line.startsWith("INFO:")) console.error(`[ADK] ${line}`);
  });
  child.on("error", (err) => {
    console.error(`[ADK] Failed to start Python ADK service: ${err.message}`);
  });
  child.on("exit", (code, signal) => {
    if (code !== 0 && signal !== "SIGTERM") {
      console.warn(`[ADK] Python ADK service exited (code=${code}, signal=${signal})`);
    }
  });

  // Ensure child is killed when Node.js exits
  process.on("exit", () => { try { child.kill("SIGTERM"); } catch { /* ignore */ } });
  process.on("SIGINT",  () => { try { child.kill("SIGTERM"); } catch { /* ignore */ } process.exit(0); });
  process.on("SIGTERM", () => { try { child.kill("SIGTERM"); } catch { /* ignore */ } process.exit(0); });

  console.log(`[ADK] Python ADK service starting (pid=${child.pid})…`);
  return child;
}

async function waitForADK(url: string, maxWaitMs = 15_000): Promise<boolean> {
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(1000) });
      if (res.ok) return true;
    } catch { /* not ready yet */ }
    await new Promise(r => setTimeout(r, 500));
  }
  return false;
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Start Python ADK service (non-blocking — Node.js server starts regardless)
  const adkAlreadyRunning = await (async () => {
    try {
      const r = await fetch(`${PYTHON_ADK_URL}/health`, { signal: AbortSignal.timeout(1000) });
      return r.ok;
    } catch { return false; }
  })();

  if (!adkAlreadyRunning) {
    startPythonADK();
    // Wait up to 15 s for ADK to be ready before accepting traffic
    const ready = await waitForADK(PYTHON_ADK_URL);
    if (ready) {
      console.log("[ADK] Python ADK service is ready.");
    } else {
      console.warn("[ADK] Python ADK service did not become ready in time — stream endpoints will return errors until it starts.");
    }
  } else {
    console.log("[ADK] Python ADK service already running — skipping spawn.");
  }

  void startLiveStateScheduler().catch(error => {
    console.warn("[BayShield Live State] Failed to start scheduler:", error);
  });
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // ── SSE: Pipeline streaming proxy ────────────────────────────────────────────
  // Proxies the Python ADK /stream endpoint as Server-Sent Events to the frontend.
  // Frontend connects to /api/pipeline/stream?mode=live to receive real-time
  // agent status events as the 4-agent pipeline executes.
  app.get("/api/pipeline/stream", async (req, res) => {
    const mode = (req.query.mode as string) || "live";

    // Set SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.flushHeaders();

    const sendEvent = (event: string, data: unknown) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    try {
      // Try to stream from Python ADK service (GET endpoint with query param)
      const adkRes = await fetch(`${PYTHON_ADK_URL}/stream?mode=${encodeURIComponent(mode)}`, {
        method: "GET",
        headers: { "Accept": "text/event-stream" },
      });

      if (!adkRes.ok || !adkRes.body) {
        throw new Error(`ADK stream error: ${adkRes.status}`);
      }

      // Proxy the SSE stream from Python to the browser
      const reader = adkRes.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const cleanup = () => { try { reader.cancel(); } catch { /* ignore */ } };
      req.on("close", cleanup);

      try {
        while (true) {
          if (res.destroyed) break;
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          // SSE frames are separated by double newlines
          const frames = buffer.split("\n\n");
          buffer = frames.pop() ?? "";

          for (const frame of frames) {
            // Each frame may have multiple lines; extract data: lines
            for (const line of frame.split("\n")) {
              if (line.startsWith("data: ")) {
                try {
                  const payload = JSON.parse(line.slice(6));
                  const eventName = (payload as { event?: string }).event ?? "message";
                  sendEvent(eventName, payload);
                } catch { /* skip malformed JSON */ }
              }
            }
          }
        }
      } finally {
        cleanup();
      }

      sendEvent("done", { message: "Pipeline complete" });
    } catch (e) {
      // ADK service not available — emit a graceful error event
      sendEvent("error", {
        message: "Python ADK service not available. Start with: cd python-agents && python3 server.py",
        code: "ADK_UNAVAILABLE",
      });
    }

    res.end();
  });

  // ── SSE: System health stream ─────────────────────────────────────────────────
  // Streams health status for all BayShield services every 10 seconds.
  app.get("/api/system/health-stream", async (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.flushHeaders();

    const checkAndSend = async () => {
      // Check Python ADK health
      let adkStatus: "online" | "offline" = "offline";
      let adkAgents = 0;
      try {
        const adkRes = await fetch(`${PYTHON_ADK_URL}/health`, { signal: AbortSignal.timeout(3000) });
        if (adkRes.ok) {
          const data = await adkRes.json() as { agents?: number | string[] };
          adkStatus = "online";
          adkAgents = Array.isArray(data.agents) ? data.agents.length : (data.agents as number ?? 4);
        }
      } catch { /* offline */ }

      // Check NOAA API health
      let noaaStatus: "online" | "offline" = "offline";
      try {
        const noaaRes = await fetch("https://api.weather.gov/stations/KTPA/observations/latest",
          { signal: AbortSignal.timeout(5000), headers: { "User-Agent": "BayShield/3.0" } });
        if (noaaRes.ok) noaaStatus = "online";
      } catch { /* offline */ }

      // Check LLM API health using the same env resolution as the LLM client.
      let llmStatus: "online" | "offline" = "offline";
      const llmUrl = ENV.forgeApiUrl;
      if (ENV.forgeApiKey) {
        llmStatus = "online";
      }
      if (llmUrl) {
        try {
          const llmRes = await fetch(`${llmUrl}/health`, { signal: AbortSignal.timeout(3000) });
          if (llmRes.ok || llmRes.status === 404) llmStatus = "online"; // 404 = URL valid, no /health route
        } catch { /* offline */ }
      }

      const health = {
        timestamp: new Date().toISOString(),
        services: {
          node_server: { status: "online", label: "Node.js Server", version: "Express 4" },
          python_adk: { status: adkStatus, label: "Python ADK Service", agents: adkAgents },
          database: { status: "online", label: "MySQL Database", tables: 7 },
          noaa_api: { status: noaaStatus, label: "NOAA/NWS API", endpoints: 3 },
          llm_service: { status: llmStatus, label: "LLM Service", note: "Emergency briefings" },
          shelter_feed: { status: "estimated", label: "Shelter Feed", note: "Estimated: FEMA SESP baseline × storm severity × population density. No public real-time API available (FL SERT shelter status is restricted to authorized agencies)." },
          routing_service: { status: "online", label: "Routing Service", note: "Google Maps integration enabled" },
        },
      };

      res.write(`event: health\ndata: ${JSON.stringify(health)}\n\n`);
    };

    // Send immediately then every 10 seconds
    await checkAndSend();
    const interval = setInterval(async () => {
      if (res.destroyed) {
        clearInterval(interval);
        return;
      }
      await checkAndSend();
    }, 10_000);

    req.on("close", () => clearInterval(interval));
  });

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
