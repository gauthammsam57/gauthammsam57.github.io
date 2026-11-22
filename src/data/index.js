// Everything the pages are built from, in one object.
import { profile } from './profile.js';
import { scenes, journey, off, thanks, contact } from './scenes.js';
import { cv } from './cv.js';
import { loadActivity } from './activity.js';
import { desk } from './desk.js';

export function loadData() {
  return { profile, scenes, journey, off, thanks, contact, cv, desk, activity: loadActivity() };
}
