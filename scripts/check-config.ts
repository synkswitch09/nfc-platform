import { getRuntimeConfig } from "../lib/config";

const config = getRuntimeConfig();
console.info(JSON.stringify({ status: "valid", environment: config.appEnv, appUrl: config.appUrl, storageProvider: config.storage.provider, emailMode: config.email.mode }));
