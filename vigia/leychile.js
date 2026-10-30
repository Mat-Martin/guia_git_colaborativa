/* Adaptador de LeyChile (BCN): pide la ficha XML de una norma y extrae lo necesario para vigilarla.
   Servicio: https://www.leychile.cl/Consulta/obtxml?opt=7&idNorma=<id> (norma completa, última versión).
   El análisis no depende del espacio de nombres ni del orden de los atributos: busca los datos por nombre. */

const URL_BASE = "https://www.leychile.cl/Consulta/obtxml";

function urlNorma(idNorma) {
  return `${URL_BASE}?opt=7&idNorma=${encodeURIComponent(idNorma)}`;
}

function urlNavegar(idNorma) {
  return `https://www.bcn.cl/leychile/navegar?idNorma=${encodeURIComponent(idNorma)}`;
}

/* Atributo de la primera etiqueta con ese nombre (con o sin prefijo de espacio de nombres). */
function atributo(xml, etiqueta, nombre) {
  const abre = new RegExp(`<(?:\\w+:)?${etiqueta}\\b([^>]*)>`, "i").exec(xml);
  if (!abre) return null;
  const valor = new RegExp(`\\b${nombre}\\s*=\\s*"([^"]*)"`, "i").exec(abre[1]);
  return valor ? valor[1].trim() : null;
}

/* Texto de la primera etiqueta con ese nombre. */
function texto(xml, etiqueta) {
  const m = new RegExp(`<(?:\\w+:)?${etiqueta}\\b[^>]*>([\\s\\S]*?)</(?:\\w+:)?${etiqueta}>`, "i").exec(xml);
  if (!m) return null;
  return m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() || null;
}

/* Convierte la ficha XML en un objeto. Devuelve null si no parece una ficha de norma. */
function analizar(xml) {
  if (!/<(?:\w+:)?Norma\b/i.test(xml)) return null;
  const derogado = atributo(xml, "Norma", "derogado");
  return {
    idNorma: atributo(xml, "Norma", "normaId"),
    fechaVersion: atributo(xml, "Norma", "fechaVersion"),
    derogado: derogado === null ? null : !/^no\b/i.test(derogado),
    derogadoTexto: derogado,
    fechaPublicacion: atributo(xml, "Identificador", "fechaPublicacion"),
    fechaPromulgacion: atributo(xml, "Identificador", "fechaPromulgacion"),
    tipo: texto(xml, "Tipo"),
    numero: texto(xml, "Numero"),
    titulo: texto(xml, "TituloNorma")
  };
}

async function consultar(idNorma, { fetchFn = fetch, tiempoMaximo = 30000 } = {}) {
  const respuesta = await fetchFn(urlNorma(idNorma), {
    signal: AbortSignal.timeout(tiempoMaximo),
    headers: { "User-Agent": "RepoRAD-vigia/0.1 (vigilancia de normativa; consulta semanal)" }
  });
  if (!respuesta.ok) throw new Error(`LeyChile respondió ${respuesta.status}`);
  const xml = await respuesta.text();
  const ficha = analizar(xml);
  if (!ficha) throw new Error("la respuesta no es una ficha de norma");
  return { ficha, xml };
}

module.exports = { urlNorma, urlNavegar, analizar, consultar };
