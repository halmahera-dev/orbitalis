import {
  corners,
  cylinder,
  insetPlan,
  iso,
  planOutline,
  pointsAt,
  ring,
  rise,
  segment,
  type Plan,
  type Point3,
} from "@/components/iso/iso-kit";
import * as G from "@/components/iso/lathe.mjs";
import { Dots, Line, Solid } from "@/components/iso/react/draw";
import { Bench, FLOOR, Glow, P, frameAt, slab } from "@/features/landing/figures/bench";

const GROUND: Plan = { x: -52, y: -30, w: 104, d: 60, r: 12 };
const GROUND_TOP = FLOOR + 3;

function Ground() {
  const screws = corners(GROUND, 6).map((corner): Point3 => {
    return [corner[0], corner[1], GROUND_TOP];
  });
  return (
    <>
      {slab(GROUND, FLOOR, 3)}
      <Line d={planOutline(insetPlan(GROUND, 3), GROUND_TOP, P)} tone="faint" />
      <Dots points={pointsAt(screws, P)} size={0.5} tone="mid" />
    </>
  );
}

function House({
  x,
  y,
  z,
  w = 12,
  d = 10,
}: {
  x: number;
  y: number;
  z: number;
  w?: number;
  d?: number;
}) {
  const wall = 7;
  const roofFrame = G.frameOf([x, y + d / 2, z + wall], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
  const roof = [
    [-d / 2 - 1, 0],
    [d / 2 + 1, 0],
    [0, 5],
  ];
  return (
    <>
      {slab({ x, y, w, d, r: 0.4 }, z, wall)}
      <Solid paths={G.prismOf(roofFrame, roof, -1, w + 1, P)} tone="hi" />
      {slab({ x: x + w * 0.15, y: y + d, w: 2.8, d: 0.5, r: 0.1 }, z, 4.6, "lo")}
      {slab({ x: x + w * 0.6, y: y + d, w: 3.4, d: 0.5, r: 0.1 }, z + 2.4, 2.8, "lo")}
    </>
  );
}

function Tree({ x, y, height = 7 }: { x: number; y: number; height?: number }) {
  return (
    <>
      <Solid paths={cylinder(x, y, 1, GROUND_TOP, height, P, 10)} tone="lo" crease="none" />
      <Solid paths={G.sphereOf([x, y, GROUND_TOP + height + 3], 6, P)} tone="mid" />
    </>
  );
}

function Tank({
  x,
  y,
  radius,
  height,
  z = GROUND_TOP,
}: {
  x: number;
  y: number;
  radius: number;
  height: number;
  z?: number;
}) {
  return (
    <>
      <Solid paths={cylinder(x, y, radius, z, height, P, 28, 0.3)} tone="hi" />
      <Line d={ring(x, y, radius, z + height * 0.35, P, 28)} tone="lo" />
      <Line d={ring(x, y, radius, z + height * 0.7, P, 28)} tone="lo" />
      <Solid
        paths={cylinder(x, y, radius * 0.4, z + height, 1.4, P, 16)}
        tone="mid"
        crease="none"
      />
    </>
  );
}

function BowlStack({
  x,
  y,
  radius,
  tier,
  isLead = false,
}: {
  x: number;
  y: number;
  radius: number;
  tier: number;
  isLead?: boolean;
}) {
  const tiers = [1, 0.78, 0.56].map((share, index) => {
    const z = GROUND_TOP + tier * index;
    const isTop = index === 2;
    const solid = (
      <Solid
        paths={cylinder(x, y, radius * share, z, tier, P, 36, 0.3)}
        tone={isTop ? "hi" : "mid"}
      />
    );
    return <g key={index}>{isLead && isTop ? <Glow>{solid}</Glow> : solid}</g>;
  });
  return (
    <>
      {tiers}
      <Line d={ring(x, y, radius * 0.56, GROUND_TOP + tier * 3, P, 28)} tone="lo" />
    </>
  );
}

export function PumpsFigure({ label }: { label: string }) {
  const lead = { x: 24, y: 6, radius: 13, tier: 7 };
  const flagBase = GROUND_TOP + lead.tier * 3;
  const peg = (index: number): Plan => ({ x: -44 + index * 5, y: 24, w: 2.4, d: 2.4, r: 0.3 });
  return (
    <Bench hue="rose" id="q-pumps" label={label}>
      <Ground />
      <House x={-50} y={-14} z={GROUND_TOP} w={10} d={8} />
      <BowlStack x={-6} y={-16} radius={9} tier={3} />
      <BowlStack x={-30} y={12} radius={10} tier={4} />
      <Tank x={-2} y={22} radius={3.2} height={7} />
      <Solid paths={cylinder(-2, 22, 0.8, GROUND_TOP + 7, 5, P, 8)} tone="lo" crease="none" />
      <House x={38} y={-24} z={GROUND_TOP} w={10} d={8} />
      <Line d={ring(lead.x, lead.y, lead.radius + 5, GROUND_TOP, P, 48)} tone="faint" dotted />
      <Line d={ring(lead.x, lead.y, lead.radius + 9, GROUND_TOP, P, 48)} tone="faint" dotted />
      <BowlStack x={lead.x} y={lead.y} radius={lead.radius} tier={lead.tier} isLead />
      <Solid paths={cylinder(lead.x, lead.y, 0.4, flagBase, 15, P, 8)} tone="lo" crease="none" />
      {slab({ x: lead.x + 0.4, y: lead.y - 0.3, w: 7, d: 0.6, r: 0.1 }, flagBase + 10, 4, "hi")}
      {[0, 1, 2].map((index) => {
        return (
          <g key={index}>
            {slab(peg(index), GROUND_TOP, 1 + index * 1.4, index === 2 ? "hi" : "lo")}
          </g>
        );
      })}
    </Bench>
  );
}

export function RechargeFigure({ label }: { label: string }) {
  const aquifer: Plan = { x: -44, y: -26, w: 88, d: 52, r: 3 };
  const clay: Plan = { x: -38, y: -20, w: 76, d: 40, r: 3 };
  const soil: Plan = { x: -32, y: -14, w: 64, d: 28, r: 3 };
  const aquiferTop = FLOOR + 9;
  const clayTop = aquiferTop + 6;
  const soilTop = clayTop + 6;
  const well = { x: 32, y: 23 };
  const pores: [number, number][] = [
    [-12, -4],
    [-2, 4],
    [8, -3],
    [18, 5],
  ];
  const grains = [-40, -32, -24, -16, -8, 0, 8, 16, 24].flatMap((x): Point3[] => {
    return [
      [x, 23, aquiferTop],
      [x, 17.5, clayTop],
    ];
  });
  const clouds: [number, number, number][] = [
    [-14, -2, 6],
    [-4, 0, 8],
    [8, -1, 6.5],
  ];
  return (
    <Bench hue="blue" id="q-recharge" label={label}>
      <Glow>{slab(aquifer, FLOOR, 9)}</Glow>
      <Line d={planOutline(insetPlan(aquifer, 2), aquiferTop, P)} tone="faint" />
      <Dots points={pointsAt(grains, P)} size={0.45} tone="mid" />
      {slab(clay, aquiferTop, 6, "lo")}
      {slab(soil, clayTop, 6)}
      <Line d={ring(well.x, well.y, 5, aquiferTop, P, 28)} tone="faint" />
      <Line d={ring(well.x, well.y, 9, aquiferTop, P, 28)} tone="faint" dotted />
      {pores.map(([x, y]) => {
        return (
          <g key={x}>
            <Line d={ring(x, y, 1.8, soilTop, P, 14)} tone="lo" />
            <Dots points={pointsAt([[x, y, soilTop]], P)} size={0.7} tone="hi" />
            <Line d={segment([x, y, soilTop + 20], [x, y, soilTop + 1], P)} tone="hi" dotted />
          </g>
        );
      })}
      <Solid paths={cylinder(well.x, well.y, 2, aquiferTop, 18, P, 16)} tone="hi" />
      <Solid
        paths={cylinder(well.x, well.y, 3.2, aquiferTop, 1.6, P, 20)}
        tone="mid"
        crease="none"
      />
      <Solid paths={cylinder(well.x, well.y, 3.4, aquiferTop + 17, 2.4, P, 20)} tone="mid" />
      <Line d={ring(well.x, well.y, 4.6, aquiferTop + 20.8, P, 20)} tone="lo" />
      {clouds.map(([x, y, radius]) => {
        return <Solid key={x} paths={G.sphereOf([x, y, soilTop + 27], radius, P)} tone="hi" />;
      })}
    </Bench>
  );
}

export function PipesFigure({ label }: { label: string }) {
  const mainY = 10;
  const mainZ = GROUND_TOP + 4;
  const houseXs = [-24, -2, 20, 42];
  const alongX = G.frameOf([-37, mainY, mainZ], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
  const flanges = [-34, -12, 10, 32];
  const unservedX = houseXs[3];
  return (
    <Bench hue="cyan" id="q-pipes" label={label}>
      <Ground />
      <Tank x={-44} y={mainY} radius={7} height={18} />
      {houseXs.map((x, index) => {
        const branch = G.frameOf([x, mainY, mainZ], [0, -1, 0], [1, 0, 0], [0, 0, 1]);
        return (
          <g key={x}>
            <House x={x - 6} y={-22} z={GROUND_TOP} />
            {index < 3 ? (
              <>
                <Glow>
                  <Solid
                    paths={G.solidOf(
                      [
                        [0, 1.6],
                        [20, 1.6],
                      ],
                      branch,
                      P,
                    )}
                    tone="hi"
                  />
                </Glow>
                <Dots points={pointsAt([[x, -10, mainZ]], P)} size={0.9} tone="hi" />
              </>
            ) : null}
          </g>
        );
      })}
      <Line d={ring(unservedX, -3, 7, GROUND_TOP, P, 32)} tone="hi" dotted />
      <Solid paths={cylinder(unservedX, -5, 1.6, GROUND_TOP, 3, P, 14)} tone="mid" />
      <Solid
        paths={cylinder(unservedX, -5, 0.7, GROUND_TOP + 3, 8, P, 10)}
        tone="lo"
        crease="none"
      />
      {slab({ x: unservedX - 3.5, y: -5.4, w: 5, d: 0.8, r: 0.2 }, GROUND_TOP + 9.5, 1, "hi")}
      <Solid paths={cylinder(unservedX + 4.5, -2, 1.6, GROUND_TOP, 2.6, P, 12)} tone="lo" />
      <Glow>
        <Solid
          paths={G.solidOf(
            [
              [0, 3.2],
              [83, 3.2],
            ],
            alongX,
            P,
          )}
          tone="hi"
        />
      </Glow>
      {flanges.map((x) => {
        return (
          <Solid
            key={x}
            paths={G.solidOf(
              [
                [0, 4.2],
                [1.8, 4.2],
              ],
              G.frameOf([x, mainY, mainZ], [1, 0, 0], [0, 1, 0], [0, 0, 1]),
              P,
            )}
            tone="hi"
          />
        );
      })}
      {houseXs.slice(0, 3).map((x) => {
        return <Solid key={x} paths={G.sphereOf([x, mainY, mainZ], 2.8, P)} tone="mid" />;
      })}
    </Bench>
  );
}

export function WaterFarmingFigure({ label }: { label: string }) {
  const pond = { x: 22, y: 6 };
  const satellite = { x: 6, y: -4, z: 58 };
  const beamFrom: Point3 = [satellite.x, satellite.y, satellite.z - 5];
  const beamTo: Point3 = [pond.x, pond.y, GROUND_TOP + 1.5];
  const house = { x: -40, y: -22 };
  const houseTop = GROUND_TOP + 7;
  return (
    <Bench hue="green" id="q-farming" label={label}>
      <Ground />
      <Solid paths={cylinder(pond.x, pond.y, 13.4, GROUND_TOP, 1.2, P, 40, 0.3)} tone="lo" />
      <Glow>
        <Solid paths={cylinder(pond.x, pond.y, 12, GROUND_TOP + 1.2, 0.4, P, 40)} tone="hi" />
      </Glow>
      <Line d={ring(pond.x, pond.y, 7.5, GROUND_TOP + 1.7, P, 32)} tone="faint" />
      <Line d={ring(pond.x, pond.y, 3.5, GROUND_TOP + 1.7, P, 24)} tone="faint" />
      <Line d={ring(pond.x, pond.y, 17, GROUND_TOP, P, 48)} tone="faint" dotted />
      {[-30, -24, -18, -12, -6].map((x) => {
        return (
          <g key={x}>
            <Line d={ring(x, 4, 1.7, GROUND_TOP, P, 14)} tone="lo" />
            <Dots points={pointsAt([[x, 4, GROUND_TOP]], P)} size={0.7} tone="hi" />
          </g>
        );
      })}
      <House x={house.x} y={house.y} z={GROUND_TOP} w={16} d={12} />
      <Line
        d={segment([house.x, house.y + 12, houseTop], [house.x + 16, house.y + 12, houseTop], P)}
        tone="lo"
      />
      <Solid
        paths={G.solidOf(
          [
            [0, 0.8],
            [5.6, 0.8],
          ],
          G.frameOf([house.x + 16, -16, GROUND_TOP + 8], [1, 0, 0], [0, 1, 0], [0, 0, 1]),
          P,
        )}
        tone="lo"
        crease="none"
      />
      <Tank x={-14} y={-16} radius={4.5} height={11} />
      <Tree x={-42} y={18} />
      <Tree x={-22} y={22} height={5} />
      <Tree x={40} y={-18} height={8} />
      <Solid
        paths={cylinder(satellite.x, satellite.y, 2.2, satellite.z - 6, 4.5, P, 16)}
        tone="lo"
      />
      <Line d={segment(beamFrom, beamTo, P)} tone="hi" dotted />
      {slab(
        { x: satellite.x - 2, y: satellite.y - 20, w: 4, d: 14, r: 0.3 },
        satellite.z + 3.5,
        0.8,
        "mid",
      )}
      {slab(
        { x: satellite.x - 5, y: satellite.y - 3, w: 10, d: 6, r: 1 },
        satellite.z - 2,
        7,
        "hi",
      )}
      {slab(
        { x: satellite.x - 2, y: satellite.y + 6, w: 4, d: 14, r: 0.3 },
        satellite.z + 3.5,
        0.8,
        "mid",
      )}
      {[-16, -12, 9, 13, 17].map((offset) => {
        const y = satellite.y + offset;
        return (
          <Line
            key={offset}
            d={segment(
              [satellite.x - 2, y, satellite.z + 4.3],
              [satellite.x + 2, y, satellite.z + 4.3],
              P,
            )}
            tone="faint"
          />
        );
      })}
      <Dots
        points={pointsAt([[satellite.x, satellite.y, satellite.z + 5]], P)}
        size={0.9}
        tone="hi"
      />
    </Bench>
  );
}

export function ParcelFigure({ label }: { label: string }) {
  const parcel: Plan = { x: -36, y: -22, w: 72, d: 44, r: 0 };
  const stakeTop = GROUND_TOP + 8;
  const stakes: [number, number][] = [
    [-36, -22],
    [-36, 22],
    [36, -22],
    [36, 22],
  ];
  const stakeTopAt = ([x, y]: [number, number]): Point3 => [x, y, stakeTop];
  const [northWest, southWest, northEast, southEast] = stakes;
  const towerTop = GROUND_TOP + 30;
  const staff = { x: -31.5, y: 15, w: 3, d: 1.2, height: 36 };
  const rows = [
    GROUND_TOP + 12,
    GROUND_TOP + 16,
    GROUND_TOP + 20,
    GROUND_TOP + 24,
    GROUND_TOP + 28,
  ];

  function stake([x, y]: [number, number]) {
    return (
      <>
        <Solid paths={cylinder(x, y, 0.9, GROUND_TOP, 8, P, 10)} tone="lo" crease="none" />
        <Glow>
          <Solid paths={cylinder(x, y, 1.4, stakeTop, 1.2, P, 12)} tone="hi" />
        </Glow>
      </>
    );
  }

  function string(from: [number, number], to: [number, number]) {
    return <Line d={segment(stakeTopAt(from), stakeTopAt(to), P)} tone="mid" />;
  }

  return (
    <Bench hue="amber" id="q-parcel" label={label}>
      <Ground />
      <Glow>
        <Solid paths={cylinder(-30, 16, 11, GROUND_TOP, 1.2, P, 36)} tone="hi" />
      </Glow>
      <Line d={planOutline(parcel, GROUND_TOP, P)} tone="hi" dashed />
      {stake(northWest)}
      {string(northWest, northEast)}
      {string(northWest, southWest)}
      {stake(southWest)}
      {stake(northEast)}
      {slab({ x: -18, y: -12, w: 34, d: 24, r: 1 }, GROUND_TOP, 8)}
      {slab({ x: -8, y: -8, w: 16, d: 14, r: 0.6 }, GROUND_TOP + 8, 22, "hi")}
      {rows.map((z) => {
        return (
          <g key={z}>
            <Line d={segment([-6.5, 6, z], [6.5, 6, z], P)} tone="lo" />
            <Line d={segment([8, -6.5, z], [8, 5.5, z], P)} tone="lo" />
          </g>
        );
      })}
      {[-3, 0, 3].map((x) => {
        return <Line key={x} d={rise([x, 6], GROUND_TOP + 10, towerTop - 2, P)} tone="faint" />;
      })}
      <Line d={planOutline({ x: -6, y: -6, w: 12, d: 10, r: 0 }, towerTop, P)} tone="faint" />
      {string(northEast, southEast)}
      {string(southWest, southEast)}
      {stake(southEast)}
      {slab(
        { x: staff.x, y: staff.y, w: staff.w, d: staff.d, r: 0.2 },
        GROUND_TOP,
        staff.height,
        "mid",
      )}
      {Array.from({ length: 9 }, (_, index) => {
        const z = GROUND_TOP + 4 + index * 3.6;
        const half = index % 2 === 0 ? 1.4 : 0.8;
        const middle = staff.x + staff.w / 2;
        return (
          <Line
            key={index}
            d={segment(
              [middle - half, staff.y + staff.d, z],
              [middle + half, staff.y + staff.d, z],
              P,
            )}
            tone={index % 2 === 0 ? "mid" : "lo"}
          />
        );
      })}
      <Glow>
        {slab({ x: staff.x - 2, y: staff.y - 0.5, w: 7, d: 2.2, r: 0.3 }, GROUND_TOP + 11, 1.6)}
      </Glow>
      {[
        [21, 12],
        [32, 10],
        [28, 22],
      ].map(([x, y]) => {
        return (
          <Line key={x} d={segment([28, 15, GROUND_TOP + 16], [x, y, GROUND_TOP], P)} tone="mid" />
        );
      })}
      <Solid paths={cylinder(28, 15, 2.6, GROUND_TOP + 16, 2.5, P, 20)} tone="mid" />
      {slab({ x: 24, y: 14, w: 8, d: 2, r: 0.6 }, GROUND_TOP + 18.5, 2.4, "hi")}
    </Bench>
  );
}

const TILE_HEIGHTS = [
  [2, 3, 4],
  [2, 7, 5],
  [1, 3, 4],
];

export function AreaCheckFigure({ label }: { label: string }) {
  const tiles = TILE_HEIGHTS.flatMap((row, j) => {
    return row.map((height, i) => {
      return {
        plan: { x: -42 + i * 28, y: -27 + j * 19, w: 25, d: 16, r: 1.4 } as Plan,
        height,
        isCenter: i === 1 && j === 1,
      };
    });
  }).sort((a, b) => {
    return a.plan.x + a.plan.y - (b.plan.x + b.plan.y);
  });
  const centerIndex = tiles.findIndex((tile) => tile.isCenter);
  const center = tiles[centerIndex];
  const centerTop = FLOOR + center.height;
  const pin = { x: center.plan.x + 18, y: center.plan.y + 11 };
  const pinFrame = frameAt(pin.x, pin.y, centerTop);

  function tile({ plan, height, isCenter }: (typeof tiles)[number]) {
    const solid = slab(plan, FLOOR, height, height > 3 ? "mid" : "lo");
    return <g key={`${plan.x}${plan.y}`}>{isCenter ? <Glow>{solid}</Glow> : solid}</g>;
  }

  return (
    <Bench hue="violet" id="q-area" label={label}>
      {tiles.slice(0, centerIndex).map(tile)}
      {tile(center)}
      <House x={center.plan.x + 1.5} y={center.plan.y + 1.5} z={centerTop} w={8} d={6} />
      <Line d={ring(pin.x, pin.y, 4.2, centerTop, P, 32)} tone="hi" dotted />
      <Solid
        paths={G.solidOf(
          [
            [0, 0.3],
            [7, 2.6, 1],
            [10.5, 3.6],
            [13.5, 2.6, 1],
            [15, 0.4],
          ],
          pinFrame,
          P,
        )}
        tone="hi"
      />
      <Dots points={[iso([pin.x, pin.y, centerTop + 14.6], P)]} size={0.9} tone="lo" />
      {tiles.slice(centerIndex + 1).map(tile)}
    </Bench>
  );
}
