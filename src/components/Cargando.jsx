export default function Cargando() {
  return (
    <div className="flex min-h-svh items-center justify-center">
      <div
        role="status"
        aria-label="Cargando"
        className="size-8 animate-spin rounded-full border-4 border-gray-300 border-t-indigo-600 dark:border-gray-700 dark:border-t-indigo-400"
      />
    </div>
  )
}
