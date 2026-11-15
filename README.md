# Bundespuebla UPIICSA

Portal de cuatro competiciones universitarias, construido con HTML, CSS y JavaScript sin framework. Incluye resultados, jornadas, clasificaciones, goleadores, busqueda y perfiles de equipos.

## Estructura

- index.html: estructura y controles accesibles.
- assets/: estilos, scripts, configuracion de fuentes de datos y marca.
- tests/regression.cjs: 15 pruebas con Node y DOM simulado.
- CAMBIOS.md: cambios implementados, valoracion del diseno y limitaciones.
- PRODUCT.md y DESIGN.md: contexto y restricciones visuales.
- .agents/skills/: guias locales de Modern Web Guidance e Impeccable.
- .codex/hooks.json: integracion del detector de Impeccable.

## Pruebas

```powershell
node --test tests/regression.cjs
node --check assets/app.js
```

Las pruebas no necesitan npm. El navegador necesita red para las hojas publicadas, fuentes y logos remotos.

## Integraciones

Modern Web Guidance se puede consultar mediante sus archivos locales; su CLI requiere acceso a npm. Impeccable tiene configurado el hook del proyecto, sujeto a la aprobacion y carga de hooks del entorno. No se versionan ejecutables, cache ni consentimiento local. Astryx se consultara solo cuando sea pertinente; sus componentes React no estan instalados en este sitio HTML/CSS/JS.

## Estado

15 pruebas aprobadas. Sitio publicado en https://miiaulz.github.io/BUNDES2/. La revision visual en navegador y dispositivos sigue pendiente; no confundir las pruebas simuladas con una certificacion de accesibilidad o rendimiento.

## GitHub Pages

El sitio se publica desde la rama main y la carpeta raiz. index.html es la entrada; assets contiene los estilos y scripts. Los archivos fuente estan descomprimidos y se pueden revisar directamente en GitHub.
