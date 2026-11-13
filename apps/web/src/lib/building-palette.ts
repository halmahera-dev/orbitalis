import { resolveColor } from "@/lib/dither";

export type BuildingPalette = {
  walls: string[];
  roofs: string[];
  typeWalls: string[];
  typeRoofs: string[];
  trim: string;
  window: string;
  windowAlt: string;
  lit: string;
  park: string;
  canopy: string;
  canopyAlt: string;
  trunk: string;
  road: string;
  sidewalk: string;
  marking: string;
};

const wallInkShares = [8, 11, 14, 17, 20];

function hex(css: string) {
  const [red, green, blue] = resolveColor(css);
  const channels = [red, green, blue].map((channel) =>
    Math.round(channel * 255)
      .toString(16)
      .padStart(2, "0"),
  );
  return `#${channels.join("")}`;
}

function ink(share: number, base: string) {
  return hex(`color-mix(in srgb, var(--foreground) ${share}%, var(${base}))`);
}

function green(share: number, base: string) {
  return hex(`color-mix(in srgb, var(--rate-slow) ${share}%, var(${base}))`);
}

function warm(warmShare: number, inkShare: number, base: string) {
  return hex(
    `color-mix(in srgb, var(--chart-3) ${warmShare}%, color-mix(in srgb, var(--foreground) ${inkShare}%, var(${base})))`,
  );
}

function clay(redShare: number, inkShare: number, base: string) {
  return hex(
    `color-mix(in srgb, var(--destructive) ${redShare}%, color-mix(in srgb, var(--chart-3) 24%, color-mix(in srgb, var(--foreground) ${inkShare}%, var(${base}))))`,
  );
}

export function buildingPalette(): BuildingPalette {
  const isDark = document.documentElement.classList.contains("dark");
  if (isDark) {
    return {
      walls: wallInkShares.map((share) => ink(share, "--card")),
      roofs: wallInkShares.map((share) => ink(share + 8, "--card")),
      typeWalls: [
        warm(10, 30, "--card"),
        ink(34, "--card"),
        ink(28, "--card"),
        ink(36, "--card"),
        ink(13, "--card"),
      ],
      typeRoofs: [
        clay(34, 10, "--card"),
        warm(60, 30, "--card"),
        ink(15, "--card"),
        ink(22, "--card"),
        ink(19, "--card"),
      ],
      trim: ink(34, "--card"),
      window: ink(4, "--background"),
      windowAlt: ink(8, "--background"),
      lit: hex("--chart-3"),
      park: green(16, "--card"),
      canopy: green(46, "--card"),
      canopyAlt: green(62, "--card"),
      trunk: ink(26, "--card"),
      road: ink(7, "--card"),
      sidewalk: ink(17, "--card"),
      marking: ink(42, "--card"),
    };
  }
  return {
    walls: wallInkShares.map((share) => ink(share, "--card")),
    roofs: wallInkShares.map((share) => ink(share - 6, "--card")),
    typeWalls: [
      warm(12, 4, "--card"),
      ink(3, "--card"),
      ink(4, "--card"),
      ink(2, "--card"),
      ink(26, "--card"),
    ],
    typeRoofs: [
      clay(45, 6, "--background"),
      warm(70, 12, "--card"),
      ink(14, "--card"),
      ink(10, "--card"),
      ink(30, "--card"),
    ],
    trim: hex("--background"),
    window: ink(55, "--background"),
    windowAlt: ink(45, "--background"),
    lit: hex("--chart-3"),
    park: green(34, "--card"),
    canopy: green(78, "--background"),
    canopyAlt: green(100, "--background"),
    trunk: ink(40, "--card"),
    road: ink(16, "--card"),
    sidewalk: hex("--background"),
    marking: ink(8, "--card"),
  };
}
