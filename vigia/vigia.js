#!/usr/bin/env node
/* Vigía de RepoRAD, prototipo (fase 1): compara las normas vigiladas con su última versión en LeyChile
   y escribe un informe para que una persona lo revise. No modifica RepoRAD.

   Uso:
     node vigia/vigia.js --reporad <carpeta de RepoRAD> [--lista <json>] [--salida <carpeta>]
                         [--fixtures <carpeta con <idNorma>.xml>] [--guardar-xml <carpeta>] [--fecha AAAA-MM-DD]

   --fixtures   lee las fichas de archivos en vez de consultar LeyChile (pruebas, o trabajo sin conexión).
   --guardar-xml guarda cada respuesta de LeyChile, para revisarla o convertirla en fixture. */

const fs = require("fs");
const path = require("path");
const leychile = require("./leychile");
const reporad = require("./reporad");

const ESTADOS = {
  cambio: "Nueva versión en LeyChile",
  derogada: "Derogada según LeyChile",
  sin_cambios: "Sin cambios",
  revisar: "Revisar a mano",
  sin_id: "Falta el idNorma",
  fuera: "No está en LeyChile",
  error: "No se pudo consultar"
};
const ORDEN = ["derogada", "cambio", "revisar", "error", "sin_id", "fuera", "sin_cambios"];

const soloDigitos = (s) => String(s || "").replace(/\D/g, "");

/* Compara una norma de RepoRAD con su ficha de LeyChile. Devuelve { estado, detalle[] }. */
function comparar(local, ficha) {
  const detalle = [];
  if (ficha.numero && soloDigitos(ficha.numero) !== soloDigitos(local.numero)) {
    return {
      estado: "revisar",
      detalle: [`El número en LeyChile (${ficha.numero}) no coincide con el de RepoRAD (${local.numero}): el idNorma puede estar mal.`]
    };
  }
  if (ficha.derogado) {
    detalle.push(`LeyChile la marca como «${ficha.derogadoTexto}».`);
    return { estado: "derogada", detalle };
  }
  if (!ficha.fechaVersion) {
    return { estado: "revisar", detalle: ["La ficha no trae fecha de versión."] };
  }
  if (ficha.fechaVersion > local.ultimaVersion) {
    detalle.push(`Última versión en LeyChile: ${ficha.fechaVersion}. En RepoRAD: ${local.ultimaVersion}.`);
    return { estado: "cambio", detalle };
  }
  if (ficha.fechaVersion < local.ultimaVersion) {
    detalle.push(`RepoRAD registra una versión (${local.ultimaVersion}) posterior a la de LeyChile (${ficha.fechaVersion}).`);
    return { estado: "revisar", detalle };
  }
  return { estado: "sin_cambios", detalle: [`Versión ${ficha.fechaVersion} en ambos.`] };
}

async function obtenerFicha(idNorma, opciones) {
  if (opciones.fixtures) {
    const xml = fs.readFileSync(path.join(opciones.fixtures, `${idNorma}.xml`), "utf8");
    const ficha = leychile.analizar(xml);
    if (!ficha) throw new Error("el fixture no es una ficha de norma");
    return ficha;
  }
  const { ficha, xml } = await leychile.consultar(idNorma);
  if (opciones.guardarXml) {
    fs.mkdirSync(opciones.guardarXml, { recursive: true });
    fs.writeFileSync(path.join(opciones.guardarXml, `${idNorma}.xml`), xml);
  }
  return ficha;
}

