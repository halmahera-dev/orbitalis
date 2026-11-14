import "server-only";
import { env } from "@repo/env/server";

export const siteUrl = new URL("/", env.BETTER_AUTH_URL);

export const siteDescription =
  "PRIOKA reads NISAR radar to show where North Jakarta sinks the fastest.";
