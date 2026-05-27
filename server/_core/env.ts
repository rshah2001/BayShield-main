import path from "path";
import dotenv from "dotenv";

const projectRoot = process.cwd();
dotenv.config({ path: path.resolve(projectRoot, ".env.local"), override: false });
dotenv.config({ path: path.resolve(projectRoot, ".env"), override: false });

export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl:
    process.env.BUILT_IN_FORGE_API_URL ??
    process.env.OPENAI_BASE_URL ??
    process.env.OPENAI_API_BASE ??
    "",
  forgeApiKey:
    process.env.BUILT_IN_FORGE_API_KEY ??
    process.env.OPENAI_API_KEY ??
    process.env.GEMINI_API_KEY ??
    process.env.GOOGLE_API_KEY ??
    "",
  llmModel:
    process.env.BUILT_IN_FORGE_MODEL ??
    process.env.OPENAI_MODEL ??
    process.env.GEMINI_MODEL ??
    process.env.GOOGLE_GENAI_MODEL ??
    "gemini-2.5-flash",
};
