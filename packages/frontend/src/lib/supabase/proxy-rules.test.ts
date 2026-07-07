import { describe, expect, it } from "vitest";
import { isProtectedRoute, getAuthRedirectUrl } from "./proxy-rules";

describe("isProtectedRoute", () => {
  it("returns true for dashboard routes", () => {
    expect(isProtectedRoute("/dashboard")).toBe(true);
    expect(isProtectedRoute("/dashboard/settings")).toBe(true);
  });

  it("returns true for game routes", () => {
    expect(isProtectedRoute("/game")).toBe(true);
    expect(isProtectedRoute("/game/abc123")).toBe(true);
  });

  it("returns false for auth routes", () => {
    expect(isProtectedRoute("/login")).toBe(false);
    expect(isProtectedRoute("/register")).toBe(false);
  });

  it("returns false for auth callback routes", () => {
    expect(isProtectedRoute("/auth/callback")).toBe(false);
    expect(isProtectedRoute("/auth/error")).toBe(false);
  });

  it("returns false for root path", () => {
    expect(isProtectedRoute("/")).toBe(false);
  });

  it("returns true for lobby routes under dashboard group", () => {
    expect(isProtectedRoute("/lobby")).toBe(true);
  });

  it("returns true for profile routes under dashboard group", () => {
    expect(isProtectedRoute("/profile/jugador1")).toBe(true);
  });

  it("returns true for friends routes under dashboard group", () => {
    expect(isProtectedRoute("/friends")).toBe(true);
  });

  it("returns true for tournaments routes under dashboard group", () => {
    expect(isProtectedRoute("/tournaments")).toBe(true);
    expect(isProtectedRoute("/tournaments/abc")).toBe(true);
  });

  it("returns true for shop routes under dashboard group", () => {
    expect(isProtectedRoute("/shop")).toBe(true);
  });

  it("returns true for notifications routes under dashboard group", () => {
    expect(isProtectedRoute("/notifications")).toBe(true);
  });

  it("returns true for users routes under dashboard group", () => {
    expect(isProtectedRoute("/users/search")).toBe(true);
  });

  it("returns true for match routes under game group", () => {
    expect(isProtectedRoute("/match/abc123")).toBe(true);
  });

  it("returns false for static assets path segment", () => {
    expect(isProtectedRoute("/_next/static/chunk.js")).toBe(false);
  });
});

describe("getAuthRedirectUrl", () => {
  it("returns login path with next param for protected routes", () => {
    const url = getAuthRedirectUrl("/dashboard", "http://localhost:3000");
    expect(url).toBe("http://localhost:3000/login?next=%2Fdashboard");
  });

  it("encodes complex paths in next param", () => {
    const url = getAuthRedirectUrl("/profile/jugador1", "http://localhost:3000");
    expect(url).toBe("http://localhost:3000/login?next=%2Fprofile%2Fjugador1");
  });

  it("uses provided origin for redirect", () => {
    const url = getAuthRedirectUrl("/lobby", "https://domino.example.com");
    expect(url).toBe("https://domino.example.com/login?next=%2Flobby");
  });
});
