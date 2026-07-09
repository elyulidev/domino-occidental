import Link from "next/link";

export default function PrivacyPage() {
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
        Política de Privacidad
      </h1>

      <div className="space-y-6 text-sm leading-relaxed text-domino-300">
        <section>
          <h2 className="mb-3 text-lg font-semibold text-white">
            1. Información que Recopilamos
          </h2>
          <p>
            Recopilamos la siguiente información cuando creás una cuenta y usás
            la plataforma:
          </p>
          <ul className="mt-2 list-inside list-disc space-y-1 pl-4">
            <li>Nombre de usuario y dirección de correo electrónico</li>
            <li>
              Datos de perfil: avatar, país, preferencias de juego
            </li>
            <li>
              Estadísticas de juego: historial de partidas, ELO, logros
            </li>
            <li>
              Datos de uso: páginas visitadas, duración de sesiones
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-white">
            2. Cómo Usamos tu Información
          </h2>
          <p>Usamos tu información para:</p>
          <ul className="mt-2 list-inside list-disc space-y-1 pl-4">
            <li>Crear y mantener tu cuenta</li>
            <li>
              Proveer el servicio de juego en tiempo real y emparejamiento
            </li>
            <li>Calcular y mostrar rankings ELO</li>
            <li>Procesar pagos y suscripciones (si aplica)</li>
            <li>Enviar notificaciones y comunicaciones del servicio</li>
            <li>Mejorar la plataforma y detectar problemas técnicos</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-white">
            3. Almacenamiento y Seguridad
          </h2>
          <p>
            Tus datos se almacenan en servidores seguros con cifrado en
            tránsito (TLS) y en reposo. Implementamos medidas de seguridad
            técnicas y organizativas para proteger tu información contra acceso
            no autorizado, pérdida o alteración.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-white">
            4. Compartición de Datos
          </h2>
          <p>
            No vendemos tu información personal a terceros. Podemos compartir
            datos limitados con:
          </p>
          <ul className="mt-2 list-inside list-disc space-y-1 pl-4">
            <li>
              Proveedores de servicios (Stripe para pagos, Supabase para
              infraestructura)
            </li>
            <li>
              Autoridades legales cuando sea requerido por ley
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-white">
            5. Tus Derechos
          </h2>
          <p>Tenés derecho a:</p>
          <ul className="mt-2 list-inside list-disc space-y-1 pl-4">
            <li>Acceder a tus datos personales</li>
            <li>Solicitar la corrección de datos incorrectos</li>
            <li>Solicitar la eliminación de tu cuenta y datos asociados</li>
            <li>Exportar tus datos en formato estructurado</li>
            <li>Revocar el consentimiento en cualquier momento</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-white">
            6. Cookies
          </h2>
          <p>
            Usamos cookies esenciales para el funcionamiento de la plataforma
            (autenticación, sesión). No usamos cookies de rastreo de terceros
            con fines publicitarios. Podés configurar tu navegador para
            rechazar cookies, aunque algunas funciones podrían no funcionar
            correctamente.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-white">
            7. Menores de Edad
          </h2>
          <p>
            El servicio no está dirigido a menores de 13 años. No recopilamos
            intencionalmente información de menores. Si descubrimos que un menor
            nos ha proporcionado datos personales, eliminaremos esa información.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-white">
            8. Cambios a esta Política
          </h2>
          <p>
            Podemos actualizar esta política periódicamente. Te notificaremos
            los cambios significativos a través de la plataforma o por correo
            electrónico.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-white">
            9. Contacto
          </h2>
          <p>
            Si tenés preguntas sobre esta política de privacidad, podés
            contactarnos a través de la plataforma o por correo electrónico.
          </p>
        </section>

        <p className="pt-4 text-xs text-domino-500">
          Última actualización: Julio 2026
        </p>
      </div>
    </div>
  );
}
