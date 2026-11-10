# Tablero de Vida — Contexto del proyecto

App web multiusuario para organizar la vida universitaria: pendientes, checklist diario, calendario, archivos y promedios por curso. Es una **demo** personal, pero debe funcionar para varios usuarios.

Habla conmigo **en español** y explícame brevemente lo que haces: estoy aprendiendo.

---

## Stack

- **Frontend:** React + Vite (JavaScript), React Router, Tailwind CSS
- **Backend:** Supabase (Auth, Postgres, Storage, Edge Functions, pg_cron)
- **PWA:** `vite-plugin-pwa` (instalable; notificaciones push más adelante)
- **Hosting:** Vercel — https://promediate.vercel.app
- **Zona horaria de la app:** `America/Lima`. Todas las fechas se muestran y calculan en esa zona, nunca en la del servidor (`src/lib/fechas.js`).

## Reglas obligatorias

1. **Nunca** escribas claves en el código. Todo va en `.env.local` (en `.gitignore`; la plantilla es `.env.example`). En el frontend solo se usan `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`. La *service role key* y las claves de Google/IA solo existen en Edge Functions como secrets.
2. **Toda tabla nueva lleva RLS activado** con políticas para que cada usuario solo lea y escriba sus propias filas (`user_id = auth.uid()`).
3. Los cambios de base de datos se guardan como migraciones SQL en `supabase/migrations/`.
4. Trabaja en cambios pequeños: una funcionalidad a la vez. Antes de algo grande, muéstrame un plan.
5. Al terminar una funcionalidad: verifica que `npm run build` funcione y propón un commit con mensaje descriptivo en español.
6. Diseño responsive pensado primero para celular. Soporta modo oscuro.
7. No agregues librerías sin explicarme para qué sirven.

## Estructura

```
src/
  components/     # piezas reutilizables; calendario/ e inicio/ tienen las suyas
  pages/          # Inicio, Hoy, Calendario, Promedios, CursoEvaluaciones, Tareas (Pendientes),
                  # NuevaTarea (Nuevo pendiente), EditarTarea, Archivos, ArchivosCurso, Conexiones, Login, Registro
  lib/            # supabaseClient, fechas, tipos, priority, checklist, calendario, inicio, arbol, grades, seguimiento (eventos de Google como pendientes: entran, ocultos, marcados, colores propios), choques (choques de horario), googleSync (pendientes como eventos de Google: cuándo crear, actualizar o borrar), archivos (reglas y textos de Drive), APIs (googleApi: conexión con Google y sincronización; seguimientoApi; archivosApi: Drive)
  hooks/          # useAuth, useTasks, useCursosConNotas, useEvaluaciones, useGoogleEventos, useSeguimientoGoogle, usePendientesGoogle, useComprobarChoques, useConexionGoogle, useSubidas (cola de subidas a Drive y useEstadoDrive), ...
supabase/
  migrations/
  diagnostico_pesos.sql          # solo lee; revisa los pesos antes de migrar
  verificar_es_nodo_propio.sql   # solo lee; compara la base real con la migración de RLS
  verificar_google_rls.sql       # solo lee; comprueba RLS activo y cero políticas en las tablas de Google
  config.toml             # mínimo: solo deja google-callback sin verificación de JWT
  functions/              # Edge Functions (Deno): google-connect, google-callback, google-disconnect, google-calendar-events, google-calendar-sync,
                          # google-drive-upload-init, google-drive-register, google-drive-delete
    _shared/              # cors (+ origenDeLaApp), supabaseAdmin, cifrado (AES-GCM), google (tokens y constantes: URL_EVENTOS, SCOPE_CALENDAR, SCOPE_DRIVE, ORIGEN_APP),
                          # drive (validación de archivos, prepararDrive, carpetas)
```

---

## Funcionalidades

### 1. Login y registro
Supabase Auth con correo y contraseña. Sin sesión, todo redirige a Login (`ProtectedRoute`). Al registrarse, un trigger (`handle_new_user`) crea el perfil. Más adelante: "Iniciar sesión con Google".

### 2. Pendientes
- **Nombres en pantalla** (en la base de datos el valor sigue siendo `tarea` / `actividad`; el mapeo vive en `src/lib/tipos.js`):
  - `tarea` → **Entrega**: algo de la universidad, con fecha y hora límite (`fecha_entrega`).
  - `actividad` → **Actividad**: algo personal, con fecha, hora de inicio y hora de fin (el fin debe ser posterior al inicio). Sin curso.
  - La página del formulario se llama **"Nuevo pendiente"** (`/tareas/nueva`) y la lista, **"Pendientes"**. En la interfaz no se usa la palabra "tarea".
- Campos: título, descripción, prioridad base (`alta`/`media`/`baja`), curso (solo entregas, opcional). Arriba, dos tarjetas para elegir Entrega o Actividad.
- **Prioridad dinámica** (no se guarda, se calcula en `src/lib/priority.js`): `baja` → `media` con ≤ 5 días; `media` → `alta` con ≤ 2 días; si vence hoy, siempre `alta`.
- Estados guardados: `pendiente`, `completada`, `justificada` (motivo obligatorio). `vencida` se calcula (`estaVencida`).
- Fase 3, parte C: al crear un pendiente se puede crear también su evento en Google Calendar (`google_event_id`; ver sección 8b).

### 3. Hoy (checklist diario)
- Muestra las entregas que vencen hoy y las actividades de hoy; se calcula con la fecha de Lima, no hay proceso que lo genere.
- **Completar** (guarda `completed_at`) o **justificar** (motivo obligatorio): ambos pasan a "Hechas" y se pueden **deshacer**.
- Los pendientes de días anteriores sin completar van aparte, en "Vencidas".
- **Una sola lista** ("Para hoy") con entregas, actividades y eventos de Google, y **un solo contador** "X de Y completados" (bajo la fecha) que los cuenta a todos (`resumenDeHoy`). Orden (`unirListaHoy`, `src/lib/checklist.js`): 1) entregas de hoy, por prioridad calculada; 2) lo que no tiene hora (eventos de Google de todo el día incluidos y actividades sin hora); 3) lo que tiene hora (actividades de la app y eventos de Google), cronológico. Cada fila lleva su ícono (bandera = entrega, reloj = actividad, calendario = Google, en `IconosTipo.jsx`); los eventos de Google no llevan etiqueta de prioridad. Lo ya marcado pasa a "Hechas", con el mismo orden.

### 4. Resumen del día
- La primera vez que se abre la app cada día (desde las 00:00 de Lima) se muestra un modal con los pendientes del día por prioridad calculada.
- La última fecha vista se guarda en `profiles.ultimo_resumen` (igual en todos los dispositivos). Al cerrar el modal (botón, Esc o clic afuera) se actualiza con la fecha de hoy en Lima.

