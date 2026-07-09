import { describe, expect, it } from "vitest";
import { formatMemberSince } from "@/lib/profile-view";

describe("formatMemberSince", () => {
  it("formats a January date correctly", () => {
    expect(formatMemberSince("2025-01-15T10:30:00Z")).toBe("Enero 2025");
  });

  it("formats a December date correctly", () => {
    expect(formatMemberSince("2024-12-01T00:00:00Z")).toBe("Diciembre 2024");
  });

  it("formats a mid-year date correctly", () => {
    expect(formatMemberSince("2023-06-15T12:00:00Z")).toBe("Junio 2023");
  });

  it("handles ISO date without time component", () => {
    expect(formatMemberSince("2025-03-20")).toBe("Marzo 2025");
  });

  it("handles Date object input", () => {
    const date = new Date(2024, 8, 1); // September 2024
    expect(formatMemberSince(date)).toBe("Septiembre 2024");
  });

  it("formats leap year February correctly", () => {
    expect(formatMemberSince("2024-02-29T00:00:00Z")).toBe("Febrero 2024");
  });

  it("formats first day of year correctly", () => {
    expect(formatMemberSince("2025-01-01T00:00:00Z")).toBe("Enero 2025");
  });

  it("formats last day of year correctly (local timezone safe)", () => {
    // Use a Date object to avoid timezone-dependent string parsing
    const date = new Date(2024, 11, 31); // December 31, 2024 local
    expect(formatMemberSince(date)).toBe("Diciembre 2024");
  });
});
