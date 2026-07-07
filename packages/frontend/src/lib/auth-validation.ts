export type SignUpResult = {
  error?: string;
  success?: boolean;
  valid?: boolean;
};

export type AuthErrorCode =
  | "invalid_credentials"
  | "email_not_confirmed"
  | "rate_limited"
  | "network_error"
  | "email_already_registered"
  | "session_expired"
  | "unknown";

export interface AuthError {
  code: AuthErrorCode;
  message: string;
  retry?: boolean;
  waitSeconds?: number;
  resend?: boolean;
}

function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError) return true;
  if (error instanceof Error && error.name === "FetchError") return true;
  if (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    (error as { status: number }).status === 0
  )
    return true;
  return false;
}

export function categorizeAuthError(error: {
  message?: string;
  status?: number;
}): AuthError {
  const msg = error.message?.toLowerCase() ?? "";
  const status = error.status;

  if (isNetworkError(error)) {
    return {
      code: "network_error",
      message: "Error de conexión. Verificá tu red y volvé a intentar.",
      retry: true,
    };
  }

  if (
    status === 429 ||
    msg.includes("rate limit") ||
    msg.includes("too many requests")
  ) {
    return {
      code: "rate_limited",
      message:
        "Demasiados intentos. Esperá unos segundos antes de volver a intentar.",
      waitSeconds: 60,
    };
  }

  if (msg.includes("email not confirmed")) {
    return {
      code: "email_not_confirmed",
      message: "Tu correo aún no fue confirmado. Revisá tu bandeja de entrada.",
      resend: true,
    };
  }

  if (msg.includes("invalid login credentials")) {
    return {
      code: "invalid_credentials",
      message: "Credenciales inválidas",
    };
  }

  if (status === 401 && (msg.includes("session") || msg.includes("jwt"))) {
    return {
      code: "session_expired",
      message: "Tu sesión expiró. Iniciá sesión de nuevo.",
    };
  }

  if (msg.includes("already registered") || msg.includes("already exists")) {
    return {
      code: "email_already_registered",
      message: "El correo ya está registrado",
    };
  }

  return {
    code: "unknown",
    message: error.message ?? "Error desconocido",
  };
}

export function validateSignUpFields(fields: {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}): SignUpResult {
  if (!fields.username.trim()) {
    return { error: "El nombre de usuario es requerido" };
  }
  if (!fields.email.trim()) {
    return { error: "El correo electrónico es requerido" };
  }
  if (fields.password.length < 6) {
    return { error: "La contraseña debe tener al menos 6 caracteres" };
  }
  if (fields.password !== fields.confirmPassword) {
    return { error: "Las contraseñas no coinciden" };
  }
  return { valid: true };
}