### 5. Promedios por curso
Árbol de evaluaciones por curso (`evaluations`): cada nodo tiene nombre y peso, y puede tener hijos o ser una hoja (prueba) con nota. Escala vigesimal (0–20). Se pueden agregar, editar, anidar y borrar nodos.

- **Pesos relativos al padre:** el peso de cada nodo es un % de su padre; los hijos de cada nodo suman 100 (los de primer nivel también). Cada nodo muestra su **aporte real al curso** = peso × el de sus ancestros / 100^nivel (`aportesAlCurso`, `src/lib/arbol.js`). Ej.: Final 30 · Continua 70 → PCs 40 → PC1 50: PC1 = 50% × 40% × 70% = 14% del curso. El formulario lo muestra en vivo.
- **Validación por nivel** (tolerancia 0.01): "Suman 75%: faltan 25% para completar PEP", "Suman 105%: sobran 5% en PEP (deben sumar 100%)".
- **Reparto de un grupo** (`reparto`):
  - `manual`: cada hijo guarda su peso.
  - `iguales`: cada hijo pesa 100 / n; el `peso` guardado se ignora (se calcula, no se guarda), así que se reequilibra solo al agregar o borrar. Botón "+ Subdivisiones iguales" (Laboratorio → Laboratorio 1…6). Al volver a manual, cada hijo guarda 100 / n.
- **Descartar las N peores** (`descartar_peores`, solo en `iguales`): N va de 0 a hijos − 1 y se ajusta si cambia la cantidad de hijos. Cuentan las n − N mejores, cada una con peso 100 / (n − N). Las pruebas sin nota valen 0, así que se descartan primero. Las descartadas se ven tachadas con la etiqueta "descartada".
- **Cálculo** (`src/lib/grades.js`, nada se guarda): la nota de un nodo con hijos es Σ (nota del hijo × peso del hijo / 100), de abajo hacia arriba. Se evalúa el curso suponiendo que cada prueba sin nota saca *x*: x = 0 → nota final; x = 20 → máximo posible; la nota mínima es el menor x que llega a 10.5 (bisección). Así el descarte funciona igual en los tres casos.
- **Qué se muestra:**
  - **Nota final** (número grande): puntos acumulados sobre 20; lo que no tiene nota cuenta como 0.
  - **Máximo posible** y **"Te faltan X puntos para aprobar"** (o **"Aprobado ✓"** si es ≥ 10.5).
  - **Mejor nota:** "Mejor nota: N en <prueba>".
  - **Nota mínima:** "Necesitas sacar al menos X en lo que falta" (solo si todos los niveles cuadran).
  - El promedio de cada rama aparece en su encabezado.
- **Colores de la nota final** (`NotaFinal` + `estadoNota`, iguales en el curso, la lista y el Inicio): **verde** si la nota final ≥ 10.5 (con 2 decimales); **rojo** solo si el máximo posible es < 10.5 y todos los niveles cuadran; **neutro** en otro caso.
- **Árbol en pantalla:** las ramas con subdivisiones aparecen cerradas y se abren al tocar el encabezado; qué ramas están abiertas se recuerda por curso en `localStorage`. Los botones Editar, + Subdivisión, + Subdivisiones iguales y Borrar siempre se ven. Al abrir un grupo aparecen sus controles (Reparto y "Descartar las N peores").
- **Notas en el mismo lugar:** una prueba sin nota muestra "+ Nota" (0–20, Enter guarda, Esc cancela); con nota, un chip para corregirla y una "×" para borrarla.
- **Ejemplo de prueba** (Final 30 · Continua 70 → PCs 40 [PC1 50, PC2 50] · Tareas 30 · Proyecto 30; PC1 = 16, PC2 = 12, Tareas = 14, resto sin nota): promedio de PCs 14; nota final **6.86**; máximo **17.06**; nota mínima **7.14**; mejor nota 16 en PC1; color neutro.
- Historia de los pesos: relativos → absolutos (`20261022000000_pesos_absolutos.sql`) → relativos otra vez (`20261030000000_pesos_relativos.sql`). Esa última no tiene "deshacer": corre antes `supabase/diagnostico_pesos.sql`.
- Fase 4: subir el sílabo en PDF y que la IA proponga el árbol; el usuario lo revisa antes de guardar.

