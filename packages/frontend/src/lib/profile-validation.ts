/**
 * Profile validation — pure functions, no side effects.
 * Extracted from the edit page for unit testability (TDD).
 */

import { COUNTRY_CODES } from "./countries";

/**
 * ISO 3166-1 alpha-2 country codes for validation.
 * Full list in `lib/countries.ts`.
 */
export const COUNTRIES = COUNTRY_CODES;

const USERNAME_REGEX = /^[a-zA-Z0-9_-]+$/;

export type ProfileValidationResult = {
  error?: string;
};

/**
 * Validate profile fields before persisting to Supabase.
 * Returns `{ error }` on failure, `{}` on success.
 */
export function validateProfileFields(fields: {
  username: string;
  country: string;
}): ProfileValidationResult {
  if (fields.username.length < 3 || fields.username.length > 20) {
    return { error: "Username must be between 3 and 20 characters" };
  }
  if (!USERNAME_REGEX.test(fields.username)) {
    return {
      error:
        "Username can only contain letters, numbers, underscores, and hyphens",
    };
  }
  if (validateCountry(fields.country)) {
    return { error: "Invalid country code" };
  }
  return {};
}

/**
 * Validate a country code against the COUNTRIES whitelist.
 * Returns `undefined` if valid, or an error string if invalid.
 */
export function validateCountry(code: string): string | undefined {
  if (!COUNTRIES.includes(code)) {
    return "Invalid country code";
  }
  return undefined;
}

/**
 * Extract the first 2 uppercase characters from a name for avatar initials.
 */
export function getInitials(name: string): string {
  return name.trim().slice(0, 2).toUpperCase();
}
