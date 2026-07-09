import Link from "next/link";

export default async function AuthErrorPage(props: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await props.searchParams;
  const message = error
    ? decodeURIComponent(error)
    : "Ocurrió un error inesperado durante la autenticación.";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-md rounded-lg border border-red-200 bg-red-50 p-8 text-center dark:border-red-800 dark:bg-red-950">
        <div className="mb-4 text-4xl">⚠️</div>
        <h1 className="mb-2 text-xl font-semibold text-red-800 dark:text-red-200">
          Error de autenticación
        </h1>
        <p className="mb-6 text-sm text-red-600 dark:text-red-400">{message}</p>
        <div className="flex flex-col gap-3">
          <Link
            href="/login"
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Volver a iniciar sesión
          </Link>
          <Link
            href="/"
            className="text-sm text-red-600 underline hover:text-red-800 dark:text-red-400"
          >
            Ir al inicio
          </Link>
        </div>
      </div>
    </main>
  );
}
