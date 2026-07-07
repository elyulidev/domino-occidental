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

export type { SignUpResult };

export type AuthActionResult = SignUpResult | { authError: AuthError };

export async function signUp(formData: FormData): Promise<SignUpResult> {
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
    return validation;
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
    return { error: categorized.message };
  }

  return {
    success: true,
    error: undefined,
    valid: undefined,
  };
}

export async function signIn(
  _previousState: unknown,
  formData: FormData,
): Promise<{ error?: string; authError?: AuthError }> {
  const email = (formData.get("email") as string) ?? "";
  const password = (formData.get("password") as string) ?? "";

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    const categorized = categorizeAuthError(error);
    return { error: categorized.message, authError: categorized };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}
