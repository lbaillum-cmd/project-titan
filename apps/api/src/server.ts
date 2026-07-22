import { buildApp } from "./app.js";
import { validateEnvironment } from "./config.js";

const config = validateEnvironment(process.env);
const port = config.API_PORT;
const app = buildApp();

async function start() {
  try {
    await app.listen({ host: "0.0.0.0", port });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => { app.log.info({ signal }, "Graceful shutdown started"); void app.close().finally(() => process.exit(0)); });

void start();
