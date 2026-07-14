/**
 * Profile routes — authenticated endpoints for user profile data.
 *
 * All routes in this group require a valid JWT token (use authGuard).
 */

import { Elysia } from "elysia";
import { getProfile } from "../db/queries/profiles";

export const profileRoutes = new Elysia().get(
  "/profile/me",
  async ({ userId, set }) => {
    const profile = await getProfile(userId);
    if (!profile) {
      set.status = 404;
      return { error: "Profile not found" };
    }
    return profile;
  },
);