### 6. Calendario
- **`CalendarView`** (`src/components/calendario/`) es un calendario reutilizable con vistas **semanal**, **mensual** y de **un día** (`VistaHoras` para día/semana, `VistaMes` para el mes). Recibe la lista de vistas disponibles; en celular la semana se muestra como un solo día, y deslizar el dedo cambia de día.
- Solo entiende **eventos normalizados** `{ id, titulo, inicio, fin, todoElDia, tipo, color, estado, origen, curso }`. `tareasAEventos` (`src/lib/calendario.js`) convierte las filas de `tasks` en eventos con `origen: 'app'`; las entregas usan el color de su curso, las actividades uno fijo, y `estado` incluye `vencida` (calculado). En la Fase 3 los eventos de Google Calendar se suman con `origen: 'google'` y `tipo: 'evento'` sin tocar el calendario.
- **Creación rápida** (`NuevoPendienteModal` + `PendienteForm`, el mismo formulario de Nuevo/Editar pendiente): tocar un espacio vacío de un día abre el modal con esa fecha; en la cuadrícula horaria rellena inicio (al cuarto de hora más cercano) y fin (+1 h) como Actividad; el encabezado del día crea una Entrega 23:59; en el mes cada casilla tiene un "+"; el botón "+ Nuevo" usa la fecha de hoy. Al guardar, `useTasks.crear` agrega la fila sin recargar. Sin la propiedad `onCrear`, el calendario es solo de lectura.
- Al tocar un evento se abre `PanelEvento` (completar, justificar, editar). Las completadas se ven marcadas.
- **Borrar desde el calendario** (todas las vistas, Calendario e Inicio): los pendientes de la app llevan un botón rojo **Borrar** junto a Editar. Confirma con "¿Borrar "<título>"? También se eliminará de Google Calendar." (la segunda frase solo si tiene `google_event_id`). Usa `useTasks.borrar` → `borrarPendiente`: si está en Google (`estaEnGoogle`), llama a `google-calendar-sync` con `borrar` y después elimina la fila; si Google falla o no está conectado, borra la tarea igual y `CalendarioConGoogle` muestra un aviso ámbar que se puede cerrar ("…su evento pudo quedar en Google Calendar"). Al quitarse de `tareas`, el panel se cierra y el pendiente desaparece del calendario y de las tarjetas del Inicio sin recargar (Hoy y Pendientes lo vuelven a pedir al abrirse). Si no se pudo borrar la fila, el error sale en el panel. Los eventos de Google que no creó la app **no** llevan Borrar (siguen con "Quitar"). `CalendarioConGoogle` solo muestra el botón si recibe `borrar`.
- **Google Calendar (Fase 3, parte B — solo lectura, hecha, pendiente de confirmar):** `CalendarioConGoogle` (`src/components/calendario/`) envuelve a `CalendarView` y lo usan la página Calendario y el calendario del Inicio. Mezcla `tareasAEventos` con `googleAEventos` (`src/lib/calendario.js`): eventos `origen: 'google'`, `tipo: 'evento'`, ícono de calendario (los puntos del mes son cuadraditos) y los campos extra `lugar` y `enlace`.
  - **Colores de Google:** cada evento usa el color que tiene en Google (`colorGoogle(colorId)`, paleta fija de Google: 1 #7986cb, 2 #33b679, 3 #8e24aa, 4 #e67c73, 5 #f6bf26, 6 #f4511e, 7 #039be5, 8 #616161, 9 #3f51b5, 10 #0b8043, 11 #d50000; sin `colorId` → `COLOR_GOOGLE` #039be5, el azul por defecto de Google). En semana/día y en la franja de todo el día, `BloqueEvento` lo dibuja con fondo al 25% y borde izquierdo de 4px (igual que las actividades); en el mes, el cuadradito lleva ese color. En Hoy, Pendientes (`TarjetaGoogle`) y la tarjeta Hoy del Inicio, las filas de Google llevan una franja izquierda de ese color. Las filas guardadas (`google_seguimiento`) no guardan color: toman el del evento si Google aún lo devuelve, si no el azul por defecto. Encima de todo esto manda el color propio que el usuario elige en la app (ver "Colores propios" abajo). Justificada sigue en gris y completada con ✓ y tachado. Los pendientes de la app conservan su color (curso o `COLOR_ACTIVIDAD`).
  - **Colores propios (guardados en la app):** Google no devuelve los colores personalizados (`colorId` llega `null` en la mayoría), así que el usuario elige el color en la app. Tabla `google_colores` (una fila por ocurrencia, `google_event_id`; por serie, `serie_id`, solo filas antiguas: ya no se crean; o por título, `titulo_norm`; `color_id` '1'…'11'). **Prioridad al pintar** (`colorDeEvento`, `src/lib/seguimiento.js`): 1) el de la app por `google_event_id`; 2) el de la app por `serie_id`; 3) el de la app por título normalizado (`titulo_norm`); 4) el `colorId` de Google; 5) el azul por defecto #039be5. **Título normalizado** (`normalizarTitulo`): minúsculas, sin espacios al inicio ni al final y sin tildes ("  Cálculo II " → "calculo ii"); lo calcula la app, la base solo lo guarda. Se aplica igual en semana/día, la franja de todo el día, el mes y las filas de Hoy, Pendientes e Inicio: `CalendarioConGoogle` lo pone en `evento.color` (entren o no a pendientes) y `combinarEventosGoogle` en el `color` de cada item.
    - **Selector** (`ColorEventoGoogle`, dentro de `PanelEvento`, antes de las acciones de pendientes; es el único lugar donde se elige color): los 11 colores de la paleta (`PALETA_GOOGLE`, con los nombres de Google: Lavanda, Salvia, Uva…) como radios accesibles. **Tocar un color solo lo deja como vista previa** (resaltado, no se guarda; se puede volver a tocar el ya marcado). Debajo, dos botones, **"Solo este evento"** y **"Todos los '<título>'"** (título real, cortado a 24 caracteres; el nombre completo va en el `title`; se oculta si el título queda vacío al normalizarlo), que guardan el color en su alcance (`google_event_id` o `titulo_norm`) y cierran la selección; están deshabilitados sin vista previa. En celular los botones ocupan todo el ancho. **Ya no se crean colores por serie** (no hay pregunta de alcance ni "Toda la serie"), pero las filas antiguas de `google_colores` con `serie_id` se siguen respetando al pintar. Pintar "Todos los…" también borra el color propio de esta ocurrencia y el de su serie (lo más específico manda y, si no, no se vería el cambio); las otras ocurrencias con color propio lo conservan.
    - **Quitar color** (reemplaza a "Restablecer"): botones **"Quitar color de este evento"** y **"Quitar color de todos los '<título>'"**, cada uno visible solo si existe una fila en ese alcance (`coloresGuardados`) y que borra únicamente esa fila (`quitarColor`); el evento vuelve al siguiente color que le toque. Si hay una fila antigua por serie aparece además "Quitar color de esta serie" (sin él no habría forma de quitarla).
    - **Línea de estado** bajo la paleta, con el origen real del color: "Este evento tiene color propio", "Todos los '<título>' usan este color", "Esta serie usa este color" (solo filas antiguas), "Usa el color de Google" (el evento trae `colorId`, ahora conservado en `googleAEventos`) o "Color por defecto". Círculo marcado: la vista previa; si no, el color guardado; si no, el `colorId` de Google. Con el azul por defecto no se marca ninguno.
    - **Carga:** `useSeguimientoGoogle` pide `google_colores` en el mismo `Promise.all` que marcados, ocultos y la preferencia de todo el día (una sola vez, no una petición por evento) y los indexa en `reglas.coloresEventos` / `reglas.coloresSeries` / `reglas.coloresTitulos` (`armarReglas`). Si esa lectura falla, solo se pierden los colores propios (el resto sigue). Acciones: `cambiarColor(x, colorId, alcance)` (alcance `evento` o `titulo`, con upsert sobre `(user_id, google_event_id)` o `(user_id, titulo_norm)`) y `quitarColor(x, alcance)` (`evento`, `titulo` o `serie`, esta última solo para filas antiguas), en `seguimientoApi.js`.
  - **Rango:** `CalendarView` informa los días visibles con `onRangoVisible` (`rangoDeVista`); `useGoogleEventos(rango, activo)` pide a `google-calendar-events` solo ese rango. Caché **en memoria** (5 min, por usuario, compartida entre Inicio y Calendario; un rango contenido en otro ya pedido no vuelve a llamar). Se vuelve a pedir con "Actualizar", al volver a la pestaña si lo guardado tiene más de 5 min, y se vacía al desconectar Google (`invalidarEventosGoogle`).
  - **Interruptor** "Mostrar Google Calendar" (`useMostrarGoogle`, `localStorage` con try/catch). Apagado, no se llama a Google.
  - **Todo el día:** franja superior en semana/día (la de "todo el día" que ya existía) y punto en el mes; nunca bloque en la cuadrícula. **Zona horaria:** los eventos con hora se convierten al instante real y se muestran en Lima; las fechas de todo el día se toman como días de Lima (nunca `new Date('YYYY-MM-DD')`, que es UTC). Un evento de varios días genera un evento por día.
  - **Panel del evento** (título, hora, lugar y "Abrir en Google Calendar" en pestaña nueva); sin Editar, y tocarlo no abre la creación de pendientes. Desde la parte B2 también permite marcarlo y quitarlo de tus pendientes (ver abajo).
  - **Avisos no bloqueantes** según el `estado` de la función: `no_conectado` → invitación a /conexiones; `reconectar` y `permisos_incompletos` → aviso con enlace; fallo de la llamada → aviso y el resto del calendario sigue igual. **Los eventos de Google que NO se siguen no aparecen en Hoy ni en Pendientes** (son solo de lectura).
  - **Edge Function `google-calendar-events`:** exige el JWT (lo verifica con `usuarioDeLaPeticion`); recibe `{ desde, hasta }` (máximo 100 días); valida `estado` y que los scopes incluyan `calendar.events`; llama a `events.list` del calendario `primary` (`singleEvents`, `orderBy=startTime`, páginas de 250, tope de 1000 eventos → `truncado`); descarta cancelados, rechazados por el usuario y los creados por la app (`extendedProperties.private.origen = 'tablero-de-vida'` o su id en `tasks.google_event_id`). Devuelve `{ estado, eventos, truncado }` sin descripciones ni asistentes y no registra tokens ni contenido de eventos. Cada evento trae `serieId` (el `recurringEventId` de Google, o `null` si es suelto) y `colorId` ('1'…'11', o `null` si usa el color del calendario).
