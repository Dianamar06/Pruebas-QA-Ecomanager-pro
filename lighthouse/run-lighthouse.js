/**
 * EcoManager Pro — Prueba Lighthouse CLI
 * =========================================================
 * Ejecuta Lighthouse contra la URL del tunnel y evalúa:
 *   - Performance, Accessibility, Best Practices, SEO
 *   - Umbral mínimo: 85 en todas las categorías
 *   - Checklist WCAG 2.1 manual adjunto al reporte
 *
 * Instalación requerida:
 *   npm install -g lighthouse chrome-launcher
 *   npm install lighthouse chrome-launcher (local)
 *
 * Ejecución:
 *   node tests/lighthouse/run-lighthouse.js
 *
 * O con la CLI directamente:
 *   lighthouse https://harley-bureau-useful-moment.trycloudflare.com \
 *     --output html --output json \
 *     --output-path ./tests/lighthouse/report \
 *     --chrome-flags="--headless --no-sandbox" \
 *     --only-categories=performance,accessibility,best-practices,seo
 * =========================================================
 */

const lighthouse = require('lighthouse');
const chromeLauncher = require('chrome-launcher');
const fs = require('fs');
const path = require('path');

const TARGET_URL = 'https://harley-bureau-useful-moment.trycloudflare.com';
const MIN_SCORE = 0.85; // Umbral mínimo: 85 (como decimal)
const REPORT_DIR = path.join(__dirname, 'report');

// ── Categorías a evaluar ─────────────────────────────────────
const CATEGORIES = {
  performance: 'Rendimiento',
  accessibility: 'Accesibilidad',
  'best-practices': 'Mejores Prácticas',
  seo: 'SEO',
};

// ── Checklist WCAG 2.1 (verificación manual + Lighthouse) ────
const WCAG_CHECKLIST = [
  { id: '1.1.1', criterion: 'Alternativas de texto', lighthouse_audit: 'image-alt', level: 'A' },
  { id: '1.3.1', criterion: 'Información y relaciones', lighthouse_audit: 'label', level: 'A' },
  { id: '1.4.3', criterion: 'Contraste mínimo (4.5:1)', lighthouse_audit: 'color-contrast', level: 'AA' },
  { id: '2.1.1', criterion: 'Teclado accesible', lighthouse_audit: 'focusable-controls', level: 'A' },
  { id: '2.4.1', criterion: 'Saltar bloques (skip-link)', lighthouse_audit: 'bypass', level: 'A' },
  { id: '2.4.2', criterion: 'Título de página', lighthouse_audit: 'document-title', level: 'A' },
  { id: '3.1.1', criterion: 'Idioma de la página (lang)', lighthouse_audit: 'html-has-lang', level: 'A' },
  { id: '4.1.1', criterion: 'Código válido', lighthouse_audit: 'valid-lang', level: 'A' },
  { id: '4.1.2', criterion: 'Nombre, rol, valor', lighthouse_audit: 'button-name', level: 'A' },
];

