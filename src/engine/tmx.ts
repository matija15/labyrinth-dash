import type { RoomDef, SawDef } from '../types';
import { TILE } from './constants';

/**
 * Tile chars by tileset index (gid - firstgid). Build your Tiled tileset in this order
 * (or pass a custom mapping) so `.tmx` maps can be loaded as rooms.
 */
export const DEFAULT_TMX_TILESET = ['#', '^', 'v', '<', '>', '=', 'K', 'D', 'O', 'J', 'S', 'G', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

const attr = (src: string, name: string) => {
  const m = new RegExp(`\\b${name}="([^"]*)"`).exec(src);
  return m ? m[1] : undefined;
};

/**
 * Minimal Tiled `.tmx` (XML) parser: reads the first CSV-encoded tile layer as room tiles and
 * an optional object layer where objects of type/class `saw` become sawblades
 * (polyline → path saw, ellipse/point with `orbit` property → orbit saw).
 */
export function parseTmxRoom(xml: string, opts: { id: string; x: number; y: number; tileset?: string[] }): RoomDef {
  const tileset = opts.tileset ?? DEFAULT_TMX_TILESET;
  const mapTag = /<map\b[^>]*>/.exec(xml)?.[0] ?? '';
  const width = Number(attr(mapTag, 'width'));
  const height = Number(attr(mapTag, 'height'));
  const tilePx = Number(attr(mapTag, 'tilewidth') ?? TILE);
  const firstgid = Number(attr(/<tileset\b[^>]*>/.exec(xml)?.[0] ?? '', 'firstgid') ?? 1);
  const data = /<data[^>]*encoding="csv"[^>]*>([\s\S]*?)<\/data>/.exec(xml);
  if (!width || !height || !data) throw new Error('TMX: expected a map with a CSV-encoded tile layer');
  const gids = data[1].split(',').map((s) => Number(s.trim()) & 0x1fffffff);
  if (gids.length !== width * height) throw new Error(`TMX: expected ${width * height} tiles, got ${gids.length}`);

  const tiles: string[] = [];
  for (let y = 0; y < height; y++) {
    let row = '';
    for (let x = 0; x < width; x++) {
      const gid = gids[y * width + x];
      row += gid === 0 ? '.' : (tileset[gid - firstgid] ?? '#');
    }
    tiles.push(row);
  }

  const saws: SawDef[] = [];
  const objRe = /<object\b([^>]*?)(\/>|>([\s\S]*?)<\/object>)/g;
  let m: RegExpExecArray | null;
  while ((m = objRe.exec(xml))) {
    const head = m[1];
    const body = m[3] ?? '';
    const type = attr(head, 'type') ?? attr(head, 'class');
    if (type !== 'saw') continue;
    const ox = Number(attr(head, 'x') ?? 0) / tilePx;
    const oy = Number(attr(head, 'y') ?? 0) / tilePx;
    const prop = (name: string) => {
      const p = new RegExp(`<property[^>]*name="${name}"[^>]*value="([^"]*)"`).exec(body);
      return p ? Number(p[1]) : undefined;
    };
    const radius = prop('radius') ?? 0.8;
    const speed = prop('speed') ?? 3;
    const poly = /<polyline[^>]*points="([^"]*)"/.exec(body);
    if (poly) {
      const points = poly[1].trim().split(/\s+/).map((pair) => {
        const [px, py] = pair.split(',').map(Number);
        return [ox + px / tilePx, oy + py / tilePx] as [number, number];
      });
      saws.push({ kind: 'path', points, speed, radius, mode: prop('loop') ? 'loop' : 'pingpong' });
    } else {
      saws.push({ kind: 'orbit', center: [ox, oy], orbitRadius: prop('orbit') ?? 2, angularSpeed: speed, radius });
    }
  }

  return { id: opts.id, x: opts.x, y: opts.y, tiles, saws };
}