- **Eventos de Google como pendientes (Fase 3, parte B2, versión definitiva — hecha, pendiente de probar):** los eventos de Google Calendar **entran solos** a Hoy, Pendientes y la tarjeta Hoy del Inicio, y el usuario **quita** los que no quiera. Reemplaza el diseño anterior de "seguir" eventos (tablas `google_series_seguidas`, botones "Seguir").
  - **Qué entra** (`entraAPendientes`, `src/lib/seguimiento.js`): un evento con hora, o de todo el día si `profiles.google_incluir_todo_el_dia` es true; y su `googleId` no está en `google_ocultos`; y su `serieId` tampoco. Si ya hay una fila en `google_seguimiento`, esa manda sobre las demás reglas.
  - **Estado:** sin fila en `google_seguimiento` = pendiente (**virtual**, no se guarda); con fila = `completada` o `justificada`. La fila solo se crea con **Fui** o **Justificar** (motivo obligatorio) y lleva un resumen del evento (título, inicio, fin, todo_el_dia, serie_id). **Deshacer** borra la fila.
  - **Quitar** (`useSeguimientoGoogle`, `src/lib/seguimientoApi.js`, `registrarError`): *Quitar de mis pendientes* guarda el evento en `google_ocultos` y borra su fila si la tenía (pide confirmación si ya estaba marcado); *Quitar toda la serie* (solo con `serieId`) oculta la serie y borra las marcas de sus ocurrencias (confirma si hay alguna). En **Conexiones** se vuelve a incluir cada uno ("Volver a incluir") y está el interruptor "Incluir eventos de todo el día en mis pendientes".
  - **Una sola petición:** Inicio, Hoy y Pendientes piden **el mismo rango** (`rangoPendientesGoogle(hoy)`: 7 días atrás a 14 adelante) mediante `usePendientesGoogle(seguimiento, rango, activo)`. `useGoogleEventos` comparte la caché de 5 min y también las llamadas en curso cuyo rango contiene al pedido, así que navegar entre las tres páginas, o montar el calendario del Inicio, no vuelve a llamar a Google. Pendientes solo llama cuando se abre el filtro "Google". Las páginas crean `useSeguimientoGoogle()` una vez (lo guardado: marcados, ocultos, interruptor) y se lo pasan al calendario.
  - **Sin duplicados:** (1) la base tiene `unique (user_id, google_event_id)` y se guarda con `upsert` sobre esa restricción: una ocurrencia nunca tiene dos filas. (2) Al armar la lista (`combinarEventosGoogle`) la clave es el `googleId`: entran primero las filas guardadas, que ganan siempre, y un evento de Google solo se agrega si su `googleId` **no** tiene fila (y una sola vez aunque llegue partido por días). Así, una serie con ocurrencias ya marcadas muestra cada una una sola vez: las marcadas desde su fila y las demás virtuales.
  - **Panel** (`PendienteGoogle`, dentro de `PanelEvento`): mantiene título, hora, lugar y "Abrir en Google Calendar"; si el evento entra, agrega **Fui** / **Justificar** / **Deshacer** (`AccionesChecklist` con "✓ Fui"), "Quitar de mis pendientes" y "Quitar toda la serie". Los eventos que no entran (ocultos, o de todo el día con el interruptor apagado) se ven como evento normal de solo lectura.
  - **Hoy** (página y tarjeta del Inicio): los eventos de Google de hoy van en la **misma lista** que tus pendientes, sin encabezado propio ni contador aparte (ver sección 3: `TarjetaGoogle`, `AccionesEventoGoogle`). **Inicio (tarjeta Hoy):** tope de 4 filas respetando ese orden (las entregas van primero, así que nunca quedan detrás de los eventos) y "Ver todo"; el "X de Y completados" incluye los eventos. **Pendientes → filtro "Google":** los próximos 14 días y los de los últimos 7 sin marcar (etiqueta "Sin marcar"); lo más viejo sin marcar no se muestra. Los eventos sin marcar **no** suman a "Tienes N vencidas" ni a "Próximas entregas" (esos avisos salen solo de `tasks`).
  - **Google no disponible** (`no_conectado`, `reconectar`…): solo se muestran las filas guardadas, con la nota "(guardado)" (también cuando Google ya no devuelve el evento). Las filas conservan su resumen aunque se desconecte Google.
  - **Calendario:** los eventos de Google que entran muestran su estado como las tareas (completada con ✓, justificada en gris, pendiente normal). Las filas guardadas que Google ya no devuelve no se dibujan en el calendario (solo en Hoy y Pendientes).
  - **Límite conocido:** un evento de todo el día que dura varios días se guarda con su día de inicio.

