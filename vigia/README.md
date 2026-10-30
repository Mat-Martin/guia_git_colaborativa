# Vigía de RepoRAD (prototipo, fase 1)

Revisa si las normas de RepoRAD cambiaron en LeyChile después de la última versión registrada, y escribe un informe para que una persona lo revise. **No modifica RepoRAD**: solo lee sus archivos de `normas/`.

## Qué informa

Para cada norma vigilada compara la última versión registrada en RepoRAD (el `desde` más reciente de `versiones`) con la ficha de LeyChile:

| Estado | Significa |
| --- | --- |
| Derogada según LeyChile | LeyChile la marca como derogada |
| Nueva versión en LeyChile | LeyChile tiene una versión posterior a la de RepoRAD: hay que revisar la modificación |
| Revisar a mano | El número no coincide (el `idNorma` puede estar mal), la ficha no trae fecha o RepoRAD tiene una versión posterior a la de LeyChile |
| No se pudo consultar | Error de red, respuesta inesperada o la norma no está en RepoRAD |
| Falta el idNorma | Falta completar la lista de normas vigiladas |
| No está en LeyChile | Marcada con `"leychile": false` (por ejemplo, decretos exentos no publicados ahí) |
| Sin cambios | Misma versión en ambos |

## Uso

Requiere Node.js 22 o posterior y conexión a `www.leychile.cl`. No usa paquetes externos.

1. Completar `normas_vigiladas.json`: para cada norma, el `idNorma` que aparece en su dirección de LeyChile (`…/navegar?idNorma=NNNN`). El `id` es el nombre del archivo en `normas/` de RepoRAD, sin `.js`.
2. Ejecutar, indicando dónde está RepoRAD:

   ```
   node vigia/vigia.js --reporad ../RepoRAD_v199 --guardar-xml vigia/xml
   ```

3. Leer el informe en `vigia/informes/VIGIA_<fecha>.md`.

Opciones:

- `--lista <json>`: otra lista de normas vigiladas.
- `--salida <carpeta>`: dónde escribir el informe.
- `--guardar-xml <carpeta>`: guarda cada respuesta de LeyChile. Se recomienda en las primeras ejecuciones, para comprobar el formato.
- `--fixtures <carpeta>`: lee las fichas de archivos `<idNorma>.xml` en vez de consultar LeyChile.

El vigía hace una consulta por segundo, para no cargar el servicio.

## Pruebas

```
node --test vigia/pruebas/*.test.js
```

Usan fichas de ejemplo en `pruebas/fixtures/`, sin conexión. **Esas fichas imitan la forma de la respuesta de LeyChile, pero no son respuestas reales.** El prototipo aún no se ha probado contra LeyChile: el entorno donde se escribió no tenía acceso a ese sitio. En la primera ejecución real, con `--guardar-xml`, hay que confirmar que la ficha trae `fechaVersion` y `derogado` en la etiqueta `Norma` y el número en `Numero`. Si no, se ajusta `leychile.js` y una respuesta real reemplaza a los fixtures de ejemplo.

## Archivos

| Archivo | Qué hace |
| --- | --- |
| `vigia.js` | Orquesta la revisión, compara y escribe el informe |
| `leychile.js` | Adaptador de LeyChile: consulta la ficha XML y la analiza |
| `reporad.js` | Lee una norma de RepoRAD fuera del navegador |
| `normas_vigiladas.json` | Normas que se vigilan y su `idNorma` |
| `pruebas/` | Pruebas y fichas de ejemplo |
| `informes/` | Informes generados (no se suben al repositorio) |

## Próximos pasos

1. Completar los `idNorma` y hacer la primera ejecución real.
2. Ampliar la lista a todas las normas del corpus que estén en LeyChile.
3. Agregar otras fuentes con su propio adaptador: dictámenes de Contraloría que citen normas del corpus, Diario Oficial, MINSAL.
4. Ejecutarlo cada semana (cron o GitHub Actions) y avisar por correo cuando haya algo que revisar.
