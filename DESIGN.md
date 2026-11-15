# DESIGN.md — Registro de diseño (bloqueo visual)

**NO es un rediseño.** Este documento indica qué conservar hasta leer los tokens del código vigente. No inventar ni reemplazar valores CSS.

## Identidad

- Estilo vigente: referencia Bundespuebla_Neumorfismo, salvo modificación posterior explícita del usuario.
- Colores por liga: negro / rosa / rojo-vino / azul. Extraer tonos exactos del CSS actual.
- Mantener tamaños de logos, fuentes, jerarquías, bordes, sombras, radios y animaciones de la versión actual.
- Podio de goleadores top 3: oro/plata/bronce sutiles y nítidos.
- Línea verde de clasificación: Polos y Femenil top 8; Bundes y Betos top 4 por grupo, comprobar configuración actual.

## Prohibiciones

- No basarse en Anti_UI_Slop ni Skeuomorfismo 2.0.
- No aplicar automáticamente temas visuales de terceros, ni reemplazar componentes sólo porque una herramienta los considera genéricos.
- No cambiar la página de inicio por una landing distinta.

## Antes de cualquier cambio

1. Confirmar la versión desplegada y el código de trabajo.
2. Fotografiar o capturar las vistas actuales en 360, 390, 768 y 1280 px (si se dispone de navegador).
3. Guardar los tokens exactos existentes y comparar las capturas antes/después.
4. Revisar que todos los controles funcionen.
## Colors

Registro descriptivo del CSS local; no sustituye la cascada ni autoriza cambios de apariencia. En assets/theme-neumorphism.css, el tema claro define --neo-base: #e9edf4, --ink: #151c2a y --muted: #606e80; el oscuro define #1a2230, #f1f5fb y #a7b7c9, respectivamente.

En assets/league-banners.css, los tokens --hero-base / --hero-mid / --hero-finish son:

- Polos: #111318 / #252930 / #343942.
- Bundesladies: #99094c / #b40c61 / #c61772.
- Bundespuebla: #a0000b / #bf0c19 / #d01828.
- Betos: #064786 / #075ba9 / #086cb7.

## Typography

assets/styles.css establece 'DM Sans', sans-serif para el cuerpo (14px), y 'Barlow Condensed', sans-serif para .display. Conservar las variantes y ajustes específicos de cada selector. index.html carga ambas familias desde Google Fonts.

## Components

Conservar el selector de competiciones, cabecera y navegación, banners por liga, indicadores, filtros, pestañas, jornadas, tabla horizontal, podio de goleadores y diálogos de búsqueda y perfil existentes en index.html.

El orden de hojas cargadas es styles.css, theme-neumorphism.css, components-stable.css, finish-details.css y league-banners.css, dentro de assets. Las reglas posteriores y las específicas de tema, componente o ancho de pantalla pueden modificar los valores base. Verificar estilos calculados antes de cualquier cambio visual; este registro no equivale a una comprobación visual en navegador.

