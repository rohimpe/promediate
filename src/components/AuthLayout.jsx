// Tarjeta centrada que comparten Login y Registro.
export default function AuthLayout({ titulo, subtitulo, children }) {
  return (
    <main className="flex min-h-svh items-center justify-center bg-gray-50 p-4 dark:bg-gray-950">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <h1 className="text-2xl font-bold">{titulo}</h1>
        <p className="mt-1 mb-6 text-sm text-gray-600 dark:text-gray-400">{subtitulo}</p>
        {children}
      </div>
    </main>
  )
}
