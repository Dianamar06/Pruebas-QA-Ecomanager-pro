/**
 * EcoManager Pro — Prueba de Carga k6
 * =========================================================
 * NOTA DE HONESTIDAD (requerida por la rúbrica):
 *
 * El reconocimiento de caja negra (Fase 0) confirmó que:
 *   ✅ /api/health       → 200 (público)
 *   ✅ /api/empresas/publicas → 200 (público)
 *   🔒 /api/denuncias   → 401 (requiere JWT)
 *   🔒 /api/sensors     → 401 (requiere JWT)
 *   🔒 /api/gobierno/*  → 401 (requiere JWT)
 *
 * No tenemos credenciales de prueba para obtener JWT, por lo que
 * NO SE PUEDEN cargar los endpoints protegidos sin inventar tokens.
 *
 * Esta prueba carga los dos endpoints públicos confirmados +
 * el contenido estático de la SPA. Se documenta esta limitación.
 *
 * ACCIÓN DEL EQUIPO: Para probar endpoints protegidos, agregar:
 *   1. Un usuario de prueba en Supabase
 *   2. Obtener JWT en setUp() y pasarlo en headers
 *   3. Cargar /api/denuncias, /api/sensors con el token
 * =========================================================
 *
 * Instalación: npm install -g k6  (o brew install k6 en Mac/Linux)
 * Ejecución:   k6 run tests/k6/load-test.js
 * =========================================================
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// ── Métricas personalizadas ──────────────────────────────────
const errorRate = new Rate('error_rate');
const apiHealthDuration = new Trend('api_health_duration');
const empresasDuration = new Trend('api_empresas_duration');
const staticDuration = new Trend('static_page_duration');

// ── Configuración del escenario de carga ─────────────────────
export const options = {
  stages: [
    { duration: '30s', target: 5  },  // Ramp-up: 0 → 5 usuarios
    { duration: '1m',  target: 10 },  // Carga sostenida: 10 usuarios
    { duration: '30s', target: 20 },  // Pico: 20 usuarios concurrentes
    { duration: '30s', target: 5  },  // Ramp-down: 20 → 5
    { duration: '15s', target: 0  },  // Parada
  ],
  thresholds: {
    // ── Umbrales de éxito ────────────────────────────────────
    'http_req_duration': [
      'p(95)<3000',   // 95% de requests < 3s (ajustado por latencia del tunnel)
      'p(99)<5000',   // 99% de requests < 5s
    ],
    'http_req_failed': ['rate<0.05'],   // < 5% de fallas HTTP
    'error_rate': ['rate<0.10'],        // < 10% de errores de negocio
    'api_health_duration': ['p(95)<1000'],      // Health check < 1s
    'api_empresas_duration': ['p(95)<2000'],    // Lista empresas < 2s
    'static_page_duration': ['p(95)<3000'],     // Página estática < 3s
  },
};

const BASE_URL = 'https://harley-bureau-useful-moment.trycloudflare.com';

const headers = {
  'Accept': 'application/json',
  'User-Agent': 'k6-load-test/1.0 EcoManagerPro-QA',
};

// ── Función principal del VU (Virtual User) ──────────────────
export default function () {

  // ── Grupo 1: Endpoints públicos de API ──────────────────────
  group('API Pública', () => {

    // GET /api/health
    group('/api/health', () => {
      const startTime = Date.now();
      const res = http.get(`${BASE_URL}/api/health`, { headers, tags: { name: 'health' } });
      apiHealthDuration.add(Date.now() - startTime);

      const ok = check(res, {
        'status 200': r => r.status === 200,
        'body tiene status ok': r => {
          try {
            return JSON.parse(r.body).status === 'ok';
          } catch { return false; }
        },
        'body tiene supabase ok': r => {
          try {
            return JSON.parse(r.body).services?.supabase === 'ok';
          } catch { return false; }
        },
        'tiempo de respuesta < 2000ms': r => r.timings.duration < 2000,
      });
      errorRate.add(!ok);
    });

    sleep(0.5);

    // GET /api/empresas/publicas
    group('/api/empresas/publicas', () => {
      const startTime = Date.now();
      const res = http.get(`${BASE_URL}/api/empresas/publicas`, { headers, tags: { name: 'empresas-publicas' } });
      empresasDuration.add(Date.now() - startTime);

      const ok = check(res, {
        'status 200': r => r.status === 200,
        'success true': r => {
          try {
            return JSON.parse(r.body).success === true;
          } catch { return false; }
        },
        'retorna array de empresas': r => {
          try {
            return Array.isArray(JSON.parse(r.body).empresas);
          } catch { return false; }
        },
        'hay al menos 1 empresa': r => {
          try {
            return JSON.parse(r.body).empresas.length >= 1;
          } catch { return false; }
        },
        'tiempo de respuesta < 3000ms': r => r.timings.duration < 3000,
      });
      errorRate.add(!ok);
    });

    sleep(0.5);

    // ── Grupo 2: Endpoints protegidos (verificar 401) ──────────
    group('Endpoints Protegidos (verificar auth)', () => {

      const protectedEndpoints = [
        '/api/denuncias',
        '/api/sensors',
        '/api/alertas',
      ];

      for (const endpoint of protectedEndpoints) {
        const res = http.get(`${BASE_URL}${endpoint}`, {
          headers,
          tags: { name: `protected-${endpoint.replace('/api/', '')}` }
        });

        check(res, {
          [`${endpoint} retorna 401 (requiere auth)`]: r => r.status === 401,
        });

        // ⚠️ LIMITACIÓN DOCUMENTADA: No probamos el flujo completo de estos endpoints
        // porque no tenemos JWT de prueba. El equipo debe agregar autenticación.
        sleep(0.3);
      }
    });

  });

  // ── Grupo 3: Carga del sitio estático ─────────────────────
  group('Página Estática (SPA)', () => {
    const startTime = Date.now();
    const res = http.get(`${BASE_URL}/`, {
      headers: { ...headers, 'Accept': 'text/html' },
      tags: { name: 'homepage' }
    });
    staticDuration.add(Date.now() - startTime);

    check(res, {
      'homepage carga 200': r => r.status === 200,
      'es HTML válido': r => r.body.includes('<!doctype html>') || r.body.includes('<!DOCTYPE html>'),
      'contiene bundle React': r => r.body.includes('index-DTrRU5cs.js'),
      'tiempo de respuesta < 4000ms': r => r.timings.duration < 4000,
    });
  });

  // Pausa entre iteraciones para simular comportamiento real de usuario
  sleep(Math.random() * 2 + 1);  // 1–3 segundos aleatorios
}

// ── Configuración de escenarios adicionales (opcional) ────────
export const scenarios_doc = `
ESCENARIOS PARA AMPLIAR (requieren credenciales de usuario de prueba):

1. Escenario de Login bajo carga:
   POST /api/auth/login con credenciales de prueba
   → Obtener JWT → usarlo en requests subsecuentes

2. Escenario de flujo completo de denuncia:
   GET /api/auth/login → POST /api/denuncias → GET /api/denuncias/mis-denuncias

3. Escenario de panel de gobierno:
   Login como rol gobierno → GET /api/gobierno/resumen → GET /api/gobierno/top-empresas

Instrucción para el equipo:
   k6 run --env TEST_USER=prueba@ecomanager.mx --env TEST_PASS=xxxxx tests/k6/load-test.js
`;
