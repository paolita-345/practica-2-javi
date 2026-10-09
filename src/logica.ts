export const CONFIG = {
  // Espera mínima en rojo, en milisegundos.
  ESPERA_ROJA_MIN_MS: 1000,
  // Espera máxima en rojo, en milisegundos.
  ESPERA_ROJA_MAX_MS: 5000,
  // Granularidad de la espera aleatoria, en milisegundos.
  PASO_ESPERA_MS: 1,
  // Multiplicador adimensional del generador seudoaleatorio.
  MULTIPLICADOR_ALEATORIO: 1664525,
  // Incremento adimensional del generador seudoaleatorio.
  INCREMENTO_ALEATORIO: 1013904223,
  // Cantidad de estados posibles del generador seudoaleatorio.
  MODULO_ALEATORIO: 4294967296,
} as const;

export type FaseJuego =
  | 'inactivo'
  | 'rojo'
  | 'verde'
  | 'amarillo'
  | 'resultado';

export type ColorPantalla = 'gris' | 'rojo' | 'verde' | 'amarillo';

export type GeneradorSemilla = () => number;

export interface EstadoJuego {
  fase: FaseJuego;
  color: ColorPantalla;
  tiempoActualMs: number;
  mejorMarcaMs: number | null;
  ultimoTiempoMs: number | null;
  inicioRojoMs: number | null;
  inicioVerdeMs: number | null;
  retardoVerdeMs: number | null;
  aleatorio: GeneradorSemilla;
}

function semillaValida(semilla: number): boolean {
  return (
    Number.isInteger(semilla) &&
    semilla >= 0 &&
    semilla < CONFIG.MODULO_ALEATORIO
  );
}

export function crearGeneradorSemilla(semilla: number): GeneradorSemilla {
  if (!semillaValida(semilla)) {
    throw new RangeError('La semilla debe ser un entero sin signo de 32 bits.');
  }

  let estado = semilla;

  return () => {
    estado =
      (Math.imul(estado, CONFIG.MULTIPLICADOR_ALEATORIO) +
        CONFIG.INCREMENTO_ALEATORIO) >>>
      0;
    return estado / CONFIG.MODULO_ALEATORIO;
  };
}

export function crearEstadoJuego(semilla: number): EstadoJuego {
  return {
    fase: 'inactivo',
    color: 'gris',
    tiempoActualMs: 0,
    mejorMarcaMs: null,
    ultimoTiempoMs: null,
    inicioRojoMs: null,
    inicioVerdeMs: null,
    retardoVerdeMs: null,
    aleatorio: crearGeneradorSemilla(semilla),
  };
}

export function iniciarJuego(
  estado: EstadoJuego,
  ahoraMs: number,
): boolean {
  if (
    (estado.fase !== 'inactivo' &&
      estado.fase !== 'amarillo' &&
      estado.fase !== 'resultado') ||
    !Number.isFinite(ahoraMs)
  ) {
    return false;
  }

  const cantidadPasos =
    (CONFIG.ESPERA_ROJA_MAX_MS - CONFIG.ESPERA_ROJA_MIN_MS) /
    CONFIG.PASO_ESPERA_MS;
  const pasoAleatorio = Math.floor(estado.aleatorio() * (cantidadPasos + 1));

  estado.fase = 'rojo';
  estado.color = 'rojo';
  estado.tiempoActualMs = 0;
  estado.ultimoTiempoMs = null;
  estado.inicioRojoMs = ahoraMs;
  estado.inicioVerdeMs = null;
  estado.retardoVerdeMs =
    CONFIG.ESPERA_ROJA_MIN_MS + pasoAleatorio * CONFIG.PASO_ESPERA_MS;

  return true;
}

export function actualizarEstadoTiempo(
  estado: EstadoJuego,
  ahoraMs: number,
): boolean {
  if (!Number.isFinite(ahoraMs)) {
    return false;
  }

  if (
    estado.fase === 'rojo' &&
    estado.inicioRojoMs !== null &&
    estado.retardoVerdeMs !== null
  ) {
    const inicioVerdeMs = estado.inicioRojoMs + estado.retardoVerdeMs;

    if (ahoraMs < inicioVerdeMs) {
      return true;
    }

    estado.fase = 'verde';
    estado.color = 'verde';
    estado.inicioVerdeMs = inicioVerdeMs;
    estado.tiempoActualMs = ahoraMs - inicioVerdeMs;
    return true;
  }

  if (estado.fase === 'verde' && estado.inicioVerdeMs !== null) {
    if (ahoraMs < estado.inicioVerdeMs) {
      return false;
    }

    estado.tiempoActualMs = ahoraMs - estado.inicioVerdeMs;
    return true;
  }

  return false;
}

function terminarIntento(estado: EstadoJuego, ahoraMs: number): boolean {
  if (estado.inicioVerdeMs === null || ahoraMs < estado.inicioVerdeMs) {
    return false;
  }

  const tiempoReaccionMs = ahoraMs - estado.inicioVerdeMs;
  estado.tiempoActualMs = tiempoReaccionMs;
  estado.ultimoTiempoMs = tiempoReaccionMs;
  estado.fase = 'resultado';
  estado.color = 'verde';

  if (
    estado.mejorMarcaMs === null ||
    tiempoReaccionMs < estado.mejorMarcaMs
  ) {
    estado.mejorMarcaMs = tiempoReaccionMs;
  }

  return true;
}

export function tocarPantalla(
  estado: EstadoJuego,
  ahoraMs: number,
): boolean {
  if (!Number.isFinite(ahoraMs)) {
    return false;
  }

  if (
    estado.fase === 'rojo' &&
    estado.inicioRojoMs !== null &&
    estado.retardoVerdeMs !== null
  ) {
    const inicioVerdeMs = estado.inicioRojoMs + estado.retardoVerdeMs;

    if (ahoraMs < estado.inicioRojoMs) {
      return false;
    }

    if (ahoraMs < inicioVerdeMs) {
      estado.fase = 'amarillo';
      estado.color = 'amarillo';
      estado.tiempoActualMs = 0;
      estado.ultimoTiempoMs = null;
      estado.inicioRojoMs = null;
      estado.inicioVerdeMs = null;
      estado.retardoVerdeMs = null;
      return true;
    }

    estado.fase = 'verde';
    estado.color = 'verde';
    estado.inicioVerdeMs = inicioVerdeMs;
    return terminarIntento(estado, ahoraMs);
  }

  if (estado.fase === 'verde') {
    return terminarIntento(estado, ahoraMs);
  }

  return false;
}

export function compararMarca(estado: EstadoJuego): number | null {
  return estado.mejorMarcaMs;
}
