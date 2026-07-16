/**
 * Tile animation system using Web Animations API.
 *
 * Detects new tiles via board.tiles.length comparison, calculates
 * animation coordinates from avatar origin to tile target, and
 * executes 400ms WAAPI animations.
 */

// ---------------------------------------------------------------------------
// Pure helpers (exported for testing)
// ---------------------------------------------------------------------------

/**
 * Check if the user prefers reduced motion.
 * Returns true if animations should be disabled.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Calculate the avatar origin coordinates in container space.
 *
 * @param avatarRect - The avatar element's getBoundingClientRect()
 * @param containerRect - The board container's getBoundingClientRect()
 * @param pan - Current pan offset { x, y }
 * @param zoom - Current zoom level
 * @returns Coordinates in the pan/zoom coordinate space
 */
export function calculateAvatarOrigin(
  avatarRect: DOMRect,
  containerRect: DOMRect,
  pan: { x: number; y: number },
  zoom: number,
): { x: number; y: number } {
  const screenX = avatarRect.left + avatarRect.width / 2;
  const screenY = avatarRect.top + avatarRect.height / 2;
  const originX = (screenX - containerRect.left - pan.x) / zoom;
  const originY = (screenY - containerRect.top - pan.y) / zoom;
  return { x: originX, y: originY };
}

/**
 * Calculate the tile target coordinates in pan/zoom space.
 * These come directly from the grid layout engine's tile positions.
 */
export function calculateTileTarget(
  tileLeft: number,
  tileTop: number,
): { x: number; y: number } {
  return { x: tileLeft, y: tileTop };
}

/**
 * Execute a WAAPI animation from origin to target.
 *
 * @param element - The DOM element to animate
 * @param origin - Starting coordinates { x, y }
 * @param target - Ending coordinates { x, y }
 * @param duration - Animation duration in ms (default 400)
 * @returns The Animation object, or null if reduced motion is enabled
 */
export function animateTileFromAvatar(
  element: HTMLElement,
  origin: { x: number; y: number },
  target: { x: number; y: number },
  duration = 400,
): Animation | null {
  if (prefersReducedMotion()) return null;

  const animation = element.animate(
    [
      {
        left: `${origin.x}px`,
        top: `${origin.y}px`,
        opacity: 0,
        scale: 0.8,
      },
      {
        left: `${target.x}px`,
        top: `${target.y}px`,
        opacity: 1,
        scale: 1,
      },
    ],
    {
      duration,
      easing: "ease-out",
      fill: "forwards",
    },
  );

  return animation;
}
