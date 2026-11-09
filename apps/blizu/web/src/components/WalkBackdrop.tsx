import { useMemo, type CSSProperties } from 'react';
import { FAR, FRONT, NEAR } from '../lib/anim/layers';
import type { IsochroneResult } from '../lib/types';

/** "#RRGGBB" -> [r, g, b]. */
function hexRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * Colour of a street reached after `share` (0..1) of the time limit: the same linear navy -> cyan
 * ramp as the walking-time flood on the results map (`NEAR`/`FAR` in lib/anim/layers.ts).
 */
export function rampColor(share: number): string {
  const f = Math.min(1, Math.max(0, share));
  const a = hexRgb(NEAR);
  const b = hexRgb(FAR);
  const c = a.map((v, i) => Math.round(v + (b[i]! - v) * f));
  return `rgb(${c[0]} ${c[1]} ${c[2]})`;
}

export interface BackdropPath {
  t: number;
  d: string;
  color: string;
}

/** True when the value has the shape of a `GET /api/v1/isochrone` response. */
export function isIsochrone(value: unknown): value is IsochroneResult {
  const v = value as Partial<IsochroneResult> | null | undefined;
  return (
    !!v &&
    typeof v.max_min === 'number' &&
    !!v.origin &&
    typeof v.origin.lon === 'number' &&
    Array.isArray(v.buckets?.features)
  );
}

/**
 * Projects the isochrone buckets to SVG paths in metres around the origin (equirectangular is exact
 * enough for a few kilometres). One path per 0.25-minute bucket, coloured by its walking time.
 */
export function isochronePaths(data: IsochroneResult): { paths: BackdropPath[]; extent: number } {
  const { lon: lon0, lat: lat0 } = data.origin;
  const metresPerDegree = 111_320;
  const kx = Math.cos((lat0 * Math.PI) / 180) * metresPerDegree;
  let extent = 1;
  const paths: BackdropPath[] = [];
  for (const feature of data.buckets.features) {
    let d = '';
    for (const line of feature.geometry.coordinates) {
      line.forEach((pos, i) => {
        const x = (pos[0]! - lon0) * kx;
        const y = (lat0 - pos[1]!) * metresPerDegree;
        extent = Math.max(extent, Math.abs(x), Math.abs(y));
        d += `${i === 0 ? 'M' : 'L'}${x.toFixed(0)} ${y.toFixed(0)}`;
      });
    }
    const t = feature.properties.t;
    paths.push({ t, d, color: rampColor(t / data.max_min) });
  }
  return { paths, extent };
}

/** Start of a street's animation: the flood takes 2.4 s from the address to the time limit. */
function delay(t: number, maxMin: number): string {
  return `${((t / maxMin) * 2.4).toFixed(2)}s`;
}

/**
 * Background of the home hero: the real streets reachable on foot from the example address within
 * the time limit (from `GET /api/v1/isochrone`), drawn outwards in walking-time order. Without data
 * it renders only the plain dotted canvas, never invented streets.
 */
export function WalkBackdrop({ data }: { data: IsochroneResult | undefined }) {
  const built = useMemo(() => (isIsochrone(data) ? isochronePaths(data) : null), [data]);
  if (!built || !data) return <div className="na-backdrop" aria-hidden="true" />;
  const extent = built.extent * 1.15;
  return (
    <div className="na-backdrop" aria-hidden="true" data-testid="walk-backdrop">
      <svg
        key={data.persona}
        viewBox={`${-extent} ${-extent} ${2 * extent} ${2 * extent}`}
        preserveAspectRatio="xMidYMid slice"
      >
        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          {/* white casing under every street, as on the results map */}
          {built.paths.map((p) => (
            <path
              key={`c${p.t}`}
              d={p.d}
              className="na-backdrop__casing"
              style={{ animationDelay: delay(p.t, data.max_min) }}
            />
          ))}
          {/* streets light up orange (the moving front) and settle on their walking-time colour */}
          {built.paths.map((p) => (
            <path
              key={p.t}
              d={p.d}
              stroke={p.color}
              className="na-backdrop__street"
              style={
                {
                  '--street': p.color,
                  '--front': FRONT,
                  animationDelay: delay(p.t, data.max_min),
                } as CSSProperties
              }
            />
          ))}
        </g>
        {/* decorative: marks the example address */}
        <circle r={extent * 0.05} className="na-backdrop__pulse" />
        <circle r={extent * 0.012} className="na-backdrop__pin" />
      </svg>
    </div>
  );
}
