import "server-only";

const defaultSiteOrigin = "https://orbitalis.halmahera.site";

export const siteUrl = new URL("/", process.env.BETTER_AUTH_URL ?? defaultSiteOrigin);

export const siteDescription =
  "ORBITALIS reads NISAR radar to show where Jakarta sinks the fastest.";
