# Tablero de Vida — Contexto del proyecto

App web multiusuario para organizar la vida universitaria: tareas, checklist diario, calendario, archivos y promedios por curso. Es una **demo** personal, pero debe funcionar para varios usuarios.

Habla conmigo **en español** y explícame brevemente lo que haces: estoy aprendiendo.

---

## Stack

- **Frontend:** React + Vite (JavaScript), React Router, Tailwind CSS
- **Backend:** Supabase (Auth, Postgres, Storage, Edge Functions, pg_cron)
- **PWA:** `vite-plugin-pwa` (instalable, notificaciones push más adelante)
- **Hosting:** Vercel (se despliega solo al hacer push a `main`)
- **Zona horaria de la app:** `America/Lima`. Todas las fechas se muestran y calculan en esa zona, nunca en la del servidor.

## Reglas obligatorias

1. **Nunca** escribas claves en el código. Todo va en `.env.local` (que está en `.gitignore`). En el frontend solo se usan variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`. La *service role key* y las claves de Google/IA solo existen en Edge Functions como secrets.
2. **Toda tabla nueva lleva RLS activado** con políticas para que cada usuario solo lea y escriba sus propias filas (`user_id = auth.uid()`).
3. Los cambios de base de datos se guardan como migraciones SQL en `supabase/migrations/`.
4. Trabaja en cambios pequeños: una funcionalidad a la vez. Antes de algo grande, muéstrame un plan.
5. Al terminar una funcionalidad: verifica que `npm run build` funcione y propón un commit con mensaje descriptivo en español.
6. Diseño responsive pensado primero para celular. Soporta modo oscuro.
7. No agregues librerías sin explicarme para qué sirven.

## Estructura sugerida

```
src/
  components/     # piezas reutilizables (botones, tarjetas, modales)
  pages/          # Inicio, Pendientes (Tareas.jsx), Nuevo pendiente (NuevaTarea.jsx), Hoy (checklist), Calendario, Archivos, Promedios, Login, Registro
  lib/            # supabaseClient.js, utilidades de fechas, cálculo de prioridad y promedios
  hooks/          # useAuth, useTasks, etc.
supabase/
  migrations/
  functions/      # Edge Functions (Google, recordatorios, IA)
