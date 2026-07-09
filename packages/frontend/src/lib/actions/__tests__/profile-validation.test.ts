import { describe, expect, it } from "vitest";
import {
  COUNTRIES,
  getInitials,
  validateCountry,
  validateProfileFields,
} from "@/lib/profile-validation";

describe("validateProfileFields", () => {
  it("returns no error for valid username and country", () => {
    const result = validateProfileFields({
      username: "carlos123",
      country: "AR",
    });
    expect(result.error).toBeUndefined();
  });

  it("returns error when username is too short (< 3 chars)", () => {
    const result = validateProfileFields({
      username: "ab",
      country: "AR",
    });
    expect(result.error).toBe("Username must be between 3 and 20 characters");
  });

  it("returns error when username is too long (> 20 chars)", () => {
    const result = validateProfileFields({
      username: "a".repeat(21),
      country: "AR",
    });
    expect(result.error).toBe("Username must be between 3 and 20 characters");
  });

  it("returns error when username contains invalid characters", () => {
    const result = validateProfileFields({
      username: "carlos@123",
      country: "AR",
    });
    expect(result.error).toBe(
      "Username can only contain letters, numbers, underscores, and hyphens",
    );
  });

  it("allows underscores and hyphens in username", () => {
    const result = validateProfileFields({
      username: "carlos_123-dev",
      country: "AR",
    });
    expect(result.error).toBeUndefined();
  });

  it("returns error when country is empty", () => {
    const result = validateProfileFields({
      username: "carlos123",
      country: "",
    });
    expect(result.error).toBe("Invalid country code");
  });

  it("returns error when country code is not in the whitelist", () => {
    const result = validateProfileFields({
      username: "carlos123",
      country: "XX",
    });
    expect(result.error).toBe("Invalid country code");
  });

  it("returns error when username is empty", () => {
    const result = validateProfileFields({
      username: "",
      country: "AR",
    });
    expect(result.error).toBe("Username must be between 3 and 20 characters");
  });
});

describe("validateCountry", () => {
  it("returns undefined for a valid country code", () => {
    expect(validateCountry("AR")).toBeUndefined();
    expect(validateCountry("US")).toBeUndefined();
    expect(validateCountry("ES")).toBeUndefined();
  });

  it("returns error string for an invalid country code", () => {
    expect(validateCountry("XX")).toBe("Invalid country code");
    expect(validateCountry("")).toBe("Invalid country code");
    expect(validateCountry("Argentina")).toBe("Invalid country code");
  });
});

describe("getInitials", () => {
  it("returns first 2 uppercase chars for a normal name", () => {
    expect(getInitials("Alice")).toBe("AL");
  });

  it("returns single uppercase char for a single-char name", () => {
    expect(getInitials("A")).toBe("A");
  });

  it("returns empty string for empty input", () => {
    expect(getInitials("")).toBe("");
  });

  it("handles multi-word names by using first 2 chars", () => {
    expect(getInitials("Carlos Perez")).toBe("CA");
  });

  it("handles lowercase input by uppercasing", () => {
    expect(getInitials("bob")).toBe("BO");
  });

  it("returns first 2 chars even if name has spaces", () => {
    expect(getInitials("  Ana")).toBe("AN");
  });
});

describe("COUNTRIES constant", () => {
  it("contains ISO 3166-1 alpha-2 codes as strings", () => {
    expect(COUNTRIES).toContain("AR");
    expect(COUNTRIES).toContain("US");
    expect(COUNTRIES).toContain("ES");
    expect(COUNTRIES).toContain("MX");
  });

  it("is a non-empty array", () => {
    expect(COUNTRIES.length).toBeGreaterThan(0);
  });
});
