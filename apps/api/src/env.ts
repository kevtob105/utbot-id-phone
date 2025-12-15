import "dotenv/config";

export const env = {
  API_PORT: parseInt(process.env.API_PORT ?? "4000", 10),
  POLL_INTERVAL_MS: parseInt(process.env.POLL_INTERVAL_MS ?? "2000", 10),
  TIMEFRAME: (process.env.TIMEFRAME ?? "1m") as "1m",
  UT_A: parseFloat(process.env.UT_A ?? "1"),
  UT_C: parseInt(process.env.UT_C ?? "10", 10),
  UT_USE_HEIKIN: (process.env.UT_USE_HEIKIN ?? "false").toLowerCase() === "true",
  SMTP_HOST: process.env.SMTP_HOST ?? "",
  SMTP_PORT: parseInt(process.env.SMTP_PORT ?? "587", 10),
  SMTP_USER: process.env.SMTP_USER ?? "",
  SMTP_PASS: process.env.SMTP_PASS ?? "",
  SMTP_FROM: process.env.SMTP_FROM ?? "UT Bot <no-reply@example.com>"
};