- **Choques de horario** (`src/lib/choques.js`, funciones puras): dos elementos con hora se solapan si `inicio < fin_otro` y `fin > inicio_otro` (tocarse en el borde **no** cuenta). Solo se comparan **actividades de la app y eventos de Google con hora** (ni entregas ni eventos de todo el día). `buscarChoques(intervalo, elementos, { excluirId, excluirGoogleId })` devuelve lo que se cruza y excluye el propio elemento que se edita y su copia en Google (`tasks.google_event_id`, o `creadoPorApp`; la Edge Function ya descarta los eventos con `origen = 'tablero-de-vida'`). `idsConChoque(elementos)` devuelve los ids que se cruzan con otro.
  - **Al guardar una actividad** (`PendienteForm`, en Nuevo, Editar y el modal del calendario): `useComprobarChoques` compara con las actividades de ese día (`listarActividadesDelDia`) y con los eventos de Google, que reutiliza de la caché compartida (`cargarEventosGoogle`, mismo rango que Inicio/Hoy/Pendientes; solo si la fecha cae fuera pide ese día). Sin Google conectado, o si falla, compara solo con la app; nunca bloquea. Si hay choque, `AdvertenciaChoques` muestra título y horario de lo que se cruza con **"Guardar de todos modos"** y **"Cambiar hora"** (lleva el foco a la hora de inicio); cambiar día u hora quita la advertencia y se vuelve a comprobar. Las entregas no se comparan. Se compara con los eventos de Google aunque el interruptor "Mostrar Google Calendar" esté apagado o el evento esté quitado de tus pendientes. `AdvertenciaChoques` y `ListaChoques` son reutilizables (p. ej. para un futuro formulario de editar eventos de Google; hoy no existe, los eventos de Google son de solo lectura).
  - **En el calendario** (vistas semanal y de un día): `CalendarioConGoogle` marca `choque: true` en los eventos que se solapan y `BloqueEvento` dibuja un triángulo de advertencia ámbar; `PanelEvento` explica el significado y lista con qué se cruza.

### 7. Inicio (`/`, página principal) ✅
- **Saludo:** "Hola, <nombre> 👋" y la fecha en español (Lima), **en minúsculas**: "lunes, 9 de noviembre" (sin la clase CSS `capitalize`, que la convertía en "Lunes, 9 De Noviembre"; igual en Hoy y en el resumen del día). El nombre sale de `profiles.nombre`; si no hay, la parte del correo antes de la @.
- **Pantallas grandes (lg):** dos columnas. **Izquierda:** `CalendarView` compacto (`CalendarioInicio`, semanal con Anterior / Hoy / Siguiente). **Derecha:** tres tarjetas apiladas, de máximo 4 elementos y con "Ver todo":
  1. **Hoy:** pendientes de hoy por prioridad, con Completar y Justificar y el contador "X de Y completados"; aviso si hay vencidas de días anteriores. → Hoy.
  2. **Próximas entregas:** por fecha límite, con curso, prioridad y días restantes; las vencidas van primero con la etiqueta "Vencida". → Pendientes.
  3. **Promedios:** la nota final de cada curso con `NotaFinal`. → Promedios.
- **Celular:** una columna: Hoy, Próximas entregas, Calendario (un solo día) y Promedios.
- **Estados vacíos** con botón: "No tienes nada para hoy 🎉" → Nuevo pendiente · "No tienes entregas pendientes 🎉" → Agregar una entrega · "Agrega tu primer curso" → Promedios.
- **Carga eficiente:** la página pide los datos una sola vez (`useTasks`, `useCursosConNotas`, `useNombrePerfil`) y las tarjetas no consultan por su cuenta. Las funciones que preparan los datos están en `src/lib/inicio.js`; las tarjetas, en `src/components/inicio/`.

### 8. Conexión con Google (Fase 3, parte A) ✅
Página **Conexiones** (`/conexiones`, en el menú) con una tarjeta de Google: *No conectado* → "Conectar Google"; *Conectado* (con el correo de Google) → "Desconectar" (con confirmación); estado `reconectar` → "Reconectar Google". Al volver de Google lee `?google=ok|error`, muestra el mensaje y limpia la URL. Aún **no** lee ni crea eventos de Calendar ni toca Drive.

