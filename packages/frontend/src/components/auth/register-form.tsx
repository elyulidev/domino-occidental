"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { signUp } from "@/app/actions/auth";
import type { AuthError, AuthErrorCode } from "@/lib/auth-validation";
import { createClient } from "@/lib/supabase/client";

export function RegisterForm() {
  const router = useRouter();
  const [authError, setAuthError] = useState<AuthError | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setAuthError(null);
    setMessage(null);

    const result = await signUp(formData);

    if (result?.error) {
      // Check if we can categorize further from the raw error
      setAuthError({
        code: "unknown",
        message: result.error,
      });
      setPending(false);
      return;
    }

    if (result?.success) {
      setMessage("¡Cuenta creada! Revisá tu correo para confirmar tu cuenta.");
      setPending(false);
      return;
    }

    router.push("/dashboard");
  }

  async function handleGoogleSignIn() {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setAuthError({
        code: "unknown",
        message: error.message,
      });
    }
  }

  function handleResend() {
    // TODO: implement resend confirmation email action
  }

  return (
    <div className="space-y-6">
      <form action={handleSubmit} className="space-y-5">
        {authError && (
          <ErrorAlert authError={authError} onResend={handleResend} />
        )}

        {message && (
          <div className="rounded-lg border border-green-500/50 bg-green-500/10 px-4 py-3 text-sm text-green-400">
            {message}
          </div>
        )}

        {/* Username */}
        <div>
          <label
            htmlFor="username"
            className="mb-1.5 block text-sm font-medium text-domino-200"
          >
            Nombre de usuario
          </label>
          <input
            id="username"
            name="username"
            type="text"
            placeholder="tuusuario"
            autoComplete="username"
            required
            className="block w-full rounded-lg border border-domino-700 bg-domino-800/50 px-4 py-2.5 text-sm text-white placeholder-domino-500 transition-colors focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/20"
          />
        </div>

        {/* Email */}
        <div>
          <label
            htmlFor="email"
            className="mb-1.5 block text-sm font-medium text-domino-200"
          >
            Correo electrónico
          </label>
          <input
            id="email"
            name="email"
            type="email"
            placeholder="tucorreo@ejemplo.com"
            autoComplete="email"
            required
            className="block w-full rounded-lg border border-domino-700 bg-domino-800/50 px-4 py-2.5 text-sm text-white placeholder-domino-500 transition-colors focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/20"
          />
        </div>

        {/* Password */}
        <div>
          <label
            htmlFor="password"
            className="mb-1.5 block text-sm font-medium text-domino-200"
          >
            Contraseña
          </label>
          <input
            id="password"
            name="password"
            type="password"
            placeholder="••••••••"
            autoComplete="new-password"
            required
            className="block w-full rounded-lg border border-domino-700 bg-domino-800/50 px-4 py-2.5 text-sm text-white placeholder-domino-500 transition-colors focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/20"
          />
        </div>

        {/* Confirm Password */}
        <div>
          <label
            htmlFor="confirm-password"
            className="mb-1.5 block text-sm font-medium text-domino-200"
          >
            Confirmar contraseña
          </label>
          <input
            id="confirm-password"
            name="confirmPassword"
            type="password"
            placeholder="••••••••"
            autoComplete="new-password"
            required
            className="block w-full rounded-lg border border-domino-700 bg-domino-800/50 px-4 py-2.5 text-sm text-white placeholder-domino-500 transition-colors focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/20"
          />
        </div>

        {/* Terms */}
        <div className="flex items-start gap-3">
          <input
            id="terms"
            type="checkbox"
            required
            className="mt-0.5 h-4 w-4 rounded border-domino-600 bg-domino-800 text-gold-500 focus:ring-gold-500/20 focus:ring-offset-0"
          />
          <label htmlFor="terms" className="text-sm text-domino-400">
            Acepto los{" "}
            <span className="text-domino-300 underline">
              Términos y condiciones
            </span>{" "}
            y la{" "}
            <span className="text-domino-300 underline">
              Política de privacidad
            </span>
          </label>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-gradient-to-r from-gold-500 to-gold-600 px-4 py-2.5 text-sm font-semibold text-domino-950 shadow-lg shadow-gold-500/20 transition-all hover:from-gold-400 hover:to-gold-500 active:scale-[0.98] disabled:opacity-50"
        >
          {pending ? "Creando cuenta..." : "Crear cuenta"}
        </button>
      </form>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-domino-700" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-domino-900 px-3 text-domino-400">
            O registrate con
          </span>
        </div>
      </div>

      {/* OAuth Buttons */}
      <div className="space-y-3">
        <button
          type="button"
          onClick={handleGoogleSignIn}
          className="flex w-full items-center justify-center gap-3 rounded-lg border border-domino-700 bg-domino-800/30 px-4 py-2.5 text-sm font-medium text-domino-200 transition-all hover:bg-domino-700/50 hover:text-white active:scale-[0.98]"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Google
        </button>
      </div>

      {/* Login link */}
      <p className="text-center text-sm text-domino-400">
        ¿Ya tenés cuenta?{" "}
        <a
          href="/login"
          className="font-medium text-gold-400 transition-colors hover:text-gold-300"
        >
          Iniciá sesión
        </a>
      </p>
    </div>
  );
}

function ErrorAlert({
  authError,
  onResend,
}: {
  authError: AuthError;
  onRetry?: () => void;
  onResend?: () => void;
}) {
  const { code, message, resend } = authError;

  const colorMap: Record<AuthErrorCode, string> = {
    invalid_credentials: "border-red-500/50 bg-red-500/10 text-red-400",
    email_not_confirmed: "border-red-500/50 bg-red-500/10 text-red-400",
    rate_limited: "border-orange-500/50 bg-orange-500/10 text-orange-400",
    network_error: "border-red-500/50 bg-red-500/10 text-red-400",
    email_already_registered: "border-red-500/50 bg-red-500/10 text-red-400",
    session_expired: "border-blue-500/50 bg-blue-500/10 text-blue-400",
    unknown: "border-red-500/50 bg-red-500/10 text-red-400",
  };

  return (
    <div
      role="alert"
      className={`rounded-lg border px-4 py-3 text-sm ${colorMap[code]}`}
    >
      <p>{message}</p>
      {resend && onResend && (
        <button
          type="button"
          onClick={onResend}
          className="mt-2 text-xs font-medium underline transition-colors hover:opacity-80"
        >
          Reenviar correo de confirmación
        </button>
      )}
    </div>
  );
}
