import { describe, expect, it } from "vitest";
import {
  categorizeAuthError,
  validateSignUpFields,
} from "@/lib/auth-validation";

describe("validateSignUpFields", () => {
  it("returns error when username is empty", () => {
    const result = validateSignUpFields({
      username: "",
      email: "test@example.com",
      password: "secret123",
      confirmPassword: "secret123",
    });
    expect(result.error).toBe("El nombre de usuario es requerido");
  });

  it("returns error when email is empty", () => {
    const result = validateSignUpFields({
      username: "player1",
      email: "",
      password: "secret123",
      confirmPassword: "secret123",
    });
    expect(result.error).toBe("El correo electrónico es requerido");
  });

  it("returns error when password is too short", () => {
    const result = validateSignUpFields({
      username: "player1",
      email: "test@example.com",
      password: "12345",
      confirmPassword: "12345",
    });
    expect(result.error).toBe("La contraseña debe tener al menos 6 caracteres");
  });

  it("returns error when passwords do not match", () => {
    const result = validateSignUpFields({
      username: "player1",
      email: "test@example.com",
      password: "secret123",
      confirmPassword: "different",
    });
    expect(result.error).toBe("Las contraseñas no coinciden");
  });

  it("returns success when all fields are valid", () => {
    const result = validateSignUpFields({
      username: "player1",
      email: "test@example.com",
      password: "secret123",
      confirmPassword: "secret123",
    });
    expect(result.error).toBeUndefined();
    expect(result.valid).toBe(true);
  });
});

describe("categorizeAuthError", () => {
  it("categorizes invalid login credentials", () => {
    const error = categorizeAuthError({
      message: "Invalid login credentials",
      status: 400,
    });
    expect(error.code).toBe("invalid_credentials");
    expect(error.message).toBe("Credenciales inválidas");
    expect(error.retry).toBeUndefined();
    expect(error.resend).toBeUndefined();
  });

  it("categorizes email not confirmed", () => {
    const error = categorizeAuthError({
      message: "Email not confirmed",
    });
    expect(error.code).toBe("email_not_confirmed");
    expect(error.resend).toBe(true);
  });

  it("categorizes rate limiting by status code", () => {
    const error = categorizeAuthError({
      message: "Request rate limited",
      status: 429,
    });
    expect(error.code).toBe("rate_limited");
    expect(error.waitSeconds).toBe(60);
  });

  it("categorizes rate limiting by message content", () => {
    const error = categorizeAuthError({
      message: "Too many requests, slow down",
    });
    expect(error.code).toBe("rate_limited");
    expect(error.waitSeconds).toBe(60);
  });

  it("categorizes network errors (TypeError)", () => {
    const error = categorizeAuthError(
      Object.assign(new TypeError("Failed to fetch"), { status: 0 }),
    );
    expect(error.code).toBe("network_error");
    expect(error.retry).toBe(true);
  });

  it("categorizes email already registered", () => {
    const error = categorizeAuthError({
      message: "User already registered",
    });
    expect(error.code).toBe("email_already_registered");
  });

  it("categorizes email already exists", () => {
    const error = categorizeAuthError({
      message: "A user with this email already exists",
    });
    expect(error.code).toBe("email_already_registered");
  });

  it("categorizes session expired", () => {
    const error = categorizeAuthError({
      message: "JWT session expired",
      status: 401,
    });
    expect(error.code).toBe("session_expired");
  });

  it("categorizes unknown errors", () => {
    const error = categorizeAuthError({
      message: "Something weird happened",
      status: 500,
    });
    expect(error.code).toBe("unknown");
    expect(error.message).toBe("Something weird happened");
  });

  it("handles missing message gracefully", () => {
    const error = categorizeAuthError({});
    expect(error.code).toBe("unknown");
  });
});
