// The still pictures of the room, shown where 3D cannot run. One list, used by the script that
// takes them (scripts/stills.mjs) and by the page that shows them (desk-main.js).
// One wide picture at four times of day, of today's desk and of the 2020 one (The photographs),
// of which a visitor downloads one. On an upright screen
// (a phone) it fills the height and is swiped sideways, starting at the desk: an upright picture of
// the whole room would make everything in it too small to tap (Gautham chose this, 17 Nov 2026).

// w × h: the window the picture is taken in, in page pixels; scale: pixels per page pixel in the file
// (1.5, so it is still sharp when a phone shows it at its full height)
const SHOT = { w: 1920, h: 1080, scale: 1.5 };
// hours: the time in the picture, on the room's own clock (IST); from: the hour it starts being shown
export const TIMES = [
  { id: 'morning', hours: 7, from: 5.5 },
  // day and dusk start when he arrives and leaves (10 and 6 IST, room.js), so the picture shown
  // while the 3D loads has him at the desk exactly when the room will
  { id: 'day', hours: 13, from: 10 },
  { id: 'dusk', hours: 18.3, from: 18 },
  { id: 'night', hours: 22, from: 19.75 },
];
// era: which desk, as the room's setTime has it ('now', or 'then' for 2020)
export const STILLS = ['now', 'then'].flatMap((era) => TIMES.map((t) => ({ file: `room-${era === 'then' ? '2020-' : ''}${t.id}.webp`, era, time: t.id, hours: t.hours, ...SHOT })));
export const STILL_DIR = './still/';
// the map of what can be clicked in a picture is a grid of cells this many page pixels across
export const SPOT_CELL = 8;
export const spotsFile = (s) => s.file.replace(/\.\w+$/, '.spots.json');
// in the picture these do nothing (the lamp and the clock only work in the room itself)
export const STILL_SKIP = ['lamp', 'clock'];
// on a phone the picture starts with these in view (the desk, from the notebook to the drawers)
export const STILL_START = ['notebook', 'drawer:cv'];

// The picture shown when a link to the site is shared (LinkedIn, WhatsApp): the room by day, at the
// size those sites ask for. A JPEG, as not every one of them reads WebP.
export const SHARE = { file: 'share.jpg', w: 1200, h: 630, scale: 1, hours: 13, era: 'now' };

// Which picture at this hour (IST), of which desk.
export function pickStill(hour, era = 'now') {
  const hh = ((hour % 24) + 24) % 24;
  const byFrom = [...TIMES].sort((a, b) => a.from - b.from);
  const time = byFrom.filter((t) => t.from <= hh).pop() || byFrom[byFrom.length - 1]; // before the first, it is still night
  return STILLS.find((s) => s.time === time.id && s.era === (era === 'then' ? 'then' : 'now'));
}
