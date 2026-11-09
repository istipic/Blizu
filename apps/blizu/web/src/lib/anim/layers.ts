import type { FeatureCollection } from 'geojson';
import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import { floodStates, routeGradient, stateOpacity, timeRamp } from './flood';
import type { Coord } from './route';

/** Map colours chosen for contrast on the light map (green parks, grey blocks): navy near the address, vivid cyan-blue far away, orange moving front, white casing under every line. */
export const NEAR = '#0B2F8A';
export const FAR = '#009BD6';
export const FRONT = '#E8710A';

/** Layers go below the first symbol layer so that street and place labels stay on top. */
export function firstSymbolId(map: MapLibreMap): string | undefined {
  return map.getStyle()?.layers?.find((l) => l.type === 'symbol')?.id;
}

function removeAll(map: MapLibreMap, layers: string[], source: string) {
  for (const id of layers) if (map.getLayer(id)) map.removeLayer(id);
  if (map.getSource(source)) map.removeSource(source);
}

const OPACITY = { casing: 0.92, glow: 0.22, line: 1 } as const;
const DIMMED = { casing: 0.4, glow: 0.1, line: 0.5 } as const;
const FRONT_OPACITY = 0.95;

/** The same collection with numeric feature ids 0..n-1 (needed for feature-state). */
function withIds(data: FeatureCollection): FeatureCollection {
  return { ...data, features: data.features.map((f, i) => ({ ...f, id: i })) };
}

/**
 * Walking-time flood: casing + glow + crisp line + bright front, all driven by a clock in minutes.
 *
 * The clock only toggles feature-state flags (`on`, `front`) of the buckets whose state changed: no
 * filter or paint change per frame, so MapLibre never re-lays-out tiles while the flood moves and the
 * animation stays smooth. At most one state change per bucket and direction during a run.
 */
export class FloodLayer {
  private readonly ids = ['flood-casing', 'flood-glow', 'flood-line', 'flood-front'];
  private clockMin = 0;
  private ts: number[] = [];
  private on: boolean[] = [];
  private front: boolean[] = [];
  private frontVisible = true;

  constructor(
    private readonly map: MapLibreMap,
    data: FeatureCollection,
    private readonly maxMin: number,
  ) {
    const before = firstSymbolId(map);
    const ramp = timeRamp(maxMin, NEAR, FAR) as never;
    map.addSource('flood', { type: 'geojson', data: withIds(data) });
    this.reset(data);
    const width = (a: number, b: number) =>
      ['interpolate', ['linear'], ['zoom'], 11, a, 16, b] as never;
    const add = (id: string, paint: Record<string, unknown>) =>
      map.addLayer(
        {
          id,
          type: 'line',
          source: 'flood',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: paint as never,
        },
        before,
      );
    add('flood-casing', {
      'line-color': '#FFFFFF',
      'line-width': width(3.4, 8.6),
      'line-opacity': stateOpacity('on', OPACITY.casing),
    });
    add('flood-glow', {
      'line-color': ramp,
      'line-width': width(4, 16),
      'line-blur': 8,
      'line-opacity': stateOpacity('on', OPACITY.glow),
    });
    add('flood-line', {
      'line-color': ramp,
      'line-width': width(1.6, 4.6),
      'line-opacity': stateOpacity('on', OPACITY.line),
    });
    add('flood-front', {
      'line-color': FRONT,
      'line-width': width(1.6, 5),
      'line-blur': 1,
      'line-opacity': stateOpacity('front', FRONT_OPACITY),
    });
    this.setClock(0);
  }

  private reset(data: FeatureCollection) {
    this.ts = data.features.map((f) => Number((f.properties as { t?: number } | null)?.t ?? 0));
    this.on = this.ts.map(() => false);
    this.front = this.ts.map(() => false);
  }

  /** Writes only the flags that changed since the last call. */
  private apply(on: boolean[], front: boolean[]) {
    const m = this.map;
    if (!m.getSource('flood')) return;
    for (let i = 0; i < this.ts.length; i += 1) {
      const nextFront = this.frontVisible && front[i]!;
      if (on[i] !== this.on[i] || nextFront !== this.front[i]) {
        m.setFeatureState({ source: 'flood', id: i }, { on: on[i], front: nextFront });
        this.on[i] = on[i]!;
        this.front[i] = nextFront;
      }
    }
  }

  /** Reveals every street reached up to `min` minutes (the data itself comes from the API). */
  setClock(min: number) {
    this.clockMin = min;
    const { on, front } = floodStates(this.ts, min);
    this.apply(on, front);
  }

  /** Rests the front (static final state) or shows it again while animating. */
  setFrontVisible(visible: boolean) {
    this.frontVisible = visible;
    const { on, front } = floodStates(this.ts, this.clockMin);
    this.apply(on, front);
  }

  /** Dims the flood to ground light (used while a route is shown). */
  setDim(dim: boolean) {
    const v = dim ? DIMMED : OPACITY;
    const set = (id: string, value: number) => {
      if (this.map.getLayer(id))
        this.map.setPaintProperty(id, 'line-opacity', stateOpacity('on', value) as never);
    };
    set('flood-casing', v.casing);
    set('flood-glow', v.glow);
    set('flood-line', v.line);
  }

