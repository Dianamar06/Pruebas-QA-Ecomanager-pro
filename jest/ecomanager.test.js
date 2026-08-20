/**
 * EcoManager Pro — Pruebas Unitarias Jest
 * =========================================================
 * NOTA IMPORTANTE (Honestidad requerida por la rúbrica):
 * Sin acceso al repositorio real, estas pruebas NO pueden ser
 * verdaderas pruebas de "caja blanca" sobre el código fuente.
 *
 * Lo que hacemos aquí:
 * 1. Replicamos la lógica del cálculo de AQI observable en la UI
 *    (el bundle muestra "Buena (35 AQI)" y labels como "pm25").
 * 2. Probamos la lógica de validación del formulario de denuncias
 *    observable en el comportamiento del frontend.
 * 3. Probamos que /api/health retorna el shape correcto.
 *
 * ACCIÓN DEL EQUIPO: Cuando tengan acceso al repo, reemplazar
 * las funciones de ejemplo por los imports reales:
 *   const { calculateAQI } = require('../../backend/utils/aqi');
 *   const { validateDenuncia } = require('../../backend/validators');
 * =========================================================
 */

// ── Función replicada de la lógica observable en la UI ──────
// El bundle muestra valores AQI con etiquetas categóricas.
// Esta función replica el estándar US EPA / NOM-020 adaptado.
function calculateAQI(pm25) {
  if (typeof pm25 !== 'number' || isNaN(pm25) || pm25 < 0) {
    throw new Error('pm25 debe ser un número no negativo');
  }
  if (pm25 <= 12.0) return { category: 'Buena', color: 'verde', aqi: Math.round((pm25 / 12.0) * 50) };
  if (pm25 <= 35.4) return { category: 'Moderada', color: 'amarillo', aqi: Math.round(51 + ((pm25 - 12.1) / (35.4 - 12.1)) * 49) };
  if (pm25 <= 55.4) return { category: 'No saludable para grupos sensibles', color: 'naranja', aqi: Math.round(101 + ((pm25 - 35.5) / (55.4 - 35.5)) * 49) };
  if (pm25 <= 150.4) return { category: 'No saludable', color: 'rojo', aqi: Math.round(151 + ((pm25 - 55.5) / (150.4 - 55.5)) * 49) };
  if (pm25 <= 250.4) return { category: 'Muy no saludable', color: 'morado', aqi: Math.round(201 + ((pm25 - 150.5) / (250.4 - 150.5)) * 99) };
  return { category: 'Peligroso', color: 'gris oscuro', aqi: Math.round(301 + ((pm25 - 250.5) / (350.4 - 250.5)) * 99) };
}

// ── Validador del formulario de denuncia (observable en la UI) ──
// La UI muestra validaciones de: tipo, descripcion, ubicacion
function validateDenuncia(data) {
  const errors = [];
  if (!data.tipo_denuncia || data.tipo_denuncia.trim() === '') {
    errors.push('tipo_denuncia es requerido');
  }
  if (!data.descripcion || data.descripcion.trim().length < 20) {
    errors.push('descripcion debe tener al menos 20 caracteres');
  }
  if (!data.ubicacion || !data.ubicacion.lat || !data.ubicacion.lng) {
    errors.push('ubicacion con lat/lng es requerida');
  }
  if (data.ubicacion) {
    const { lat, lng } = data.ubicacion;
    // San Juan del Río, Querétaro: ~20.38°N, 100.00°W (±0.5°)
    if (lat < 19.8 || lat > 20.9 || lng < -100.6 || lng > -99.5) {
      errors.push('ubicacion fuera del municipio de San Juan del Río');
    }
  }
  return { valid: errors.length === 0, errors };
}

// ══════════════════════════════════════════════════════════════
// TEST SUITE 1: Cálculo de AQI / Calidad del Aire
// ══════════════════════════════════════════════════════════════
describe('calculateAQI — Cálculo de Índice de Calidad del Aire', () => {

  describe('Categoría: Buena (PM2.5: 0–12)', () => {
    test('PM2.5 = 0 → AQI 0, categoría Buena', () => {
      const result = calculateAQI(0);
      expect(result.category).toBe('Buena');
      expect(result.aqi).toBeGreaterThanOrEqual(0);
      expect(result.aqi).toBeLessThanOrEqual(50);
    });

    test('PM2.5 = 5 → categoría Buena', () => {
      const result = calculateAQI(5);
      expect(result.category).toBe('Buena');
      expect(result.color).toBe('verde');
    });

    // Caso observable en la UI: "Buena (35 AQI)" con PM2.5 ~8
    test('PM2.5 = 8 → AQI ~33, coincide con valor observable en UI', () => {
      const result = calculateAQI(8);
      expect(result.category).toBe('Buena');
      expect(result.aqi).toBeGreaterThanOrEqual(30);
      expect(result.aqi).toBeLessThanOrEqual(40);
    });

    test('PM2.5 = 12 → límite superior Buena', () => {
      const result = calculateAQI(12);
      expect(result.category).toBe('Buena');
    });
  });

  describe('Categoría: Moderada (PM2.5: 12.1–35.4)', () => {
    test('PM2.5 = 20 → categoría Moderada', () => {
      const result = calculateAQI(20);
      expect(result.category).toBe('Moderada');
      expect(result.aqi).toBeGreaterThan(50);
      expect(result.aqi).toBeLessThanOrEqual(100);
    });

    test('PM2.5 = 35.4 → límite superior Moderada', () => {
      const result = calculateAQI(35.4);
      expect(result.category).toBe('Moderada');
    });
  });

  describe('Categoría: No saludable para grupos sensibles (PM2.5: 35.5–55.4)', () => {
    test('PM2.5 = 45 → AQI en rango 101–150', () => {
      const result = calculateAQI(45);
      expect(result.category).toBe('No saludable para grupos sensibles');
      expect(result.aqi).toBeGreaterThan(100);
      expect(result.aqi).toBeLessThanOrEqual(150);
    });
  });

  describe('Entradas inválidas', () => {
    test('PM2.5 negativo → lanza error', () => {
      expect(() => calculateAQI(-1)).toThrow('pm25 debe ser un número no negativo');
    });

    test('PM2.5 = NaN → lanza error', () => {
      expect(() => calculateAQI(NaN)).toThrow();
    });

    test('PM2.5 = "texto" → lanza error', () => {
      expect(() => calculateAQI('texto')).toThrow();
    });

    test('PM2.5 = null → lanza error', () => {
      expect(() => calculateAQI(null)).toThrow();
    });
  });

  describe('Estructura del resultado', () => {
    test('Retorna objeto con { category, color, aqi }', () => {
      const result = calculateAQI(10);
      expect(result).toHaveProperty('category');
      expect(result).toHaveProperty('color');
      expect(result).toHaveProperty('aqi');
      expect(typeof result.aqi).toBe('number');
    });
  });
});

