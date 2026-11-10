import { Link } from 'react-router'

const TEXTOS = {
  no_conectado: 'Conecta tu cuenta de Google para subir archivos y crear carpetas en tu Drive.',
  reconectar: 'Google pide volver a conectar tu cuenta para seguir subiendo archivos y creando carpetas.',
  permisos_incompletos: 'Falta el permiso de Google Drive. Vuelve a conectar Google y acepta todos los permisos.',
}

// Invitación a Conexiones cuando Drive no se puede usar. Los archivos ya registrados se siguen viendo.
//   estado: 'no_conectado' | 'reconectar' | 'permisos_incompletos' (con null no muestra nada)
//   compacto: versión de una línea (para el panel de una entrega)
export default function AvisoDrive({ estado, compacto = false }) {
  if (!TEXTOS[estado]) return null
  return (
    <div
      role="status"
      className={`rounded-lg border border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200 ${
        compacto ? 'px-3 py-2 text-xs' : 'mb-4 px-3 py-2 text-sm'
      }`}
    >
      {TEXTOS[estado]}{' '}
      <Link to="/conexiones" className="font-medium underline">
        Ir a Conexiones
      </Link>
    </div>
  )
}
