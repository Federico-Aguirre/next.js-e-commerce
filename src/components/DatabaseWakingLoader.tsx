'use client';

export default function DatabaseWakingLoader() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center p-6 text-center">
      {/* Animación visual */}
      <div className="relative mb-6 flex h-24 w-24 items-center justify-center">
        <div className="absolute h-full w-full animate-spin rounded-full border-4 border-warning/25 border-t-warning"></div>
        <span className="animate-bounce text-3xl">⚡</span>
      </div>

      <h2 className="text-2xl font-bold text-foreground">Despertando la base de datos...</h2>

      <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
        Estamos utilizando una infraestructura gratuita. La base de datos entró en reposo por
        inactividad y se está encendiendo automáticamente.
      </p>

      <div className="mt-6 flex items-center gap-2 rounded-full border border-warning/25 bg-warning/10 px-4 py-2 text-xs text-warning-foreground">
        <span className="h-2 w-2 animate-ping rounded-full bg-warning" />
        Por favor espera unos 30-60 segundos. La página se cargará sola.
      </div>
    </div>
  );
}
