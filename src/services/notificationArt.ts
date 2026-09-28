/**
 * Notification artwork — the mascot droplet, filled to today's level, drawn
 * offscreen with Skia and saved as a PNG for the notification to attach.
 *
 * It is the same silhouette, liquid gradient and face as the Home mascot, just
 * frozen, so a reminder shows at a glance how full the day's glass is.
 * Attachments are an iOS feature; Android shows the text only.
 */

import {
  ClipOp,
  ImageFormat,
  PaintStyle,
  Skia,
  StrokeCap,
  TileMode,
  vec,
} from '@shopify/react-native-skia';
import { File, Paths } from 'expo-file-system';

import { palette } from '@/theme';

const DROPLET_SVG =
  'M50 6 C50 6 82 42 82 62 C82 80 68 92 50 92 C32 92 18 80 18 62 C18 42 50 6 50 6 Z';
const HIGHLIGHT_SVG = 'M34 42 C28 52 27 61 29 69 C22 62 24 50 34 42 Z';
const TOP = 6;
const BOTTOM = 92;
const SPAN = BOTTOM - TOP + 5;
const SIZE = 240;

const cache = new Map<number, string>();

/** Base64 PNG of the droplet at `fill` (0–1), cached per 5% step. */
export function renderDropletBase64(fill: number): string | null {
  const step = Math.round(Math.max(0, Math.min(fill, 1)) * 20) / 20;
  const hit = cache.get(step);
  if (hit) return hit;

  try {
    const surface = Skia.Surface.Make(SIZE, SIZE);
    if (!surface) return null;
    const canvas = surface.getCanvas();
    const droplet = Skia.Path.MakeFromSVGString(DROPLET_SVG);
    const highlight = Skia.Path.MakeFromSVGString(HIGHLIGHT_SVG);
    if (!droplet || !highlight) return null;

    const paint = () => {
      const p = Skia.Paint();
      p.setAntiAlias(true);
      return p;
    };
    const gradient = (x0: number, y0: number, x1: number, y1: number, colors: string[]) =>
      Skia.Shader.MakeLinearGradient(vec(x0, y0), vec(x1, y1), colors.map((c) => Skia.Color(c)), null, TileMode.Clamp);

    canvas.drawColor(Skia.Color(palette.ink900));
    // Centre the 100-unit droplet with a little breathing room.
    canvas.translate(SIZE * 0.06, SIZE * 0.05);
    canvas.scale((SIZE * 0.88) / 100, (SIZE * 0.88) / 100);

    // Empty body.
    const body = paint();
    body.setShader(gradient(20, 6, 80, 92, [palette.ink600, palette.ink800]));
    canvas.drawPath(droplet, body);

    canvas.save();
    canvas.clipPath(droplet, ClipOp.Intersect, true);

    // Liquid with one gentle wave.
    const surfaceY = BOTTOM - step * SPAN;
    if (step > 0) {
      const builder = Skia.PathBuilder.Make().moveTo(0, surfaceY);
      for (let x = 0; x <= 100; x += 4) {
        builder.lineTo(x, surfaceY + (step < 0.97 ? 2.2 : 1) * Math.sin((x / 100) * Math.PI * 2.8));
      }
      const water = builder.lineTo(100, 100).lineTo(0, 100).close().build();
      const liquid = paint();
      liquid.setShader(gradient(0, 10, 0, 96, [palette.teal300, palette.teal500, palette.lavender500]));
      canvas.drawPath(water, liquid);
    }

    // Face — dark ink when the eyes are under water, light ink when above.
    const ink = paint();
    ink.setColor(Skia.Color(surfaceY < 54 ? palette.ink950 : palette.text50));
    canvas.drawOval(Skia.XYWHRect(35.8, 52.8, 8.4, 10.4), ink);
    canvas.drawOval(Skia.XYWHRect(55.8, 52.8, 8.4, 10.4), ink);
    const shine = paint();
    shine.setColor(Skia.Color(palette.white));
    canvas.drawCircle(41.8, 55.6, 1.5, shine);
    canvas.drawCircle(61.8, 55.6, 1.5, shine);
    const mouth = Skia.Path.MakeFromSVGString('M41 70 Q 50 79 59 70');
    if (mouth) {
      const stroke = paint();
      stroke.setColor(Skia.Color(surfaceY < 70 ? palette.ink950 : palette.text50));
      stroke.setStyle(PaintStyle.Stroke);
      stroke.setStrokeWidth(2.7);
      stroke.setStrokeCap(StrokeCap.Round);
      canvas.drawPath(mouth, stroke);
    }
    const blush = paint();
    blush.setColor(Skia.Color(palette.pink400));
    blush.setAlphaf(0.55);
    canvas.drawOval(Skia.XYWHRect(26, 64, 10, 5.5), blush);
    canvas.drawOval(Skia.XYWHRect(64, 64, 10, 5.5), blush);

    const gloss = paint();
    gloss.setColor(Skia.Color(palette.white));
    gloss.setAlphaf(0.28);
    canvas.drawPath(highlight, gloss);
    canvas.restore();

    // Rim.
    const rim = paint();
    rim.setStyle(PaintStyle.Stroke);
    rim.setStrokeWidth(2.4);
    rim.setShader(gradient(20, 6, 82, 92, [palette.teal300, palette.lavender400]));
    canvas.drawPath(droplet, rim);

    surface.flush();
    const base64 = surface.makeImageSnapshot().encodeToBase64(ImageFormat.PNG, 100);
    cache.set(step, base64);
    return base64;
  } catch {
    return null;
  }
}

/**
 * Writes the droplet to a fresh cache file and returns its URI. iOS *moves*
 * an attachment into its own store when the notification is scheduled, so
 * every reminder needs its own file.
 */
export function writeDropletAttachment(fill: number, id: string): string | null {
  const base64 = renderDropletBase64(fill);
  if (!base64) return null;
  try {
    const file = new File(Paths.cache, `aquis-drop-${id}.png`);
    file.write(base64, { encoding: 'base64' });
    return file.uri;
  } catch {
    return null;
  }
}
