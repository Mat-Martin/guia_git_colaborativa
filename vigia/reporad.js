/* Lee una norma de RepoRAD fuera del navegador: ejecuta su archivo de normas/ con un RepoRAD.registrar mínimo.
   Solo lee; nunca escribe en RepoRAD. */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

/* Busca <id>.js en normas/ y sus subcarpetas. */
function buscarArchivo(dirNormas, id) {
  for (const entrada of fs.readdirSync(dirNormas, { withFileTypes: true })) {
    const ruta = path.join(dirNormas, entrada.name);
    if (entrada.isDirectory()) {
      const hallado = buscarArchivo(ruta, id);
      if (hallado) return hallado;
    } else if (entrada.name === `${id}.js`) {
      return ruta;
    }
  }
  return null;
}

function leerNorma(dirRepoRAD, id) {
  const archivo = buscarArchivo(path.join(dirRepoRAD, "normas"), id);
  if (!archivo) throw new Error(`no está ${id}.js en ${path.join(dirRepoRAD, "normas")}`);
  let registrada = null;
  const RepoRAD = { registrar: (norma) => { registrada = norma; } };
  vm.runInNewContext(fs.readFileSync(archivo, "utf8"), { RepoRAD }, { filename: archivo });
  if (!registrada) throw new Error(`${archivo} no registró ninguna norma`);
  return registrada;
}

/* Lo que el vigía compara: cita, número y la última versión registrada. */
function resumen(norma) {
  const versiones = (norma.versiones || []).map((v) => v.desde).filter(Boolean).sort();
  return {
    id: norma.id,
    cita: norma.cita,
    numero: norma.numero,
    fecha: norma.fecha,
    ultimaVersion: versiones.length ? versiones[versiones.length - 1] : norma.fecha
  };
}

module.exports = { leerNorma, resumen };
