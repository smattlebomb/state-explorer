/**
 * Shared placement for the 64px + / − / reset cluster.
 * A right gutter on the map wrap keeps US Northeast callouts (and other
 * right-edge labels) out from under the buttons.
 */
export const ZOOM_WRAP_CLASS = 'map-zoom-wrap relative h-full w-full pr-20';

/** Cluster sits in that gutter, bottom-right. */
export const ZOOM_CLUSTER_CLASS =
  'pointer-events-none absolute bottom-3 right-3 z-10 flex flex-col gap-2';
