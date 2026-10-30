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
                  # NuevaTarea (Nuevo pendiente), EditarTarea, Login, Registro
  lib/            # supabaseClient, fechas, tipos, priority, checklist, calendario, inicio, arbol, grades, APIs
  hooks/          # useAuth, useTasks, useCursosConNotas, useEvaluaciones, ...
supabase/
  migrations/
  diagnostico_pesos.sql          # solo lee; revisa los pesos antes de migrar
  verificar_es_nodo_propio.sql   # solo lee; compara la base real con la migración de RLS
  functions/              # (Fase 2 en adelante) Edge Functions
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
- Fase 3: al crear un pendiente se crea también el evento en Google Calendar (`google_event_id`).

### 3. Hoy (checklist diario)
- Muestra las entregas que vencen hoy y las actividades de hoy; se calcula con la fecha de Lima, no hay proceso que lo genere.
- **Completar** (guarda `completed_at`) o **justificar** (motivo obligatorio): ambos pasan a "Hechas" y se pueden **deshacer**.
- Los pendientes de días anteriores sin completar van aparte, en "Vencidas".

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
- Fase 3: leer los eventos de Google Calendar del usuario.

### 7. Inicio (`/`, página principal) ✅
- **Saludo:** "Hola, <nombre> 👋" y la fecha en español (Lima). El nombre sale de `profiles.nombre`; si no hay, la parte del correo antes de la @.
- **Pantallas grandes (lg):** dos columnas. **Izquierda:** `CalendarView` compacto (`CalendarioInicio`, semanal con Anterior / Hoy / Siguiente). **Derecha:** tres tarjetas apiladas, de máximo 4 elementos y con "Ver todo":
  1. **Hoy:** pendientes de hoy por prioridad, con Completar y Justificar y el contador "X de Y completados"; aviso si hay vencidas de días anteriores. → Hoy.
  2. **Próximas entregas:** por fecha límite, con curso, prioridad y días restantes; las vencidas van primero con la etiqueta "Vencida". → Pendientes.
  3. **Promedios:** la nota final de cada curso con `NotaFinal`. → Promedios.
- **Celular:** una columna: Hoy, Próximas entregas, Calendario (un solo día) y Promedios.
- **Estados vacíos** con botón: "No tienes nada para hoy 🎉" → Nuevo pendiente · "No tienes entregas pendientes 🎉" → Agregar una entrega · "Agrega tu primer curso" → Promedios.
- **Carga eficiente:** la página pide los datos una sola vez (`useTasks`, `useCursosConNotas`, `useNombrePerfil`) y las tarjetas no consultan por su cuenta. Las funciones que preparan los datos están en `src/lib/inicio.js`; las tarjetas, en `src/components/inicio/`.

### 8. Archivos (Fase 3)
Carpetas (una por curso). Los adjuntos se suben al Google Drive del usuario con el permiso `drive.file`.

### 9. Recordatorios (Fase 2)
Se separan en dos piezas independientes, para poder cambiar el canal sin tocar las reglas:

- **Cuándo avisar (lógica):** solo el día de entrega, cada 4 horas y, durante la última hora, cada 15 minutos. `pg_cron` corre cada 15 minutos y llama a una Edge Function que decide qué pendientes toca avisar, a quién y qué mensaje enviar. Esta parte no sabe nada del canal.
- **Por dónde avisar (canal):** **por definir** (opciones: push de la PWA, correo o Telegram). Es un módulo aparte que solo recibe "usuario + mensaje" y lo envía. Cada canal pide su propio ajuste (push: suscripción del dispositivo; correo: proveedor de envío; Telegram: bot de @BotFather, token solo como secret de Supabase y vinculación del usuario con `/start`). Las claves del canal, solo como secrets de la Edge Function.
- **Por definir (reglas):** a qué hora empiezan los avisos de cada 4 horas, horas de silencio, si aplica también a actividades y si se detienen al completar o justificar.

### 10. IA (Fase 4)
El usuario elige su proveedor y guarda su propia API key (cifrada, usada solo desde Edge Functions). Preguntas como "¿qué tengo el jueves?" usando sus pendientes como contexto.

---

## Modelo de datos

Las 4 tablas tienen RLS activo con políticas por usuario (`user_id = auth.uid()`; en `profiles`, `id = auth.uid()`).

- **`profiles`**: `id` (= auth.users.id), `nombre`, `ultimo_resumen` (date), `created_at`. Sin política de borrado (se borra con el usuario).
- **`courses`**: `id`, `user_id`, `nombre`, `color`, `created_at`.
- **`tasks`**: `id`, `user_id`, `course_id` (nullable; al borrar el curso queda en null), `titulo`, `descripcion`, `tipo` (`tarea` | `actividad`), `prioridad_base`, `fecha_entrega` (timestamptz, solo entregas), `fecha_actividad` (date, solo actividades), `hora_inicio` y `hora_fin` (time, nullable; hora de pared de Lima; fin > inicio), `estado` (`pendiente` | `completada` | `justificada`), `justificacion`, `completed_at`, `google_event_id` (nullable), `created_at`.
- **`evaluations`**: `id`, `user_id`, `course_id`, `parent_id` (nullable; al borrar un nodo se borran sus hijos), `nombre`, `peso` (numeric 0–100, **% del padre**), `nota` (numeric 0–20, nullable), `orden`, `reparto` (`manual` | `iguales`, default `manual`), `descartar_peores` (int ≥ 0, default 0).

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
- [ ] **Fase 2:** recordatorios (canal por definir; ver sección 9)
- [ ] **Fase 3:** Google Calendar y Google Drive
- [ ] **Fase 4:** IA (preguntas y lectura de sílabos)

Actualiza esta lista cuando terminemos cada fase.
