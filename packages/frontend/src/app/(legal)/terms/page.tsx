import Link from "next/link";

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Back link */}
      <Link
        href="/register"
        className="mb-6 inline-flex items-center gap-2 text-sm text-domino-400 transition-colors hover:text-white"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="h-4 w-4"
        >
          <path d="M15 19l-7-7 7-7" />
        </svg>
        Volver al registro
      </Link>

      <h1 className="mb-8 text-3xl font-bold text-white">
        Términos y Condiciones
      </h1>

      <div className="space-y-6 text-sm leading-relaxed text-domino-300">
        <section>
          <h2 className="mb-3 text-lg font-semibold text-white">
            1. Aceptación de los Términos
          </h2>
          <p>
            Al registrarte y utilizar Dominó Occidental, aceptás estos Términos
            y Condiciones en su totalidad. Si no estás de acuerdo con alguna
            parte, no podrás usar la plataforma.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-white">
            2. Descripción del Servicio
          </h2>
          <p>
            Dominó Occidental es una plataforma web multijugador para jugar
            dominó por parejas con el conjunto doble-9. El servicio incluye
            juego en tiempo real, sistema de emparejamiento, torneos, ranking
            ELO, y funcionalidades sociales.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-white">
            3. Cuentas de Usuario
          </h2>
          <p>
            Para usar la plataforma necesitás crear una cuenta. Sos responsable
            de mantener la confidencialidad de tu contraseña y de toda actividad
            que ocurra bajo tu cuenta. No podés usar la cuenta de otro usuario
            sin autorización.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-white">
            4. Conducta del Usuario
          </h2>
          <p>No está permitido:</p>
          <ul className="mt-2 list-inside list-disc space-y-1 pl-4">
            <li>Hacer trampa o usar software no autorizado</li>
            <li>Crear múltiples cuentas para evadir restricciones</li>
            <li>Acosar, insultar o intimidar a otros jugadores</li>
            <li>Explotar bugs o vulnerabilidades de la plataforma</li>
            <li>Usar la plataforma para actividades ilegales</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-white">
            5. Propiedad Intelectual
          </h2>
          <p>
            Todo el contenido de Dominó Occidental, incluyendo código, diseño,
            gráficos y marca, es propiedad de los desarrolladores. No está
            permitida su reproducción sin autorización.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-white">
            6. Limitación de Responsabilidad
          </h2>
          <p>
            Dominó Occidental se proporciona &quot;tal cual&quot;, sin garantías de
            disponibilidad continua o ausencia de errores. No nos
            responsabilizamos por daños directos o indirectos derivados del uso
            de la plataforma.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-white">
            7. Modificaciones
          </h2>
          <p>
            Nos reservamos el derecho de modificar estos términos en cualquier
            momento. Los cambios serán notificados a través de la plataforma.
            El uso continuado después de los cambios constituye aceptación.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-white">
            8. Terminación
          </h2>
          <p>
            Podemos suspender o cancelar tu cuenta si violás estos términos. En
            caso de cancelación, perderás el acceso a tu cuenta y a las monedas
            virtuales asociadas.
          </p>
        </section>

        <p className="pt-4 text-xs text-domino-500">
          Última actualización: Julio 2026
        </p>
      </div>
    </div>
  );
}