- **Flujo:** `google-connect` (con JWT del usuario) crea un `state` aleatorio ligado al `user_id` y devuelve la URL de Google → el navegador va a Google → Google vuelve a `google-callback` (sin JWT) → se valida el `state`, se cambia el `code` por tokens, se cifra el refresh token y se guarda → redirige a `APP_URL/conexiones?google=ok|error`.
- **Scopes:** `calendar.events`, `drive.file`, `openid`, `email`, con `access_type=offline` y `prompt=consent`.
- **Por qué `google-callback` no lleva JWT:** la abre el navegador cuando Google redirige al usuario, y esa redirección no puede llevar el token de sesión de Supabase. La identidad sale del `state`: un código de 32 bytes aleatorios (imposible de adivinar) que solo se creó tras verificar el JWT en `google-connect`, está ligado a un `user_id`, **vence a los 10 minutos** y **se borra al usarlo** (un segundo intento con el mismo `state` falla). Sin un `state` vigente, el callback no guarda nada. Además, el `code` de Google es de un solo uso y se cambia usando el `client_secret`, que solo existe en la función.
- **Seguridad:** `google_oauth_states` y `google_connections` tienen RLS activo y **cero políticas** (y sin permisos de tabla para `anon`/`authenticated`): el frontend no las lee; solo las Edge Functions con la service role. El frontend solo llama a `mi_conexion_google()` (sin tokens). El refresh token va cifrado con AES-GCM (IV aleatorio de 12 bytes junto al texto cifrado, clave `TOKEN_ENCRYPTION_KEY`). Los logs de las funciones solo llevan mensajes genéricos y códigos, nunca tokens, `code` ni secrets.
- **`invalid_grant`:** `obtenerAccessToken` (`_shared/google.ts`) marca la conexión como `reconectar`; la página lo muestra. Las partes B y C usarán esa función.
- **Secrets de Supabase:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APP_URL` (sin barra final), `TOKEN_ENCRYPTION_KEY` (32 bytes en base64). `SUPABASE_URL` y la service role las inyecta Supabase.
- **Despliegue:** `supabase functions deploy google-connect`, `google-callback` (`verify_jwt = false` en `supabase/config.toml`), `google-disconnect` y `google-calendar-events`; migración `20261108000000_google_conexiones.sql` en el SQL Editor **antes** de probar. Sin Docker: añadir `--use-api`. Para la parte B2 (versión definitiva): migración `20261110000000_google_eventos_automaticos.sql` en el SQL Editor (sirve tanto si ya corriste `20261109000000_google_seguimiento.sql` como si no: borra `google_series_seguidas` y las filas `pendiente`, y conserva lo ya marcado) y volver a desplegar `google-calendar-events` (`npx supabase functions deploy google-calendar-events --use-api`; ya devuelve `serieId` y `colorId`). Sin redesplegar, los eventos de Google se ven con el azul por defecto. Para los colores propios: migración `20261112000000_google_colores.sql` en el SQL Editor y, para el color por título, después `20261113000000_google_colores_titulo.sql` (no hay que redesplegar ninguna función).

### 8b. Pendientes en Google Calendar (Fase 3, parte C — hecha, pendiente de probar)
Las entregas y actividades de la app se crean y mantienen como eventos en el Google Calendar del usuario. Aún **no** se editan eventos que ya existían en Google (parte C2) ni se toca Drive.

- **Edge Function `google-calendar-sync`** (con JWT, que además verifica con `usuarioDeLaPeticion`; CORS de `_shared/cors.ts`): recibe **solo** `{ accion: 'crear' | 'actualizar' | 'borrar', tarea_id }`. Lee la tarea con la service role filtrando por el `user_id` del JWT y arma el evento dentro de la función (el cliente nunca manda datos del evento). Valida que los scopes incluyan `calendar.events`. Responde `{ estado, google_event_id, google_sync, google_sync_error }` con `estado` = `ok` | `no_conectado` | `reconectar` | `permisos_incompletos` | `error`. `invalid_grant` lo maneja `obtenerAccessToken` (marca `reconectar`). Los logs solo llevan códigos.
  - **Id determinista:** el uuid de la tarea sin guiones. Crear = `POST`; si Google responde 409 (ya existía), `PUT` sobre ese id: reintentar nunca duplica. Actualizar = `PUT` (reemplaza el evento entero, con `status: 'confirmed'`: si el usuario lo borró en Google, reaparece; el de la app manda); si responde 404/410, se vuelve a crear. La función siempre usa el id derivado de la tarea, nunca uno que venga de la base o del cliente.
  - **Evento:** actividad = fecha + `hora_inicio`/`hora_fin` en `America/Lima` (sin hora: todo el día), título tal cual, popup 30 min antes. Entrega = termina en la hora límite y dura 30 min, título "📚 <título>", "Curso: …" en la descripción, popups 240, 60 y 15 min antes. Descripción + línea "Creado desde Tablero de Vida". `reminders.useDefault = false`. `extendedProperties.private = { origen: 'tablero-de-vida', tarea_id }`.
  - **Estado visual:** completada → "✓ " + `colorId` 8 (gris); justificada → "~ " + gris; pendiente → sin prefijo ni color.
  - **Borrar:** `DELETE`; 404/410 cuentan como borrado. Limpia `google_event_id` y deja `google_sync = 'ninguno'`.
  - Si falla al crear o actualizar, guarda `google_sync = 'error'` y un `google_sync_error` genérico.
- **Frontend** (`src/lib/googleSync.js`, `sincronizarConGoogle` en `googleApi.js`, que nunca lanza error):
  - **El pendiente se guarda SIEMPRE primero.** Si Google falla, queda `google_sync = 'pendiente'` (se pidió y no llegó respuesta) o `'error'`; si la función ni responde, el frontend marca `'error'`.
  - **Crear:** `PendienteForm` muestra "Añadir a Google Calendar" solo si Google está conectado (`useConexionGoogle`: caché compartida de `mi_conexion_google()` + `profiles.google_sincronizar`, `recargarConexionGoogle()` al desconectar). Por defecto: `profiles.google_sincronizar` en uno nuevo; al editar, si ya está en Google. `onGuardar(campos, { anadirAGoogle })`. Nuevo pendiente usa `crearPendiente` (espera a Google antes de volver a la lista); el modal del calendario usa `useTasks.crear` (sincroniza en segundo plano).
  - **Editar** (`actualizarPendiente` + `accionTrasEditar`): interruptor encendido → crear o actualizar; apagado → borrar el evento si estaba; sin interruptor → actualizar solo si ya estaba. **Completar, justificar o deshacer** (`useTasks.cambiar`) → `actualizar` en segundo plano si está en Google (`estaEnGoogle`: tiene `google_event_id` o `google_sync` ≠ `ninguno`).
  - **Borrar** (`borrarPendiente`): `borrar` en Google antes de eliminar la fila; si falla, borra la tarea igual y Pendientes (o el calendario, si se borró desde su panel) avisa que el evento pudo quedar en Google.
  - **En cada pendiente** (`EstadoGoogleTarea`, dentro de `TarjetaTarea`; solo con Google conectado): sincronizado → ícono + "Abrir en Google Calendar" (`enlaceEventoGoogle`: `eid` = base64 de "<id> <correo de Google>"); `pendiente`/`error` → aviso ámbar discreto con "Reintentar" (`useTasks.sincronizar(id, 'crear')`).
  - **Conexiones:** interruptor "Crear eventos en Google automáticamente" (`profiles.google_sincronizar`) y "Sincronizar mis pendientes existentes": confirma cuántos son (pendientes futuros sin completar y sin `google_event_id`, `pendientesParaSincronizar`) y los crea de 5 en 5 (`sincronizarVarias`) con barra de progreso.
  - **Sin duplicados ni falsos choques:** `google-calendar-events` descarta los eventos con `origen = 'tablero-de-vida'` o cuyo id está en `tasks.google_event_id`; `CalendarioConGoogle` también descarta por id (por la caché previa) y pasa `excluirGoogleId` a `buscarChoques`; `useComprobarChoques` ya excluía la copia del pendiente que se edita.
  - Sin Google conectado todo funciona como antes: ni interruptor ni avisos.
- **Despliegue:** migración `20261111000000_google_sincronizar_pendientes.sql` en el SQL Editor y luego `npx supabase functions deploy google-calendar-sync` (sin Docker: `--use-api`). Conviene volver a desplegar `google-calendar-events` (ahora importa las constantes de `_shared/google.ts`).

### 9. Archivos en Google Drive (Fase 3, parte D — hecha, pendiente de probar)
Una carpeta por curso dentro de una carpeta raíz **"Promediate"** (constante `NOMBRE_CARPETA_RAIZ`, `_shared/drive.ts`) en el Drive del usuario. Solo usa `drive.file` (ya concedido): la app solo ve lo que ella creó.

- **Subida en 3 pasos** (`subirArchivo`, `src/lib/archivosApi.js`, nunca lanza error):
  1. `google-drive-upload-init` recibe `{ course_id, nombre, mime_type, tamano }`; valida que el curso es del usuario, el nombre (1–200, sin caracteres de control), el tope de **100 MB** (`MAX_TAMANO_ARCHIVO`, única constante del backend, en esta función) y bloquea `.exe .bat .cmd .msi .scr .js .vbs .sh` (también por tipo MIME); asegura las carpetas e inicia una **subida reanudable** (`uploadType=resumable`, con `X-Upload-Content-Length`) y devuelve `upload_url`. La sesión se inicia con la cabecera `Origin` del origen permitido que hizo la petición (`origenDeLaApp`: APP_URL o `http://localhost:5173`), porque Google solo acepta el PUT del navegador (CORS) desde ese origen.
  2. El navegador hace `PUT` directo a `upload_url` con `XMLHttpRequest` (fetch no da progreso de subida). El archivo no pasa por Supabase y el access token nunca llega al navegador. Sin respuesta → `sin_conexion` o `sin_respuesta` (red o CORS; se ve en la consola).
  3. `google-drive-register` recibe `{ drive_file_id, course_id, task_id? }`; comprueba curso y entrega del usuario, pide a Drive los metadatos **reales** (nombre, mimeType, size, webViewLink, parents), exige que el padre sea la carpeta del curso, vuelve a validar el tipo (si no cumple, lo borra de Drive; el tamaño no hace falta: lo fija `X-Upload-Content-Length` en la sesión) y guarda la fila con `upsert` sobre `(user_id, drive_file_id)`.
