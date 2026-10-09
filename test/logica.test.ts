import { describe, expect, it } from 'vitest';
import {
  CONFIG,
  actualizarEstadoTiempo,
  compararMarca,
  crearEstadoJuego,
  iniciarJuego,
  tocarPantalla,
} from '../src/logica';

describe('la lógica del juego', () => {
  it('arma correctamente el estado inicial', () => {
    const estado = crearEstadoJuego(123);

    expect(estado).toMatchObject({
      fase: 'inactivo',
      color: 'gris',
      tiempoActualMs: 0,
      mejorMarcaMs: null,
      ultimoTiempoMs: null,
      inicioRojoMs: null,
      inicioVerdeMs: null,
      retardoVerdeMs: null,
    });
    expect(estado.aleatorio()).toBeGreaterThanOrEqual(0);
    expect(estado.aleatorio()).toBeLessThan(1);
  });

  it('inicia una ronda válida y prepara la espera roja', () => {
    const estado = crearEstadoJuego(123);

    expect(iniciarJuego(estado, 100)).toBe(true);
    expect(estado).toMatchObject({
      fase: 'rojo',
      color: 'rojo',
      tiempoActualMs: 0,
      inicioRojoMs: 100,
      inicioVerdeMs: null,
    });
    expect(estado.retardoVerdeMs).toBeGreaterThanOrEqual(
      CONFIG.ESPERA_ROJA_MIN_MS,
    );
    expect(estado.retardoVerdeMs).toBeLessThanOrEqual(
      CONFIG.ESPERA_ROJA_MAX_MS,
    );
  });

  it('rechaza iniciar una ronda durante otra o con una hora inválida', () => {
    const estado = crearEstadoJuego(123);
    iniciarJuego(estado, 100);
    const retardoVerdeMs = estado.retardoVerdeMs;

    expect(iniciarJuego(estado, 200)).toBe(false);
    expect(iniciarJuego(crearEstadoJuego(123), Number.NaN)).toBe(false);
    expect(estado.fase).toBe('rojo');
    expect(estado.retardoVerdeMs).toBe(retardoVerdeMs);
  });

  it('actualiza el reloj y cambia de rojo a verde al cumplirse la espera', () => {
    const estado = crearEstadoJuego(123);
    iniciarJuego(estado, 100);
    const inicioVerdeMs = 100 + estado.retardoVerdeMs!;

    expect(actualizarEstadoTiempo(estado, inicioVerdeMs - 1)).toBe(true);
    expect(estado.fase).toBe('rojo');

    expect(actualizarEstadoTiempo(estado, inicioVerdeMs)).toBe(true);
    expect(estado).toMatchObject({
      fase: 'verde',
      color: 'verde',
      inicioVerdeMs,
      tiempoActualMs: 0,
    });
  });

  it('devuelve falso al actualizar con una hora inválida o en una fase sin reloj', () => {
    const estado = crearEstadoJuego(123);

    expect(actualizarEstadoTiempo(estado, Number.POSITIVE_INFINITY)).toBe(false);
    expect(actualizarEstadoTiempo(estado, 100)).toBe(false);
    expect(estado.fase).toBe('inactivo');
  });

  it('marca como salida en falso un toque durante la fase roja', () => {
    const estado = crearEstadoJuego(123);
    iniciarJuego(estado, 100);

    expect(tocarPantalla(estado, 101)).toBe(true);
    expect(estado).toMatchObject({
      fase: 'amarillo',
      color: 'amarillo',
      tiempoActualMs: 0,
      ultimoTiempoMs: null,
      inicioRojoMs: null,
      inicioVerdeMs: null,
      retardoVerdeMs: null,
    });
  });

  it('rechaza tocar la pantalla cuando no hay un intento activo', () => {
    const estado = crearEstadoJuego(123);

    expect(tocarPantalla(estado, 100)).toBe(false);
    expect(tocarPantalla(estado, Number.NaN)).toBe(false);
    expect(estado.fase).toBe('inactivo');
  });

  it('termina bien al tocar durante la fase verde y guarda la mejor marca', () => {
    const estado = crearEstadoJuego(123);
    iniciarJuego(estado, 100);
    const inicioVerdeMs = 100 + estado.retardoVerdeMs!;
    actualizarEstadoTiempo(estado, inicioVerdeMs);

    expect(tocarPantalla(estado, inicioVerdeMs + 275)).toBe(true);
    expect(estado).toMatchObject({
      fase: 'resultado',
      color: 'verde',
      tiempoActualMs: 275,
      ultimoTiempoMs: 275,
      mejorMarcaMs: 275,
    });
    expect(compararMarca(estado)).toBe(275);
  });

  it('permite recorrer una ronda completa hasta alcanzar el resultado bueno', () => {
    const estado = crearEstadoJuego(456);

    expect(iniciarJuego(estado, 0)).toBe(true);
    const inicioVerdeMs = estado.retardoVerdeMs!;
    expect(actualizarEstadoTiempo(estado, inicioVerdeMs)).toBe(true);
    expect(estado.fase).toBe('verde');
    expect(tocarPantalla(estado, inicioVerdeMs + 180)).toBe(true);

    expect(estado).toMatchObject({
      fase: 'resultado',
      color: 'verde',
      ultimoTiempoMs: 180,
      mejorMarcaMs: 180,
    });
  });
});