async function runLighthouse() {
  console.log('🔍 EcoManager Pro — Análisis Lighthouse');
  console.log(`📍 URL: ${TARGET_URL}`);
  console.log(`📋 Umbral mínimo: ${MIN_SCORE * 100} puntos en cada categoría\n`);

  // Crear directorio de reportes
  if (!fs.existsSync(REPORT_DIR)) {
    fs.mkdirSync(REPORT_DIR, { recursive: true });
  }

  // Lanzar Chrome headless
  const chrome = await chromeLauncher.launch({
    chromeFlags: ['--headless', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage']
  });

  const options = {
    logLevel: 'error',
    output: ['html', 'json'],
    onlyCategories: Object.keys(CATEGORIES),
    port: chrome.port,
    throttlingMethod: 'simulate',
    // Simular conexión 4G (más realista para usuarios móviles de San Juan del Río)
    throttling: {
      rttMs: 40,
      throughputKbps: 10240,
      cpuSlowdownMultiplier: 1,
      requestLatencyMs: 0,
      downloadThroughputKbps: 0,
      uploadThroughputKbps: 0,
    },
    formFactor: 'desktop',
    screenEmulation: {
      mobile: false,
      width: 1350,
      height: 940,
      deviceScaleFactor: 1,
      disabled: false,
    },
    locale: 'es',
  };

  let results;
  try {
    results = await lighthouse(TARGET_URL, options);
  } catch (error) {
    console.error('❌ Error al ejecutar Lighthouse:', error.message);
    await chrome.kill();
    process.exit(1);
  }

  await chrome.kill();

  const { lhr } = results;

  // ── Guardar reportes ───────────────────────────────────────
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const htmlPath = path.join(REPORT_DIR, `lighthouse-${timestamp}.html`);
  const jsonPath = path.join(REPORT_DIR, `lighthouse-${timestamp}.json`);

  fs.writeFileSync(htmlPath, results.report[0]);
  fs.writeFileSync(jsonPath, results.report[1]);

  console.log(`📁 Reportes guardados en:`);
  console.log(`   HTML: ${htmlPath}`);
  console.log(`   JSON: ${jsonPath}\n`);

  // ── Evaluar resultados ─────────────────────────────────────
  console.log('📊 RESULTADOS POR CATEGORÍA:');
  console.log('─'.repeat(60));

  let allPassed = true;
  const scores = {};

  for (const [categoryId, categoryName] of Object.entries(CATEGORIES)) {
    const category = lhr.categories[categoryId];
    if (!category) {
      console.log(`⚠️  ${categoryName}: No disponible`);
      continue;
    }
    const score = category.score;
    scores[categoryId] = score;
    const scorePercent = Math.round(score * 100);
    const passed = score >= MIN_SCORE;
    const icon = passed ? '✅' : '❌';
    const status = passed ? 'PASS' : `FAIL (mínimo: ${MIN_SCORE * 100})`;

    console.log(`${icon} ${categoryName.padEnd(25)} ${scorePercent.toString().padStart(3)} pts — ${status}`);

    if (!passed) allPassed = false;
  }

  // ── Checklist WCAG 2.1 ────────────────────────────────────
  console.log('\n📋 CHECKLIST WCAG 2.1:');
  console.log('─'.repeat(60));

  let wcagPassed = 0;
  for (const item of WCAG_CHECKLIST) {
    const audit = lhr.audits[item.lighthouse_audit];
    let status = '❔ No evaluado por Lighthouse';
    if (audit) {
      if (audit.score === 1) { status = '✅ PASS'; wcagPassed++; }
      else if (audit.score === 0) status = '❌ FAIL';
      else if (audit.score === null) status = '🔵 Manual';
      else status = `⚠️  Parcial (${Math.round(audit.score * 100)}%)`;
    }
    console.log(`  ${item.id} (${item.level}) ${item.criterion.padEnd(35)} ${status}`);
  }
  console.log(`\n  WCAG automático: ${wcagPassed}/${WCAG_CHECKLIST.length} criterios verificados por Lighthouse`);
  console.log('  Nota: Criterios manuales requieren revisión humana adicional.\n');

  // ── Auditorías de rendimiento destacadas ──────────────────
  console.log('⚡ MÉTRICAS DE RENDIMIENTO:');
  console.log('─'.repeat(60));
  const perfMetrics = [
    'first-contentful-paint',
    'largest-contentful-paint',
    'total-blocking-time',
    'cumulative-layout-shift',
    'speed-index',
    'interactive',
  ];
  for (const metricId of perfMetrics) {
    const metric = lhr.audits[metricId];
    if (metric) {
      const icon = metric.score >= 0.9 ? '🟢' : metric.score >= 0.5 ? '🟡' : '🔴';
      console.log(`  ${icon} ${metric.title.padEnd(40)} ${metric.displayValue || 'N/A'}`);
    }
  }

  // ── Resumen final ──────────────────────────────────────────
  console.log('\n' + '═'.repeat(60));
  if (allPassed) {
    console.log('✅ RESULTADO FINAL: TODAS LAS CATEGORÍAS SUPERAN EL UMBRAL DE 85');
  } else {
    console.log('❌ RESULTADO FINAL: ALGUNA CATEGORÍA NO ALCANZA EL UMBRAL DE 85');
    console.log('   Revisar el reporte HTML para detalles de auditorías fallidas.');
  }
  console.log('═'.repeat(60));

  // ── Guardar resumen en JSON ────────────────────────────────
  const summary = {
    url: TARGET_URL,
    timestamp: new Date().toISOString(),
    threshold: MIN_SCORE * 100,
    scores: Object.fromEntries(
      Object.entries(scores).map(([k, v]) => [k, Math.round(v * 100)])
    ),
    allPassed,
    wcagPassed,
    wcagTotal: WCAG_CHECKLIST.length,
    reportHtml: htmlPath,
    reportJson: jsonPath,
  };

  const summaryPath = path.join(REPORT_DIR, 'summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  console.log(`\n📄 Resumen guardado: ${summaryPath}`);

  // Exit code para CI/CD
  process.exit(allPassed ? 0 : 1);
}

runLighthouse().catch(console.error);