```

---

## Funcionalidades

### 1. Login y registro
- Supabase Auth con correo y contraseña. (Más adelante: "Iniciar sesión con Google".)
- Rutas protegidas: sin sesión, todo redirige a Login.

### 2. Pendientes: entregas y actividades
- **Nombres en pantalla** (en la base de datos y el código el valor sigue siendo `tarea` / `actividad`; el mapeo vive en `src/lib/tipos.js`):
  - `tarea` → **Entrega**: algo de la universidad, con fecha y hora límite.
  - `actividad` → **Actividad**: algo personal, con fecha, hora de inicio y hora de fin.
  - La página del formulario se llama **"Nuevo pendiente"**; la lista, **"Pendientes"**. En la interfaz no se usa la palabra "tarea".
- Formulario en su propia pestaña/página. Arriba, dos tarjetas grandes con ícono para elegir entre Entrega y Actividad; según la elección cambian los campos:
  - **Entrega:** título, descripción, curso (opcional), prioridad base (`alta`, `media`, `baja`), fecha y hora límite. Botón: "Guardar entrega".
  - **Actividad:** título, descripción, prioridad base, fecha, hora de inicio y hora de fin (el fin debe ser posterior al inicio). **Sin curso.** Botón: "Guardar actividad".
- **Prioridad dinámica:** no se guarda, se *calcula* al mostrarla a partir de la prioridad base y los días restantes:
  - `baja` → `media` cuando faltan ≤ 5 días
  - `media` → `alta` cuando faltan ≤ 2 días
  - Vence hoy → siempre `alta`
  - (Reglas en una sola función en `src/lib/priority.js` para poder ajustarlas.)
- Estados: `pendiente`, `completada`, `justificada` (con motivo obligatorio), `vencida` (calculado).
- Fase 3: al crear un pendiente se crea también el evento en Google Calendar.

### 3. Página "Hoy" (checklist diario)
- Muestra las entregas que vencen hoy y las actividades de hoy. No se "genera" con un proceso: se calcula según la fecha actual en Lima.
- Marcar como completada (guarda `completed_at`) o **justificar** (motivo obligatorio, estado `justificada`): en ambos casos sale de la lista de pendientes y pasa a "Hechas". Se puede **deshacer**.
- Los pendientes de días anteriores que siguen sin completar se muestran aparte, en una sección "Vencidas".
- Las completadas se ven marcadas en el calendario de la app.

### 4. Resumen del día (pantalla de bienvenida)
- La primera vez que el usuario abre la app cada día (desde las 00:00, hora de Lima) se muestra un modal/pestaña con todos los pendientes del día ordenados por prioridad calculada.
- La última fecha vista se guarda en la base de datos (`profiles.ultimo_resumen`) para que funcione igual en todos los dispositivos.
- Al cerrar el modal (botón, Esc o clic afuera) se actualiza `profiles.ultimo_resumen` con la fecha de hoy en Lima.

### 5. Promedios por curso
- Botón "Agregar curso". Cada curso tiene un **árbol de evaluaciones**: cada nodo tiene nombre y peso (%), y puede tener hijos o ser una hoja (prueba) con nota.
- **Pesos ABSOLUTOS:** el peso de cada nodo es % del **curso entero**, no de su padre.
  - Los nodos de primer nivel suman 100. Los hijos de un grupo suman el peso del grupo.
  - Ej.: Examen final 30% · Evaluación continua 70% → (PCs 28% · Tareas 21% · Proyecto 21%), y PCs → PC1 14%, PC2 14%.
  - Validación por nivel con tolerancia de 0.01: "Faltan 30% para completar los 70% de PEP" / "Sobran 5%: …" / "Faltan 10% para completar el 100% del curso".
  - (Hasta el 22/10/2026 eran relativos; la migración `20261022000000_pesos_absolutos.sql` los convierte, grupo por grupo.)
- **Reparto de un grupo** (`evaluations.reparto`):
  - `manual`: cada hijo tiene su peso guardado.
  - `iguales`: los hijos se reparten el peso del grupo; su `peso` guardado se ignora (se calcula, no se guarda), así que se reequilibran solos al agregar o borrar. Botón **"+ Subdivisiones iguales"** → "Crear N subdivisiones iguales" con nombre base (Laboratorio → Laboratorio 1…6). Al volver a manual, cada hijo guarda su parte igual como peso.
- **Descartar las N peores** (`evaluations.descartar_peores`, solo en modo iguales):
  - N va de 0 a (hijos − 1); se ajusta solo si cambia la cantidad de hijos. No hay un número fijo de pruebas: son las subdivisiones que el usuario creó.
  - Con n hijos y N descartes cuentan las n − N mejores, y cada una vale (peso del grupo) / (n − N).
  - Las pruebas sin nota cuentan como 0 al calcular la nota final, así que se descartan primero: si hay menos de n − N notas ingresadas, cuentan todas. (Descartar siempre N entre las ingresadas haría que la nota *baje* al ingresar una nota nueva.)
  - Las descartadas se ven tachadas con la etiqueta "descartada".
- Se pueden agregar, editar, anidar y borrar nodos.
- Escala vigesimal (0–20). Mostrar:
  - **Nota final** (el número grande): los **puntos acumulados** sobre 20; lo que aún no tiene nota cuenta como 0.
  - **Máximo posible:** la nota final si todo lo que falta sale 20.
  - **"Te faltan X puntos para aprobar"** (o **"Aprobado ✓"** si la nota final ya es ≥ 10.5) y una línea pequeña **"Mejor nota: N en <prueba>"**.
  - **Nota mínima:** "Necesitas sacar al menos X en lo que falta" = la menor nota que, sacada en todas las pruebas pendientes, lleva a 10.5 (solo si todos los niveles cuadran).
- **Cómo se calcula** (`src/lib/grades.js`, nada se guarda): se evalúa el curso suponiendo que cada prueba sin nota saca *x*. Con x = 0 sale la nota final; con x = 20, el máximo; la nota mínima es el menor x que llega a 10.5 (búsqueda por bisección). Así el descarte funciona igual en los tres casos. El promedio de cada rama (puntos / peso evaluado que cuenta) se muestra en su encabezado.
- **Colores de la nota final** (los mismos en la página del curso, la lista de cursos y el Inicio, con `NotaFinal` y `estadoNota`):
  - **Verde:** nota final ≥ 10.5 (comparada con 2 decimales, como se ve en pantalla).
  - **Rojo:** solo si el máximo posible es < 10.5 (ni sacando 20 en lo que falta se aprueba) y todos los niveles cuadran.
  - **Neutro:** en cualquier otro caso (todavía se puede aprobar).
- **Árbol en pantalla:** las ramas con subdivisiones aparecen cerradas, con una flecha; se abren al tocar el encabezado (nombre, promedio y peso). Qué ramas están abiertas se recuerda por curso en `localStorage`. Los botones Editar, + Subdivisión, + Subdivisiones iguales y Borrar siempre están visibles. Al abrir un grupo se ven sus controles: Reparto (Manual / Partes iguales) y, en partes iguales, "Descartar las N peores".
- **Notas en el mismo lugar:** una prueba sin nota muestra "+ Nota" (campo 0–20 con decimales; Enter guarda, Esc cancela); con nota se muestra un chip clicable para corregirla y una "×" para borrarla. El formulario de editar rama no maneja notas.
- En el Inicio se ve solo la nota final de cada curso (con los mismos colores).
- Fase 4: subir el sílabo en PDF y que la IA proponga el árbol; el usuario lo revisa antes de guardar.

### 6. Calendario (fase 3)
- Leer eventos de Google Calendar del usuario y mostrarlos con el diseño de la app (vista semanal tipo horario).
- Mostrar los pendientes de la app (entregas y actividades) y su estado (completada / pendiente).
- **Creación rápida** (`NuevoPendienteModal` + `PendienteForm`, el mismo formulario de Nuevo/Editar pendiente): tocar un espacio vacío de un día abre el modal con esa fecha; en la cuadrícula horaria rellena inicio (al cuarto de hora más cercano) y fin (+1 h) como Actividad; el encabezado del día crea una Entrega 23:59; en la vista mensual cada casilla tiene un "+"; el botón "+ Nuevo" usa la fecha de hoy. En la vista semanal el *número* del día abre la vista de ese día. Al guardar, `useTasks.crear` agrega la fila a la lista sin recargar.

### 7. Archivos (fase 3)
- Sección de carpetas (una por curso). Los archivos adjuntos se suben al Google Drive del usuario usando el permiso `drive.file`.

### 8. Recordatorios (fase 2)
- Solo el día de entrega: cada 4 horas, y durante la última hora cada 15 minutos.
- Proceso con `pg_cron` cada 15 minutos que llama a una Edge Function y revisa qué toca enviar. Canal por definir (correo, push o Telegram).

### 9. IA (fase 4)
- El usuario elige su proveedor y guarda su propia API key (cifrada, solo usada desde Edge Functions).
- Preguntas como "¿qué tengo el jueves?" usando sus pendientes como contexto.

### 10. Página de Inicio ✅ (hecha)
Junta datos de pendientes, checklist y promedios. Es la página `/`, la principal tras iniciar sesión.
- **Saludo:** "Hola, <nombre> 👋" y la fecha de hoy en español (hora de Lima). El nombre sale de `profiles.nombre`; si no tiene, la parte del correo antes de la @.
- **Pantallas grandes (lg):** dos columnas.
  - **Izquierda:** `CalendarView` en versión compacta: vista **semanal** con Anterior / Hoy / Siguiente (`CalendarioInicio`). Al tocar un evento se abre `PanelEvento` (completar, justificar, editar).
  - **Derecha:** tres tarjetas **apiladas**, de **máximo 4 elementos** y con enlace **"Ver todo"**:
    1. **Hoy:** pendientes de hoy por prioridad calculada, con **Completar** y **Justificar**, y el contador "X de Y completados" (completadas y justificadas cuentan como hechas). Si hay actividades vencidas de días anteriores, un aviso con enlace a Hoy. "Ver todo" → Hoy.
    2. **Próximas entregas:** entregas pendientes por fecha límite, con curso, prioridad calculada y días restantes; las vencidas sin completar van primero, con la etiqueta "Vencida". "Ver todo" → Pendientes.
    3. **Promedios:** la nota final de cada curso con los mismos colores que en Promedios (`NotaFinal`). "Ver todo" → Promedios.
- **Celular:** una sola columna. Orden: Hoy, Próximas entregas, Calendario (vista de **un solo día**) y Promedios.
- **Estados vacíos** con botón: "No tienes nada para hoy 🎉" → Nuevo pendiente · "No tienes entregas pendientes 🎉" → Agregar una entrega · "Agrega tu primer curso" → Promedios.
- **Carga eficiente:** la página pide los datos una sola vez y los reparte a las tarjetas: `useTasks` (una consulta de pendientes), `useCursosConNotas` (una consulta de cursos con sus evaluaciones anidadas) y `useNombrePerfil`. Las tarjetas no consultan nada por su cuenta. (El modal del resumen del día hace su propia consulta, pero solo la primera vez de cada día.)
- Las funciones que preparan los datos viven en `src/lib/inicio.js`; las tarjetas, en `src/components/inicio/`.
- El calendario de Inicio usa solo datos de la app; la integración con Google Calendar es de la Fase 3.

---

## Modelo de datos inicial (fase 1)

- `profiles`: `id` (= auth.users.id), `nombre`, `ultimo_resumen` (date), `created_at`
- `courses`: `id`, `user_id`, `nombre`, `color`, `created_at`
- `tasks`: `id`, `user_id`, `course_id` (nullable), `titulo`, `descripcion`, `tipo`, `prioridad_base`, `fecha_entrega` (timestamptz, nullable), `fecha_actividad` (date, nullable), `hora_inicio` y `hora_fin` (time, nullable; solo actividades), `estado`, `justificacion`, `completed_at`, `google_event_id` (nullable), `created_at`
- `evaluations`: `id`, `user_id`, `course_id`, `parent_id` (nullable, apunta a `evaluations`), `nombre`, `peso` (numeric, % del curso entero), `nota` (numeric 0–20, nullable), `orden`, `reparto` ('manual' | 'iguales', default 'manual'), `descartar_peores` (int ≥ 0, default 0)

---

## Fases

- [ ] **Fase 1** (casi lista):
  - [x] Proyecto base, login/registro
  - [x] Pendientes (entregas y actividades)
  - [x] Checklist "Hoy" y resumen del día
  - [x] Promedios por curso
  - [x] Calendario de la app (pendientes) y página de Inicio
  - [x] PWA básica (`vite-plugin-pwa`; íconos en `public/`, aviso de actualización y pantalla sin conexión en `AvisoPWA.jsx`)
  - [ ] Despliegue en Vercel (confirmar)
- [ ] **Fase 2:** recordatorios
- [ ] **Fase 3:** Google Calendar y Google Drive
- [ ] **Fase 4:** IA (preguntas y lectura de sílabos)

Actualiza esta lista cuando terminemos cada fase.