  get clock() {
    return this.clockMin;
  }
  get max() {
    return this.maxMin;
  }

  setData(data: FeatureCollection) {
    const source = this.map.getSource('flood') as GeoJSONSource | undefined;
    if (!source) return;
    this.map.removeFeatureState({ source: 'flood' });
    source.setData(withIds(data));
    this.reset(data);
    this.setClock(this.clockMin);
  }

  destroy() {
    removeAll(this.map, this.ids, 'flood');
  }
}

/** One route slot: lineMetrics source, a soft trail and the bright line whose gradient draws it. */
export class RouteLayer {
  private readonly ids: string[];

  constructor(
    private readonly map: MapLibreMap,
    private readonly id: string,
  ) {
    this.ids = [`${id}-trail`, `${id}-line`];
    const before = firstSymbolId(map);
    map.addSource(id, {
      type: 'geojson',
      lineMetrics: true,
      data: { type: 'FeatureCollection', features: [] },
    });
    map.addLayer(
      {
        id: `${id}-trail`,
        type: 'line',
        source: id,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-width': ['interpolate', ['linear'], ['zoom'], 12, 6, 17, 18] as never,
          'line-blur': 6,
          'line-gradient': routeGradient(0, 'rgba(26,115,232,0.35)') as never,
          'line-opacity-transition': { duration: 500, delay: 0 },
        },
      },
      before,
    );
    map.addLayer(
      {
        id: `${id}-line`,
        type: 'line',
        source: id,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-width': ['interpolate', ['linear'], ['zoom'], 12, 2.5, 17, 6] as never,
          'line-gradient': routeGradient(0, NEAR) as never,
          'line-opacity-transition': { duration: 500, delay: 0 },
        },
      },
      before,
    );
  }

  setCoordinates(coords: Coord[]) {
    (this.map.getSource(this.id) as GeoJSONSource | undefined)?.setData({
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: coords },
    });
  }

  /** Progress 0..1 of the drawn part: only the gradient stops move, the geometry stays. */
  setProgress(p: number) {
    if (!this.map.getLayer(`${this.id}-line`)) return;
    this.map.setPaintProperty(`${this.id}-line`, 'line-gradient', routeGradient(p, NEAR) as never);
    this.map.setPaintProperty(
      `${this.id}-trail`,
      'line-gradient',
      routeGradient(p, 'rgba(26,115,232,0.35)') as never,
    );
  }

  setOpacity(o: number) {
    for (const id of this.ids)
      if (this.map.getLayer(id)) this.map.setPaintProperty(id, 'line-opacity', o);
  }

  destroy() {
    removeAll(this.map, this.ids, this.id);
  }
}

/**
 * Real building footprints extruded with the tiles' own `render_height` / `render_min_height`.
 * The "liberty" style already ships an extrusion layer (`building-3d`); it is reused and faded in. If a style
 * has none, an equivalent layer is added below the first symbol layer.
 */
export class BuildingsLayer {
  static readonly OWN_ID = 'na-buildings';
  private readonly id: string;
  private readonly own: boolean;
  private readonly shownOpacity: number;

  constructor(private readonly map: MapLibreMap) {
    const existing = map.getLayer('building-3d');
    this.own = !existing;
    this.id = existing ? 'building-3d' : BuildingsLayer.OWN_ID;
    if (existing) {
      const current = map.getPaintProperty('building-3d', 'fill-extrusion-opacity');
      this.shownOpacity = typeof current === 'number' ? current : 0.8;
      map.setPaintProperty(
        'building-3d',
        'fill-extrusion-opacity-transition' as never,
        {
          duration: 900,
          delay: 0,
        } as never,
      );
      map.setPaintProperty('building-3d', 'fill-extrusion-opacity', 0);
      return;
    }
    this.shownOpacity = 0.85;
    if (map.getLayer(BuildingsLayer.OWN_ID)) return;
    map.addLayer(
      {
        id: BuildingsLayer.OWN_ID,
        type: 'fill-extrusion',
        source: 'openmaptiles',
        'source-layer': 'building',
        minzoom: 14,
        filter: ['!=', ['get', 'hide_3d'], true] as never, // parts of buildings drawn elsewhere
        paint: {
          'fill-extrusion-color': '#DADCE0',
          'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 0] as never,
          'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0] as never,
          'fill-extrusion-opacity': 0,
          'fill-extrusion-vertical-gradient': true,
          'fill-extrusion-opacity-transition': { duration: 900, delay: 0 },
        },
      },
      firstSymbolId(map),
    );
  }

  /** Fades the buildings in or out with the native paint transition (constant opacity, not data driven). */
  setVisible(visible: boolean) {
    if (this.map.getLayer(this.id))
      this.map.setPaintProperty(this.id, 'fill-extrusion-opacity', visible ? this.shownOpacity : 0);
  }

  destroy() {
    if (this.own && this.map.getLayer(this.id)) this.map.removeLayer(this.id);
    else if (!this.own && this.map.getLayer(this.id))
      this.map.setPaintProperty(this.id, 'fill-extrusion-opacity', this.shownOpacity);
  }
}
