/**
 * Pan/Zoom utility functions for the game board.
 *
 * Pure functions extracted for testability — DOM event handling stays in GameBoard.
 *
 * @module frontend/pan-zoom-utils
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Minimum zoom level */
export const MIN_ZOOM = 0.25;
/** Maximum zoom level */
export const MAX_ZOOM = 3;
/** Zoom increment for +/- buttons */
export const ZOOM_STEP = 0.25;
/** Click vs drag threshold in pixels */
export const CLICK_THRESHOLD = 5;
/** Maximum pan as percentage of container dimension */
export const MAX_PAN_RATIO = 0.5;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PanDelta {
  deltaX: number;
  deltaY: number;
}

export interface PanPosition {
  panX: number;
  panY: number;
}

// ---------------------------------------------------------------------------
// Pure functions
// ---------------------------------------------------------------------------

/**
 * Calculate the delta from start to current position.
 *
 * @param startX - Mouse/touch start X coordinate
 * @param startY - Mouse/touch start Y coordinate
 * @param currentX - Current mouse/touch X coordinate
 * @param currentY - Current mouse/touch Y coordinate
 * @returns Delta in pixels
 */
export function calculatePanDelta(
  startX: number,
  startY: number,
  currentX: number,
  currentY: number,
): PanDelta {
  return {
    deltaX: currentX - startX,
    deltaY: currentY - startY,
  };
}

/**
 * Determine if a mouse/touch interaction is a click (movement below threshold).
 *
 * @param startX - Start X coordinate
 * @param startY - Start Y coordinate
 * @param endX - End X coordinate
 * @param endY - End Y coordinate
 * @param threshold - Pixel threshold (default CLICK_THRESHOLD)
 * @returns true if movement is within threshold (click, not drag)
 */
export function isClick(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  threshold: number = CLICK_THRESHOLD,
): boolean {
  const deltaX = Math.abs(endX - startX);
  const deltaY = Math.abs(endY - startY);
  return deltaX <= threshold && deltaY <= threshold;
}

/**
 * Clamp pan position to keep board center within 50% of container dimensions.
 *
 * Boundaries scale inversely with zoom — higher zoom means tighter pan limits.
 *
 * @param panX - Current pan X
 * @param panY - Current pan Y
 * @param containerWidth - Board container width in pixels
 * @param containerHeight - Board container height in pixels
 * @param zoom - Current zoom level
 * @returns Clamped pan position
 */
export function clampPan(
  panX: number,
  panY: number,
  containerWidth: number,
  containerHeight: number,
  zoom: number,
): PanPosition {
  if (containerWidth === 0 || containerHeight === 0) {
    return { panX: 0, panY: 0 };
  }

  const maxX = (containerWidth * MAX_PAN_RATIO) / zoom;
  const maxY = (containerHeight * MAX_PAN_RATIO) / zoom;

  return {
    panX: Math.max(-maxX, Math.min(maxX, panX)),
    panY: Math.max(-maxY, Math.min(maxY, panY)),
  };
}

/**
 * Calculate new zoom level centered at cursor position.
 *
 * @param currentZoom - Current zoom level
 * @param deltaY - Scroll wheel delta (negative = zoom in, positive = zoom out)
 * @param cursorX - Cursor X position relative to container
 * @param cursorY - Cursor Y position relative to container
 * @param containerWidth - Container width
 * @param containerHeight - Container height
 * @returns New zoom level clamped to [MIN_ZOOM, MAX_ZOOM]
 */
export function calculateZoomAtCursor(
  currentZoom: number,
  deltaY: number,
  cursorX: number,
  cursorY: number,
  containerWidth: number,
  containerHeight: number,
): number {
  // Zoom factor: 0.1 per 100px of scroll
  const zoomFactor = 0.1 * (deltaY / 100);
  const newZoom = currentZoom - zoomFactor;

  // Clamp to bounds
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));
}

/**
 * Calculate distance between two touch points.
 *
 * @param touch1 - First touch point
 * @param touch2 - Second touch point
 * @returns Distance in pixels
 */
export function calculateTouchDistance(
  touch1: { clientX: number; clientY: number },
  touch2: { clientX: number; clientY: number },
): number {
  const deltaX = touch2.clientX - touch1.clientX;
  const deltaY = touch2.clientY - touch1.clientY;
  return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
}

/**
 * Calculate zoom change from pinch gesture.
 *
 * @param currentZoom - Current zoom level
 * @param initialDistance - Initial distance between two fingers
 * @param currentDistance - Current distance between two fingers
 * @returns New zoom level clamped to [MIN_ZOOM, MAX_ZOOM]
 */
export function calculatePinchZoom(
  currentZoom: number,
  initialDistance: number,
  currentDistance: number,
): number {
  if (initialDistance === 0) return currentZoom;

  const scale = currentDistance / initialDistance;
  const newZoom = currentZoom * scale;

  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));
}