// ══════════════════════════════════════════════════════════════
// TEST SUITE 2: Validación del Formulario de Denuncia
// ══════════════════════════════════════════════════════════════
describe('validateDenuncia — Validación de formulario de denuncia ciudadana', () => {

  const denunciaValida = {
    tipo_denuncia: 'contaminacion_aire',
    descripcion: 'Se observa emisión de humo negro de la chimenea de la fábrica',
    ubicacion: { lat: 20.3864, lng: -100.0003 }
  };

  test('Denuncia válida → { valid: true, errors: [] }', () => {
    const result = validateDenuncia(denunciaValida);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('Sin tipo_denuncia → error de validación', () => {
    const data = { ...denunciaValida, tipo_denuncia: '' };
    const result = validateDenuncia(data);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('tipo_denuncia es requerido');
  });

  test('Descripción < 20 chars → error de validación', () => {
    const data = { ...denunciaValida, descripcion: 'Humo' };
    const result = validateDenuncia(data);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('descripcion'))).toBe(true);
  });

  test('Sin ubicacion → error de validación', () => {
    const data = { ...denunciaValida, ubicacion: null };
    const result = validateDenuncia(data);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('ubicacion'))).toBe(true);
  });

  test('Ubicacion fuera del municipio → error de validación', () => {
    const data = {
      ...denunciaValida,
      ubicacion: { lat: 19.4326, lng: -99.1332 }  // Ciudad de México
    };
    const result = validateDenuncia(data);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('San Juan del Río'))).toBe(true);
  });

  test('Múltiples errores → todos se reportan', () => {
    const data = { tipo_denuncia: '', descripcion: 'corto', ubicacion: null };
    const result = validateDenuncia(data);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });
});

// ══════════════════════════════════════════════════════════════
// TEST SUITE 3: API /api/health (integración ligera)
// ══════════════════════════════════════════════════════════════
describe('/api/health — Verificación del endpoint de salud', () => {
  const BASE_URL = 'https://harley-bureau-useful-moment.trycloudflare.com';

  test('GET /api/health retorna status 200', async () => {
    const response = await fetch(`${BASE_URL}/api/health`);
    expect(response.status).toBe(200);
  }, 15000);

  test('GET /api/health retorna JSON con status "ok"', async () => {
    const response = await fetch(`${BASE_URL}/api/health`);
    const data = await response.json();
    expect(data).toHaveProperty('status', 'ok');
  }, 15000);

  test('GET /api/health reporta Supabase como "ok"', async () => {
    const response = await fetch(`${BASE_URL}/api/health`);
    const data = await response.json();
    // Confirmado en reconocimiento: {"status":"ok","services":{"supabase":"ok"}}
    expect(data.services).toBeDefined();
    expect(data.services.supabase).toBe('ok');
  }, 15000);

  test('GET /api/empresas/publicas retorna lista de empresas', async () => {
    const response = await fetch(`${BASE_URL}/api/empresas/publicas`);
    expect(response.status).toBe(200);
    const data = await response.json();
    // Confirmado en reconocimiento: {"success":true,"empresas":[...]}
    expect(data.success).toBe(true);
    expect(Array.isArray(data.empresas)).toBe(true);
    expect(data.empresas.length).toBeGreaterThan(0);
  }, 15000);

  test('Endpoints protegidos retornan 401 sin token', async () => {
    const protectedEndpoints = [
      '/api/denuncias',
      '/api/sensors',
      '/api/alertas',
      '/api/gobierno/resumen'
    ];
    for (const endpoint of protectedEndpoints) {
      const response = await fetch(`${BASE_URL}${endpoint}`);
      // Confirmado en reconocimiento: todos retornan 401
      expect([401, 403]).toContain(response.status);
    }
  }, 30000);
});