- **Carpetas** (`asegurarCarpetaCurso`, `_shared/drive.ts`): ids en `profiles.drive_root_folder_id` y `courses.drive_folder_id`; se encuentran **siempre por esos ids, nunca buscando por nombre**. En cada subida se leen las dos a la vez (`files.get` con `name`, `parents`, `trashed`). Si la raíz guardada tiene otro nombre (las creadas antes como "Tablero de Vida"), se **renombra** a `NOMBRE_CARPETA_RAIZ` con `files.update` en vez de crear otra; si el renombrado falla, se registra y la subida sigue (se reintenta en la próxima). Si una carpeta responde 404, está en la papelera o ya no está dentro de la raíz, se crea otra y se guarda el id nuevo. Las subcarpetas de curso conservan el nombre del curso. El id se guarda solo si nadie lo cambió mientras tanto; si otra petición ganó, se usa la suya y se borra la recién creada. Además el frontend sube **de uno en uno** (`useSubidas`) para no crear carpetas duplicadas. Renombrar un curso no renombra su carpeta.
- **Borrar** (`google-drive-delete`, `{ archivo_id }`): verifica que la fila es del usuario, `DELETE` en Drive (borrado definitivo, no papelera; 404/410 cuentan como borrado) y elimina la fila. Si Google no está disponible, la fila **no** se borra. **"Quitar de la lista"** solo borra la fila desde el frontend (RLS), para archivos que el usuario ya borró en Drive; no se verifica cada archivo.
- **Estados** de las tres funciones: `ok`, `no_conectado`, `reconectar`, `permisos_incompletos`, `demasiado_grande`, `tipo_no_permitido`, `error` (textos en `MENSAJES_ARCHIVO`, `src/lib/archivos.js`). `invalid_grant` lo maneja `obtenerAccessToken`. Los logs solo llevan códigos: nunca tokens, la URL de sesión ni nombres de archivos.
- **Frontend:**
  - **Archivos** (`/archivos`, en el menú): una tarjeta por curso con cuántos archivos tiene (`archivos(count)` en la misma consulta) y "Abrir carpeta en Drive" (si ya existe la carpeta; se crea con la primera subida). Abajo, "Sin curso": archivos de cursos borrados (siguen en Drive).
  - **Archivos de un curso** (`/archivos/:id`): lista (nombre, tipo, tamaño, fecha, "Abrir en Drive", Borrar con "Se eliminará también de tu Google Drive", Quitar de la lista) y "Subir archivo" con selección múltiple, barra de progreso y error por archivo (`ProgresoSubidas`).
  - **Adjuntos de una entrega** (`AdjuntosEntrega`): en `PanelEvento` y en el formulario al **editar** una entrega (una nueva aún no tiene id). Sube a la carpeta del curso de la entrega (en el formulario, el curso elegido en ese momento) con `task_id`; si no tiene curso, pide elegir uno.
  - **Sin Google** (`useEstadoDrive`: `useConexionGoogle`, que ahora expone `reconectar`, + el último estado que devolvió una función, p. ej. `permisos_incompletos`): `AvisoDrive` invita a Conexiones, se oculta "Subir" y la lista registrada se sigue viendo con sus enlaces.
  - Componentes en `src/components/archivos/`; reglas y textos en `src/lib/archivos.js` (copia de la validación de `_shared/drive.ts` y del tope, solo para avisar antes de subir). El tope está **una sola vez** en el frontend (`MAX_TAMANO_ARCHIVO`); el aviso "Máximo … por archivo" y el mensaje `demasiado_grande` usan `TEXTO_TAMANO_MAXIMO`, derivado de él. Si cambia, cambiar también el de `google-drive-upload-init`.
- **Despliegue:** migración `20261114000000_google_drive_archivos.sql` en el SQL Editor y luego `npx supabase functions deploy google-drive-upload-init`, `google-drive-register` y `google-drive-delete` (sin Docker: `--use-api`). Tras cambiar el tope o el nombre de la raíz (ambos viven en `_shared/drive.ts` o en `google-drive-upload-init`), redesplegar `google-drive-upload-init` y `google-drive-register` (las dos importan `_shared/drive.ts`; `google-drive-delete` también, aunque no usa lo que cambió).

### 10. Recordatorios (Fase 2)
Se separan en dos piezas independientes, para poder cambiar el canal sin tocar las reglas:

- **Cuándo avisar (lógica):** solo el día de entrega, cada 4 horas y, durante la última hora, cada 15 minutos. `pg_cron` corre cada 15 minutos y llama a una Edge Function que decide qué pendientes toca avisar, a quién y qué mensaje enviar. Esta parte no sabe nada del canal.
- **Por dónde avisar (canal):** **por definir** (opciones: push de la PWA, correo o Telegram). Es un módulo aparte que solo recibe "usuario + mensaje" y lo envía. Cada canal pide su propio ajuste (push: suscripción del dispositivo; correo: proveedor de envío; Telegram: bot de @BotFather, token solo como secret de Supabase y vinculación del usuario con `/start`). Las claves del canal, solo como secrets de la Edge Function.
- **Por definir (reglas):** a qué hora empiezan los avisos de cada 4 horas, horas de silencio, si aplica también a actividades y si se detienen al completar o justificar.

### 11. IA (Fase 4)
El usuario elige su proveedor y guarda su propia API key (cifrada, usada solo desde Edge Functions). Preguntas como "¿qué tengo el jueves?" usando sus pendientes como contexto.

---

## Modelo de datos

Las 4 tablas principales tienen RLS activo con políticas por usuario (`user_id = auth.uid()`; en `profiles`, `id = auth.uid()`). Las 2 tablas de conexión de Google (`google_oauth_states`, `google_connections`) tienen RLS activo **sin políticas** a propósito. Las 3 de eventos de Google (`google_seguimiento`, `google_ocultos`, `google_colores`) y `archivos` tienen RLS con políticas por usuario, solo con `user_id = (select auth.uid())` (sin subconsultas).

