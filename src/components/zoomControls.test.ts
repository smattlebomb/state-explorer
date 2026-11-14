import { describe, expect, it } from 'vitest';
import { ZOOM_CLUSTER_CLASS, ZOOM_WRAP_CLASS } from './zoomControls';

describe('zoom control placement', () => {
  it('sits in the bottom-right so it does not cover US Northeast callouts', () => {
    expect(ZOOM_CLUSTER_CLASS).toMatch(/\bbottom-3\b/);
    expect(ZOOM_CLUSTER_CLASS).toMatch(/\bright-3\b/);
    expect(ZOOM_CLUSTER_CLASS).not.toMatch(/top-1\/2/);
  });

  it('reserves a right gutter on the map so callouts stay left of the buttons', () => {
    expect(ZOOM_WRAP_CLASS).toMatch(/\bpr-20\b/);
    expect(ZOOM_WRAP_CLASS).toMatch(/map-zoom-wrap/);
  });
});
