"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { validateProfileFields } from "@/lib/profile-validation";
import { createClient } from "@/lib/supabase/server";

export type ProfileFormState = {
  success?: boolean;
  error?: string;
  username?: string;
};

/**
 * Server action: update profile fields (username, country).
 * Follows the same useActionState pattern as auth.ts signUp/signIn.
 */
export async function updateProfile(
  _prevState: ProfileFormState | null,
  formData: FormData,
): Promise<ProfileFormState> {
  const username = (formData.get("username") as string) ?? "";
  const country = (formData.get("country") as string) ?? "";

  const validation = validateProfileFields({ username, country });
  if (validation.error) {
    return { error: validation.error };
  }

  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "No se pudo autenticar al usuario" };
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ username, country })
    .eq("id", user.id);

  if (updateError) {
    if (updateError.code === "23505") {
      return {
        error: "Ese nombre de usuario ya está en uso",
        username,
      };
    }
    return { error: "Error al actualizar el perfil" };
  }

  revalidatePath("/", "layout");
  redirect(`/profile/${username}`);
}

/**
 * Server action: upload avatar to Supabase Storage.
 * Triggered on file input onChange (not on form submit).
 */
const AVATAR_MAX_SIZE = 1 * 1024 * 1024; // 1 MB

export async function uploadAvatar(
  formData: FormData,
): Promise<{ url?: string; error?: string }> {
  try {
    const file = formData.get("avatar") as File | null;

    if (!file || file.size === 0) {
      return { error: "No se proporcionó ningún archivo" };
    }

    if (file.type !== "image/jpeg" && file.type !== "image/png") {
      return { error: "Solo se permiten archivos JPG o PNG" };
    }

    if (file.size > AVATAR_MAX_SIZE) {
      return { error: "La imagen no puede superar 1 MB" };
    }

    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { error: "No se pudo autenticar al usuario" };
    }

    const fileExt = file.type === "image/png" ? "png" : "jpg";
    const filePath = `${user.id}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, file);

    if (uploadError) {
      return { error: "Error al subir la imagen" };
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("avatars").getPublicUrl(filePath);

    const { error: dbError } = await supabase
      .from("profiles")
      .update({ avatar_url: publicUrl })
      .eq("id", user.id);

    if (dbError) {
      return { error: "Error al guardar la imagen en el perfil" };
    }

    return { url: publicUrl };
  } catch {
    return { error: "Error inesperado al subir la imagen" };
  }
}
