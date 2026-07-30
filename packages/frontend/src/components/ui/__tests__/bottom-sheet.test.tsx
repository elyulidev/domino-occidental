import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// Mock react-dom so createPortal renders children directly
vi.mock("react-dom", async () => {
  const actual = await vi.importActual<typeof import("react-dom")>("react-dom");
  return {
    ...actual,
    createPortal: (node: React.ReactNode) => node,
  };
});

import { BottomSheet } from "../bottom-sheet";

function renderSheet(props: Partial<React.ComponentProps<typeof BottomSheet>> = {}) {
  return render(
    <BottomSheet open onClose={() => {}} {...props}>
      <p>Sheet content</p>
    </BottomSheet>,
  );
}

describe("BottomSheet", () => {
  it("renders children when open is true", () => {
    renderSheet({ open: true });
    expect(screen.getByText("Sheet content")).toBeDefined();
  });

  it("renders nothing when open is false", () => {
    const { container } = renderSheet({ open: false });
    expect(container.innerHTML).toBe("");
  });

  it("calls onClose when backdrop is clicked", () => {
    const onClose = vi.fn();
    renderSheet({ open: true, onClose });

    // The backdrop is the first div inside the dialog (aria-hidden)
    const backdrop = screen.getByRole("dialog").querySelector("[aria-hidden=\"true\"]");
    expect(backdrop).not.toBeNull();

    fireEvent.click(backdrop!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when Escape key is pressed", () => {
    const onClose = vi.fn();
    renderSheet({ open: true, onClose });

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("has role=\"dialog\" attribute", () => {
    renderSheet();
    expect(screen.getByRole("dialog")).toBeDefined();
  });

  it("shows title when provided", () => {
    renderSheet({ open: true, title: "My Title" });
    expect(screen.getByText("My Title")).toBeDefined();
  });
});