- **`profiles`**: `id` (= auth.users.id), `nombre`, `ultimo_resumen` (date), `google_incluir_todo_el_dia` (boolean, default false), `google_sincronizar` (boolean, default true: crear los pendientes nuevos en Google), `drive_root_folder_id` (nullable; carpeta raíz "Promediate" en Drive), `created_at`. Sin política de borrado (se borra con el usuario).
- **`courses`**: `id`, `user_id`, `nombre`, `color`, `drive_folder_id` (nullable; carpeta del curso en Drive), `created_at`.
- **`archivos`**: `id`, `user_id` (default `auth.uid()`, `on delete cascade`), `course_id` (nullable, `on delete set null`), `task_id` (nullable, `on delete set null`), `drive_file_id`, `nombre`, `mime_type`, `tamano` (bigint), `enlace` (webViewLink), `created_at`. Único por (`user_id`, `drive_file_id`). RLS con políticas por usuario, solo `user_id = (select auth.uid())`; que `course_id` y `task_id` sean del usuario lo comprueba `google-drive-register`. Migración `20261114000000_google_drive_archivos.sql`.
- **`tasks`**: `id`, `user_id`, `course_id` (nullable; al borrar el curso queda en null), `titulo`, `descripcion`, `tipo` (`tarea` | `actividad`), `prioridad_base`, `fecha_entrega` (timestamptz, solo entregas), `fecha_actividad` (date, solo actividades), `hora_inicio` y `hora_fin` (time, nullable; hora de pared de Lima; fin > inicio), `estado` (`pendiente` | `completada` | `justificada`), `justificacion`, `completed_at`, `google_event_id` (nullable; = id de la tarea sin guiones cuando está en Google), `google_sync` (`ninguno` | `ok` | `pendiente` | `error`, default `ninguno`), `google_sync_error` (texto genérico, ≤ 200, nullable), `created_at`.
- **`evaluations`**: `id`, `user_id`, `course_id`, `parent_id` (nullable; al borrar un nodo se borran sus hijos), `nombre`, `peso` (numeric 0–100, **% del padre**), `nota` (numeric 0–20, nullable), `orden`, `reparto` (`manual` | `iguales`, default `manual`), `descartar_peores` (int ≥ 0, default 0).
- **`google_oauth_states`** (solo Edge Functions): `state` (PK, aleatorio), `user_id`, `expira_en` (10 min), `created_at`. Los vencidos se borran al crear uno nuevo.
- **`google_seguimiento`**: `id`, `user_id` (default `auth.uid()`, `on delete cascade`), `google_event_id` (id de la ocurrencia en Google), `serie_id` (nullable), `titulo`, `inicio` (timestamptz), `fin` (nullable), `todo_el_dia`, `estado` (`completada` | `justificada`; justificada exige motivo), `justificacion`, `completed_at`, `created_at`. Único por (`user_id`, `google_event_id`). **Una fila existe solo si el usuario marcó el evento**; los pendientes son virtuales.
- **`google_ocultos`**: `id`, `user_id` (default `auth.uid()`, `on delete cascade`), `google_event_id` (nullable), `serie_id` (nullable), `titulo`, `created_at`. Exactamente uno de `google_event_id` o `serie_id` no nulo (check). Único por (`user_id`, `google_event_id`) y por (`user_id`, `serie_id`).
- **`google_colores`**: `id`, `user_id` (default `auth.uid()`, `on delete cascade`), `serie_id` (nullable), `google_event_id` (nullable), `titulo_norm` (nullable; título en minúsculas, sin espacios en los bordes y sin tildes), `color_id` (text, '1'…'11'), `created_at`. Exactamente uno de `serie_id`, `google_event_id` o `titulo_norm` no nulo (check). Único por (`user_id`, `serie_id`), por (`user_id`, `google_event_id`) y por (`user_id`, `titulo_norm`). Migraciones `20261112000000_google_colores.sql` y `20261113000000_google_colores_titulo.sql` (SQL Editor, en ese orden, antes de probar).
- **`google_connections`** (solo Edge Functions): `user_id` (PK, `on delete cascade`), `refresh_token_cifrado`, `scopes`, `email_google`, `estado` (`activa` | `reconectar`), `created_at`, `updated_at`. El frontend solo ve `mi_conexion_google()` → `conectado`, `email_google`, `estado`.

---

## Reglas aprendidas

- **Una política RLS nunca debe consultar su propia tabla directamente:** causó `infinite recursion` (error 42P17). Si hace falta, usa una función `security definer` como `es_nodo_propio`, con `set search_path = public` y permisos de ejecución solo para `authenticated`. Ya aplicado en `evaluations` (`20261030100000_evaluations_es_nodo_propio.sql`); `supabase/verificar_es_nodo_propio.sql` comprueba que la base real coincida.
- **Todo cambio en la base de datos se guarda como migración** en `supabase/migrations/` y se ejecuta en el SQL Editor de Supabase **antes** de publicar el código que lo usa.
- **Revisión de seguridad:** las 4 tablas tienen RLS activo y políticas; el frontend solo usa las dos variables `VITE_*`; en Vercel solo existen esas dos variables.
- **Errores de Supabase:** se muestran completos en consola (`message`, `details`, `hint`, `code`) con `registrarError` (`src/lib/errores.js`) antes del `throw`: `if (error) throw registrarError(error)`. Al usuario se le muestran mensajes genéricos. Usa lo mismo en toda API nueva.

## Despliegue

- Cada push a `main` despliega en Vercel (https://promediate.vercel.app).
- `vercel.json` reescribe todas las rutas a `index.html` (para que `/hoy`, `/promedios`… funcionen al recargar).
- La PWA solo guarda en caché los archivos de la app; **no** cachea las respuestas de Supabase (no hay `runtimeCaching`).
- En Supabase (Authentication → URL Configuration), **Site URL** y **Redirect URLs** incluyen la dirección de Vercel y `http://localhost:5173`.

---

## Fases

- [x] **Fase 1** — terminada: publicada en Vercel, instalable como PWA y probada en celular (login/registro, pendientes, Hoy y resumen del día, promedios, calendario e Inicio).
- [ ] **Fase 2:** recordatorios (canal por definir; ver sección 10)
- [ ] **Fase 3:** Google Calendar y Google Drive
  - [x] **A:** conectar la cuenta de Google (sección 8; hecha y probada)
  - [ ] **B:** leer eventos de Google Calendar (sección 6; hecha, falta confirmar la prueba en local; colores propios hechos (por evento, serie y título), falta ejecutar las migraciones `20261112000000` y `20261113000000` y probar)
    - [ ] **B2:** eventos de Google como pendientes en Hoy y Pendientes, que el usuario puede quitar (sección 6; hecha, falta ejecutar la migración `20261110000000` y probar)
  - [ ] **C:** crear y sincronizar los pendientes como eventos en Google Calendar (sección 8b; hecha, falta ejecutar la migración `20261111000000`, desplegar `google-calendar-sync` y probar)
    - [ ] **C2:** editar desde la app eventos que ya existían en Google
  - [ ] **D:** archivos en Google Drive (sección 9; hecha, falta ejecutar la migración `20261114000000`, desplegar las tres funciones de Drive y probar, sobre todo que el PUT directo a Google pase el CORS)
- [ ] **Fase 4:** IA (preguntas y lectura de sílabos)

Actualiza esta lista cuando terminemos cada fase.
