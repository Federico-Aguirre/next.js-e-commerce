'use client';

export default function DatabaseWakingLoader() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] p-6 text-center">
      {/* Animación visual */}
      <div className="relative flex items-center justify-center w-24 h-24 mb-6">
        <div className="absolute w-full h-full border-4 border-amber-200 border-t-amber-500 rounded-full animate-spin"></div>
        <span className="text-3xl animate-bounce">⚡</span>
      </div>

      <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
        Despertando la base de datos...
      </h2>

      <p className="max-w-md mt-3 text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
        Estamos utilizando una infraestructura gratuita. La base de datos entró en reposo por inactividad y se está encendiendo automáticamente.
      </p>

      <div className="mt-6 flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-full text-xs text-amber-700 dark:text-amber-300">
        <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
        Por favor espera unos 30-60 segundos. La página se cargará sola.
      </div>
    </div>
  );
}