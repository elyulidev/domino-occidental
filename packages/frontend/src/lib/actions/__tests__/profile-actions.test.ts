import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock dependencies BEFORE imports
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { updateProfile, uploadAvatar } from "@/lib/actions/profile";

const mockCreateClient = vi.mocked(createClient);
const mockRevalidatePath = vi.mocked(revalidatePath);
const mockRedirect = vi.mocked(redirect);

function buildFormData(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.append(k, v);
  return fd;
}

function mockSupabase(overrides: {
  getUser?: { data: { user: { id: string } | null }; error?: unknown };
  update?: { error: unknown };
} = {}) {
  const eq = vi.fn().mockResolvedValue(overrides.update ?? { error: null });
  const update = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ update });
  const getUser = vi.fn().mockResolvedValue(
    overrides.getUser ?? {
      data: { user: { id: "user-123" } },
      error: null,
    },
  );

  // Storage mocks
  const upload = vi.fn().mockResolvedValue({ error: null });
  const storageFrom = vi.fn().mockReturnValue({ upload });
  const getPublicUrl = vi.fn().mockReturnValue({
    data: {
      publicUrl:
        "https://example.supabase.co/storage/v1/object/public/avatars/user-123/avatar.jpg",
    },
  });
  const storage = {
    from: vi.fn().mockImplementation((bucket: string) => {
      if (bucket === "avatars") return { upload, getPublicUrl };
      return { upload, getPublicUrl };
    }),
  };

  return { from, getUser, auth: { getUser }, storage };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── updateProfile ───

describe("updateProfile", () => {
  it("returns validation error for invalid username", async () => {
    const fd = buildFormData({ username: "ab", country: "AR" });
    const result = await updateProfile(null, fd);
    expect(result.error).toBe(
      "Username must be between 3 and 20 characters",
    );
    expect(result.success).toBeUndefined();
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it("returns validation error for invalid country", async () => {
    const fd = buildFormData({ username: "carlos123", country: "XX" });
    const result = await updateProfile(null, fd);
    expect(result.error).toBe("Invalid country code");
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it("returns error when user is not authenticated", async () => {
    mockCreateClient.mockResolvedValue(
      mockSupabase({
        getUser: { data: { user: null }, error: { message: "not found" } },
      }) as ReturnType<typeof createClient> extends Promise<infer T>
        ? T
        : never,
    );

    const fd = buildFormData({ username: "carlos123", country: "AR" });
    const result = await updateProfile(null, fd);
    expect(result.error).toBe("No se pudo autenticar al usuario");
  });

  it("updates profile and redirects on success", async () => {
    const ms = mockSupabase();
    mockCreateClient.mockResolvedValue(
      ms as ReturnType<typeof createClient> extends Promise<infer T>
        ? T
        : never,
    );

    const fd = buildFormData({ username: "carlos123", country: "AR" });
    await expect(updateProfile(null, fd)).rejects.toThrow("NEXT_REDIRECT");

    expect(ms.from).toHaveBeenCalledWith("profiles");
    expect(ms.from("profiles").update).toHaveBeenCalledWith({
      username: "carlos123",
      country: "AR",
    });
    expect(ms.from("profiles").update({}).eq).toHaveBeenCalledWith(
      "id",
      "user-123",
    );
    expect(mockRevalidatePath).toHaveBeenCalledWith("/", "layout");
    expect(mockRedirect).toHaveBeenCalledWith("/profile/carlos123");
  });

  it("catches PG 23505 unique violation as friendly error", async () => {
    const ms = mockSupabase({
      update: { error: { code: "23505", message: "duplicate key" } },
    });
    mockCreateClient.mockResolvedValue(
      ms as ReturnType<typeof createClient> extends Promise<infer T>
        ? T
        : never,
    );

    const fd = buildFormData({ username: "taken_name", country: "AR" });
    const result = await updateProfile(null, fd);
    expect(result.error).toBe("Ese nombre de usuario ya está en uso");
    expect(result.username).toBe("taken_name");
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("returns generic error for unexpected Supabase failures", async () => {
    const ms = mockSupabase({
      update: { error: { code: "XX000", message: "something broke" } },
    });
    mockCreateClient.mockResolvedValue(
      ms as ReturnType<typeof createClient> extends Promise<infer T>
        ? T
        : never,
    );

    const fd = buildFormData({ username: "carlos123", country: "AR" });
    const result = await updateProfile(null, fd);
    expect(result.error).toBe("Error al actualizar el perfil");
  });
});

// ─── uploadAvatar ───

describe("uploadAvatar", () => {
  const jpegFile = new File(["bytes"], "photo.jpg", {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
  const pngFile = new File(["bytes"], "photo.png", {
    type: "image/png",
    lastModified: Date.now(),
  });
  const txtFile = new File(["bytes"], "doc.txt", {
    type: "text/plain",
    lastModified: Date.now(),
  });
  const largeJpeg = new File([new Uint8Array(2 * 1024 * 1024)], "big.jpg", {
    type: "image/jpeg",
    lastModified: Date.now(),
  });

  it("rejects non-image file types", async () => {
    const fd = new FormData();
    fd.append("avatar", txtFile);
    const result = await uploadAvatar(fd);
    expect(result.error).toBe("Solo se permiten archivos JPG o PNG");
    expect(result.url).toBeUndefined();
  });

  it("rejects files exceeding 1 MB", async () => {
    const fd = new FormData();
    fd.append("avatar", largeJpeg);
    const result = await uploadAvatar(fd);
    expect(result.error).toBe("La imagen no puede superar 1 MB");
    expect(result.url).toBeUndefined();
  });

  it("uploads JPEG to Supabase Storage and returns public URL", async () => {
    const ms = mockSupabase();
    mockCreateClient.mockResolvedValue(
      ms as ReturnType<typeof createClient> extends Promise<infer T>
        ? T
        : never,
    );

    const fd = new FormData();
    fd.append("avatar", jpegFile);
    const result = await uploadAvatar(fd);

    expect(result.url).toBe(
      "https://example.supabase.co/storage/v1/object/public/avatars/user-123/avatar.jpg",
    );
    expect(ms.from).toHaveBeenCalledWith("profiles");
    expect(ms.from("profiles").update).toHaveBeenCalledWith({
      avatar_url:
        "https://example.supabase.co/storage/v1/object/public/avatars/user-123/avatar.jpg",
    });
  });

  it("uploads PNG to Supabase Storage", async () => {
    const ms = mockSupabase();
    mockCreateClient.mockResolvedValue(
      ms as ReturnType<typeof createClient> extends Promise<infer T>
        ? T
        : never,
    );

    const fd = new FormData();
    fd.append("avatar", pngFile);
    const result = await uploadAvatar(fd);

    expect(result.url).toBeDefined();
    expect(result.error).toBeUndefined();
  });

  it("returns error when user is not authenticated", async () => {
    mockCreateClient.mockResolvedValue(
      mockSupabase({
        getUser: { data: { user: null }, error: { message: "not found" } },
      }) as ReturnType<typeof createClient> extends Promise<infer T>
        ? T
        : never,
    );

    const fd = new FormData();
    fd.append("avatar", jpegFile);
    const result = await uploadAvatar(fd);
    expect(result.error).toBe("No se pudo autenticar al usuario");
  });

  it("returns error when no file provided", async () => {
    const ms = mockSupabase();
    mockCreateClient.mockResolvedValue(
      ms as ReturnType<typeof createClient> extends Promise<infer T>
        ? T
        : never,
    );

    const fd = new FormData();
    const result = await uploadAvatar(fd);
    expect(result.error).toBe("No se proporcionó ningún archivo");
  });
});
