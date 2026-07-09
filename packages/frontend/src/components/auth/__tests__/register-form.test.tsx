import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RegisterForm } from "../register-form";

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      signInWithOAuth: vi.fn().mockResolvedValue({ error: null }),
    },
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe("RegisterForm", () => {
  it("renders username, email, password, and confirm-password fields", () => {
    render(<RegisterForm />);
    expect(screen.getByLabelText(/nombre de usuario/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/correo electrónico/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^contraseña$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirmar contraseña/i)).toBeInTheDocument();
  });

  it("renders a submit button", () => {
    render(<RegisterForm />);
    expect(
      screen.getByRole("button", { name: /crear cuenta/i }),
    ).toBeInTheDocument();
  });

  it("renders a Google OAuth button", () => {
    render(<RegisterForm />);
    expect(screen.getByRole("button", { name: /google/i })).toBeInTheDocument();
  });

  it("does not render a GitHub button", () => {
    render(<RegisterForm />);
    expect(
      screen.queryByRole("button", { name: /github/i }),
    ).not.toBeInTheDocument();
  });

  it("renders a link to login page", () => {
    render(<RegisterForm />);
    expect(
      screen.getByRole("link", { name: /iniciá sesión/i }),
    ).toHaveAttribute("href", "/login");
  });
});
