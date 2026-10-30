/* Pruebas del vigía con fichas de ejemplo (sin conexión). Ejecutar: node --test vigia/pruebas/*.test.js */

const test = require("node:test");
const assert = require("node:assert");
const path = require("path");
const leychile = require("../leychile");
const { revisar, informe } = require("../vigia");

const FIX = path.join(__dirname, "fixtures");
const lista = require(path.join(FIX, "lista.json"));
const opciones = { reporad: path.join(FIX, "reporad"), fixtures: path.join(FIX, "leychile") };

test("analiza la ficha de LeyChile", () => {
  const xml = require("fs").readFileSync(path.join(FIX, "leychile", "102.xml"), "utf8");
  assert.deepStrictEqual(leychile.analizar(xml), {
    idNorma: "102",
    fechaVersion: "2026-11-15",
    derogado: false,
    derogadoTexto: "no derogado",
    fechaPublicacion: "2000-01-02",
    fechaPromulgacion: "2000-01-01",
    tipo: "Ley",
    numero: "2000",
    titulo: "Norma de ejemplo 2000"
  });
});

test("rechaza lo que no es una ficha de norma", () => {
  assert.strictEqual(leychile.analizar("<html><body>Error</body></html>"), null);
});

test("clasifica cada caso", async () => {
  const resultados = await revisar(lista, opciones);
  const estado = Object.fromEntries(resultados.map((r) => [r.id, r.estado]));
  assert.deepStrictEqual(estado, {
    "ley-1000": "sin_cambios",   // última versión de RepoRAD = LeyChile
    "ley-2000": "cambio",        // LeyChile tiene una versión posterior
    "ley-3000": "derogada",
    "ley-4000": "revisar",       // el número no coincide: idNorma probablemente mal
    "dto-ex-5-2005": "fuera",
    "ley-6000": "sin_id",
    "ley-7000": "error"          // no está en RepoRAD
  });
});

test("el informe pone primero lo que hay que revisar", async () => {
  const texto = informe(await revisar(lista, opciones), "2026-10-30");
  assert.match(texto, /^# Informe del vigía — 2026-10-30/);
  const pos = (t) => texto.indexOf(`## ${t}`);
  assert.ok(pos("Derogada según LeyChile") < pos("Nueva versión en LeyChile"));
  assert.ok(pos("Nueva versión en LeyChile") < pos("Sin cambios"));
  assert.match(texto, /Última versión en LeyChile: 2026-11-15\. En RepoRAD: 2002-02-02\./);
  assert.match(texto, /navegar\?idNorma=102/);
});

test("un error de red no detiene la revisión", async () => {
  const caida = async () => { throw new Error("sin conexión"); };
  await assert.rejects(leychile.consultar(1, { fetchFn: caida }), /sin conexión con LeyChile/);
  const noOk = async () => ({ ok: false, status: 503 });
  await assert.rejects(leychile.consultar(1, { fetchFn: noOk }), /503/);
});
