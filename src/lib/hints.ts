/** Words shown and spoken for each Find It hint. */
import { REGION_COMPASS, getRegion } from '../data/regions';
import { STATE_BY_ABBR } from '../data/states';

export interface HintText {
  /** Short banner text (big type). */
  display: string;
  /** What read-aloud says. */
  spoken: string;
}

export function hintText(abbr: string, level: number): HintText {
  const info = STATE_BY_ABBR.get(abbr);
  if (!info) return { display: '', spoken: '' };
  if (level <= 1) {
    return {
      display: `💡 Here's the shape of ${info.name}. Find it on the map!`,
      spoken: `Here is the shape of ${info.name}. Can you find a state that looks like this?`,
    };
  }
  const region = getRegion(info.region);
  const where = REGION_COMPASS[info.region];
  return {
    display: `💡 It's in the ${region.label}, ${where}.`,
    spoken: `${info.name} is in the ${region.label}. That's ${where}.`,
  };
}