async function revisar(lista, opciones) {
  const resultados = [];
  for (const entrada of lista.normas) {
    const r = { id: entrada.id, idNorma: entrada.idNorma ?? null, nota: entrada.nota || null };
    try {
      r.local = reporad.resumen(reporad.leerNorma(opciones.reporad, entrada.id));
    } catch (e) {
      Object.assign(r, { estado: "error", detalle: [`RepoRAD: ${e.message}`] });
      resultados.push(r);
      continue;
    }
    if (entrada.leychile === false) {
      Object.assign(r, { estado: "fuera", detalle: [] });
    } else if (!entrada.idNorma) {
      Object.assign(r, { estado: "sin_id", detalle: ["Completar «idNorma» en la lista de normas vigiladas."] });
    } else {
      try {
        r.ficha = await obtenerFicha(entrada.idNorma, opciones);
        Object.assign(r, comparar(r.local, r.ficha));
      } catch (e) {
        Object.assign(r, { estado: "error", detalle: [e.message] });
      }
      if (!opciones.fixtures) await new Promise((ok) => setTimeout(ok, 1000)); // una consulta por segundo
    }
    resultados.push(r);
  }
  return resultados;
}

function informe(resultados, fecha) {
  const cuenta = {};
  for (const r of resultados) cuenta[r.estado] = (cuenta[r.estado] || 0) + 1;
  const lineas = [
    `# Informe del vigía — ${fecha}`,
    "",
    "Comparación de las normas vigiladas de RepoRAD con su última versión en LeyChile. " +
      "Es un aviso para revisar, no una conclusión: ningún dato de RepoRAD cambia sin revisión de una persona.",
    "",
    "| Estado | Normas |",
    "| --- | --- |",
    ...ORDEN.filter((e) => cuenta[e]).map((e) => `| ${ESTADOS[e]} | ${cuenta[e]} |`),
    ""
  ];
  for (const estado of ORDEN) {
    const grupo = resultados.filter((r) => r.estado === estado);
    if (!grupo.length) continue;
    lineas.push(`## ${ESTADOS[estado]}`, "");
    for (const r of grupo) {
      const cita = r.local ? r.local.cita : r.id;
      lineas.push(`- **${cita}** (\`${r.id}\`)`);
      for (const d of r.detalle) lineas.push(`  - ${d}`);
      if (r.nota) lineas.push(`  - Nota: ${r.nota}`);
      if (r.idNorma) lineas.push(`  - Fuente: ${leychile.urlNavegar(r.idNorma)}`);
    }
    lineas.push("");
  }
  return lineas.join("\n");
}

function leerArgumentos(argv) {
  const opciones = {
    lista: path.join(__dirname, "normas_vigiladas.json"),
    salida: path.join(__dirname, "informes"),
    fecha: new Date().toISOString().slice(0, 10)
  };
  const nombres = { "--reporad": "reporad", "--lista": "lista", "--salida": "salida", "--fixtures": "fixtures", "--guardar-xml": "guardarXml", "--fecha": "fecha" };
  for (let i = 0; i < argv.length; i += 2) {
    const clave = nombres[argv[i]];
    if (!clave || argv[i + 1] === undefined) throw new Error(`argumento no reconocido: ${argv[i]}`);
    opciones[clave] = argv[i + 1];
  }
  if (!opciones.reporad) throw new Error("falta --reporad <carpeta de RepoRAD>");
  return opciones;
}

async function principal() {
  const opciones = leerArgumentos(process.argv.slice(2));
  const lista = JSON.parse(fs.readFileSync(opciones.lista, "utf8"));
  const resultados = await revisar(lista, opciones);
  const texto = informe(resultados, opciones.fecha);
  fs.mkdirSync(opciones.salida, { recursive: true });
  const archivo = path.join(opciones.salida, `VIGIA_${opciones.fecha}.md`);
  fs.writeFileSync(archivo, texto + "\n");
  for (const r of resultados) console.log(`${ESTADOS[r.estado].padEnd(26)} ${r.local ? r.local.cita : r.id}`);
  console.log(`\nInforme: ${archivo}`);
}

if (require.main === module) {
  principal().catch((e) => {
    console.error(`Error: ${e.message}`);
    process.exit(1);
  });
}

module.exports = { comparar, revisar, informe };
