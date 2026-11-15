# AGENTS.md — Bundespuebla (propuesta conservadora)

> Instalación: integrar con tu AGENTS.md existente en lugar de sobrescribirlo. Estos archivos son una propuesta, NO están aplicados al repositorio.

## Regla principal

No cambiar el diseño vigente de Bundespuebla sin solicitud explícita. Asegurar funcionalidad, identidad de cada liga, navegación y experiencia móvil. No reinstaurar Anti_UI_Slop ni Skeuomorfismo 2.0.

## Flujo de trabajo

1. Leer primero `PRODUCT.md` y `DESIGN.md`, contrastar con el código de producción vigente.
2. Para tareas de web: consultar Modern Web Guidance (`search`, `retrieve`) y compatibilidad de navegador.
3. Para revisión visual/técnica: utilizar Impeccable `critique`, `audit` y `detect` (no `live` ni auto-Apply).
4. Para componentes: consultar Astryx **solo si el stack es compatible**; React 19+ requerido para sus componentes. Si se usa HTML/CSS/JS sin React, mantener el stack salvo instrucción del usuario.
5. Trabajar en una rama separada, sin merges ni despliegues automáticos. No borrar características para corregir otras.
6. Mostrar pruebas o señalar claramente si no se pudieron ejecutar.

## Regresiones prohibidas

- Cambiar colores/logos/tipografías existentes sin aprobación.
- Quitar la línea verde de clasificados o el podio de goleadores.
- Romper botón de inicio, selección de ligas, jornadas, filtros de partidos o scroll horizontal.
- Reinstalar favoritos o aplicar diseño genérico.
- Incluir comandos con bypass de sandbox o permisos.

## Fuentes

- https://github.com/meta/astryx
- https://github.com/GoogleChrome/modern-web-guidance
- https://github.com/pbakaus/impeccable
