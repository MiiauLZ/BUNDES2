# Registro de cambios y revision del diseno

## Cambios implementados

| Archivo | Antes | Ahora |
|---|---|---|
| assets/app.js | Fallos del buscador quedaban almacenados sin reintento | Reintento al reabrir, caducidad del indice y aviso de carga parcial |
| assets/app.js | Buscar descargaba tablas, resultados y goleadores de cuatro ligas | Solo descarga tablas: cuatro solicitudes sin cache en lugar de hasta doce |
| assets/app.js | Cada evento al escribir renderizaba tres paneles | Se agrupa el render en un frame |
| assets/app.js | Perfiles sin tabla contaban solo los tres resultados mostrados | Cuenta todos los partidos finalizados y mantiene tres resultados visibles |
| assets/app.js | Se podian superponer modales y perder el foco | Un modal activo, fondo inert, ciclo de Tab y restauracion del foco |
| assets/app.js | Actualizar restablecia estado y orden | Mantiene grupo, jornada, consulta, filtro y orden |
| assets/app.js | Goleadores seguia mostrando carga tras un error general | Estado de error y finalizacion de aria-busy |
| assets/app.js | Abortos previos no se propagaban al iniciar fetch | Se comprueba el estado inicial de la senal |
| assets/app.js | Algunos desplazamientos ignoraban movimiento reducido | Esas rutas respetan la preferencia |
| assets/app.js | Orden de tabla sin aria-sort | Encabezado seleccionado con aria-sort y nombre completo en espanol |
| index.html | Tabla sin region enfoc able ni scope de columnas | Region nombrada, tabindex y scope=col; nota del buscador anunciada como estado |
| tests/ | Sin suite local de regresion | 15 pruebas de datos, errores, cache, foco y respuestas tardias |

No se modificaron CSS, logos, tipografias ni paletas. No se migraron frameworks ni se desplego el sitio.

## Configuracion realizada

Se habilito el hook de Impeccable y se completaron PRODUCT.md y DESIGN.md con informacion del codigo conservando las restricciones. El diagnostico doctor termino sin pendientes en esa comprobacion. Esto no equivale a que la interfaz no tenga problemas.

## Mi valoracion del diseno

No hay evidencia suficiente para justificar un rediseno. Si conviene una revision puntual de legibilidad y accesibilidad.

El detector estatico reporto:

- Texto #606e80 sobre #e9edf4: aproximadamente 4.4:1.
- Texto #db2777 sobre #f5eaf1: aproximadamente 3.9:1.
- Texto #0284c7 sobre #e4eef7: aproximadamente 3.5:1.
- Texto blanco sobre #0284c7 en hover: aproximadamente 4.1:1.
- Etiquetas de 8 a 10 px.

Son candidatos a verificar con estilos calculados y capturas: la cascada, el tema y el estado pueden alterar la combinacion real. No todos los textos pequenos incumplen automaticamente una norma por su tamano. Si se confirma baja legibilidad, el ajuste minimo seria oscurecer los textos afectados o elevar el tamano de esas etiquetas sin cambiar la identidad de las ligas. No se aplicaron esos cambios visuales.

Las advertencias esteticas del detector sobre sombras, tarjetas o bordes no justifican eliminar el neumorfismo, los banners o la linea verde aprobados.

## Evidencia y limites

- 15 pruebas aprobadas con node --test tests/regression.cjs.
- Sintaxis de assets/app.js validada con node --check.
- Datos y DOM simulados: sin mediciones reales de velocidad, Lighthouse, lectores de pantalla ni gestos tactiles.
- Pendientes: 360, 390, 768 y 1280 px; ambos temas; logos remotos; datos oficiales; teclado virtual; comparacion visual.
- El acceso del navegador al archivo local fue bloqueado. No se realizaron capturas.
- No existia repositorio Git al comenzar: el primer commit registra el estado resultante, no un historial previo reconstruido.
