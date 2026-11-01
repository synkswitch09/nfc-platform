import { assistantConfig } from "../lib/assistants/config";
import { getRuntimeConfig } from "../lib/config";

const config = getRuntimeConfig();
const assistant = assistantConfig();
console.info(JSON.stringify({ status: "valid", environment: config.appEnv, appUrl: config.appUrl, assistantOrigin: assistant.origin, assistantEnabled: assistant.launchEnabled, claudeConfigured: Boolean(assistant.anthropicApiKey), storageProvider: config.storage.provider, emailMode: config.email.mode }));
