"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  type AuthError,
  categorizeAuthError,
  type SignUpResult,
  validateSignUpFields,
} from "@/lib/auth-validation";
import { createClient } from "@/lib/supabase/server";
import { AUTHENTICATED_HOME } from "../supabase/proxy-rules";

export type AuthActionResult = SignUpResult | { authError: AuthError };

/** State type for useActionState in RegisterForm */
export type SignUpState = {
  authError?: AuthError;
  success?: boolean;
  message?: string;
};

export async function signUp(
  _prevState: SignUpState | null,
  formData: FormData,
): Promise<SignUpState | null> {
  const username = (formData.get("username") as string) ?? "";
  const email = (formData.get("email") as string) ?? "";
  const password = (formData.get("password") as string) ?? "";
  const confirmPassword = (formData.get("confirmPassword") as string) ?? "";

  const validation = validateSignUpFields({
    username,
    email,
    password,
    confirmPassword,
  });
  if (validation.error) {
    return {
      authError: {
        code: "unknown",
        message: validation.error,
      },
    };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username },
    },
  });

  if (error) {
    const categorized = categorizeAuthError(error);
    return { authError: categorized };
  }

  return {
    success: true,
    message: "¡Cuenta creada! Revisá tu correo para confirmar tu cuenta.",
  };
}

export async function signIn(
  _prevState: AuthError | null,
  formData: FormData,
): Promise<AuthError | null> {
  const email = (formData.get("email") as string) ?? "";
  const password = (formData.get("password") as string) ?? "";
  const next = (formData.get("next") as string) || AUTHENTICATED_HOME;

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return categorizeAuthError(error);
  }

  revalidatePath("/", "layout");
  redirect(next);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}
