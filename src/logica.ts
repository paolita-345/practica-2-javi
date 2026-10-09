export const CONFIG = {
  // Tiempo en milisegundos de cada paso de la cuenta regresiva.
  TIEMPO_CUENTA_REGRESIVA_MS: 1000,
  // Número inicial de la cuenta regresiva.
  CUENTA_INICIAL: 3,
  // Mínimo de espera en rojo antes del cambio a verde, en milisegundos.
  ESPERA_ROJO_MIN_MS: 1500,
  // Máximo de espera en rojo antes del cambio a verde, en milisegundos.
  ESPERA_ROJO_MAX_MS: 3500,
  // Duración del aviso de toque anticipado, en milisegundos.
  DURACION_TOQUE_ANTICIPADO_MS: 800,
  // Duración del estado de preparación/espera, en milisegundos.
  DURACION_ESPERA_MS: 200,
  // Duración máxima de intento aceptado antes de invalidarlo, en milisegundos.
  TIEMPO_MAXIMO_INTENTO_MS: 10000,
};

export type FaseJuego =
  | 'inactivo'
  | 'cuenta'
  | 'rojo'
  | 'verde'
  | 'amarillo'
  | 'resultado';

export type ColorPantalla = 'gris' | 'rojo' | 'verde' | 'amarillo';

export interface EstadoJuego {
  fase: FaseJuego;
  color: ColorPantalla;
  cuentaRegresiva: number;
  tiempoActualMs: number;
  mejorMarcaMs: number | null;
  ultimoTiempoMs: number | null;
  inicioRojoMs: number | null;
  inicioVerdeMs: number | null;
  retardoVerdeMs: number;
  semilla: number;
  aleatorio: () => number;
}

export type GeneradorSemilla = () => number;

export function crearGeneradorSemilla(seed: number): GeneradorSemilla {
  let estado = seed >>> 0;

  return () => {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let temporaria = Math.imul(estado ^ (estado >>> 15), 1 | estado);
    temporaria = (temporaria + Math.imul(temporaria ^ (temporaria >>> 7), 61 | temporaria) ^ temporaria) >>> 0;
    return (temporaria ^ (temporaria >>> 14)) / 4294967296;
  };
}

export function crearEstadoJuego(semilla = 1): EstadoJuego {
  return {
    fase: 'inactivo',
    color: 'gris',
    cuentaRegresiva: CONFIG.CUENTA_INICIAL,
    tiempoActualMs: 0,
    mejorMarcaMs: null,
    ultimoTiempoMs: null,
    inicioRojoMs: null,
    inicioVerdeMs: null,
    retardoVerdeMs: 0,
    semilla,
    aleatorio: crearGeneradorSemilla(semilla),
  };
}

export function iniciarJuego(estado: EstadoJuego): boolean {
  if (estado.fase !== 'inactivo' && estado.fase !== 'resultado') {
    return false;
  }

  estado.fase = 'cuenta';
  estado.color = 'gris';
  estado.cuentaRegresiva = CONFIG.CUENTA_INICIAL;
  estado.tiempoActualMs = 0;
  estado.ultimoTiempoMs = null;
  estado.inicioRojoMs = null;
  estado.inicioVerdeMs = null;
  estado.retardoVerdeMs = Math.round(
    CONFIG.ESPERA_ROJO_MIN_MS +
      estado.aleatorio() * (CONFIG.ESPERA_ROJO_MAX_MS - CONFIG.ESPERA_ROJO_MIN_MS),
  );

  return true;
}

export function avanzarCuentaRegresiva(estado: EstadoJuego): boolean {
  if (estado.fase !== 'cuenta') {
    return false;
  }

  if (estado.cuentaRegresiva > 1) {
    estado.cuentaRegresiva -= 1;
    return true;
  }

  estado.cuentaRegresiva = 0;
  estado.fase = 'rojo';
  estado.color = 'rojo';
  estado.inicioRojoMs = 0;
  estado.inicioVerdeMs = null;
  estado.tiempoActualMs = 0;
  return true;
}

export function actualizarEstadoTiempo(estado: EstadoJuego, ahoraMs: number): boolean {
  if (estado.fase === 'rojo') {
    if (estado.inicioRojoMs === null) {
      estado.inicioRojoMs = ahoraMs;
      return true;
    }

    const diferencia = ahoraMs - estado.inicioRojoMs;

    if (diferencia >= estado.retardoVerdeMs) {
      estado.fase = 'verde';
      estado.color = 'verde';
      estado.inicioVerdeMs = ahoraMs;
      estado.tiempoActualMs = 0;
      return true;
    }

    estado.tiempoActualMs = diferencia;
    return true;
  }

  if (estado.fase === 'verde' && estado.inicioVerdeMs !== null) {
    estado.tiempoActualMs = ahoraMs - estado.inicioVerdeMs;
    return true;
  }

  return false;
}

export function guardarNuevaMarca(estado: EstadoJuego, tiempoMs: number): boolean {
  if (tiempoMs < 0) {
    return false;
  }

  if (estado.mejorMarcaMs === null || tiempoMs < estado.mejorMarcaMs) {
    estado.mejorMarcaMs = tiempoMs;
    return true;
  }

  return false;
}

export function tocarPantalla(estado: EstadoJuego, ahoraMs: number): boolean {
  if (estado.fase === 'inactivo' || estado.fase === 'cuenta') {
    return false;
  }

  if (estado.fase === 'rojo') {
    estado.fase = 'amarillo';
    estado.color = 'amarillo';
    estado.ultimoTiempoMs = null;
    estado.tiempoActualMs = estado.inicioRojoMs === null ? 0 : ahoraMs - estado.inicioRojoMs;
    return false;
  }

  if (estado.fase === 'verde' && estado.inicioVerdeMs !== null) {
    const tiempo = ahoraMs - estado.inicioVerdeMs;
    estado.ultimoTiempoMs = tiempo;
    estado.tiempoActualMs = tiempo;
    estado.fase = 'resultado';
    estado.color = 'verde';

    const marcaActualizada = guardarNuevaMarca(estado, tiempo);
    return marcaActualizada || estado.mejorMarcaMs === tiempo;
  }

  return false;
}

export function compararMarca(estado: EstadoJuego): number | null {
  return estado.mejorMarcaMs;
}

export function reiniciarAlEstadoBase(estado: EstadoJuego): boolean {
  if (estado.fase === 'inactivo') {
    return false;
  }

  const estadoBase = crearEstadoJuego(estado.semilla);
  Object.assign(estado, estadoBase);
  return true;
}
