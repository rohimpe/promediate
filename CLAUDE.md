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
- Botón "Agregar curso". Cada curso tiene un **árbol de evaluaciones**: cada nodo tiene nombre y peso (%), y puede tener hijos o ser una hoja con nota.
  - Ej.: Examen final 30% · Evaluación continua 70% → (PCs 40% · Tareas 30% · Proyecto 30%), y PCs → PC1 25%, PC2 25%…
- Se pueden agregar, editar, anidar y borrar nodos.
- Validación: los pesos de los hijos de cada nodo deben sumar 100% (mostrar aviso si no).
- Escala vigesimal (0–20). Mostrar:
  - **Promedio actual:** solo con notas ingresadas, normalizando los pesos de lo ya evaluado.
  - **Puntos acumulados:** aporte real hacia la nota final.
  - Extra: "nota mínima que necesitas en lo que falta para aprobar".
- Promedio < 10.5 se muestra en **rojo** (desaprobado).
- En el Inicio se ven solo los promedios de cada curso.
- Fase 4: subir el sílabo en PDF y que la IA proponga el árbol; el usuario lo revisa antes de guardar.

### 6. Calendario (fase 3)
- Leer eventos de Google Calendar del usuario y mostrarlos con el diseño de la app (vista semanal tipo horario).
- Mostrar los pendientes de la app (entregas y actividades) y su estado (completada / pendiente).

### 7. Archivos (fase 3)
- Sección de carpetas (una por curso). Los archivos adjuntos se suben al Google Drive del usuario usando el permiso `drive.file`.

### 8. Recordatorios (fase 2)
- Solo el día de entrega: cada 4 horas, y durante la última hora cada 15 minutos.
- Proceso con `pg_cron` cada 15 minutos que llama a una Edge Function y revisa qué toca enviar. Canal por definir (correo, push o Telegram).

### 9. IA (fase 4)
- El usuario elige su proveedor y guarda su propia API key (cifrada, solo usada desde Edge Functions).
- Preguntas como "¿qué tengo el jueves?" usando sus pendientes como contexto.

### 10. Página de Inicio (al final de la Fase 1)
Se construye cuando ya existan pendientes, checklist y promedios, porque junta datos de todos. Es la página `/`.
- **Distribución en pantallas grandes:** dos columnas.
  - **Izquierda:** calendario grande (vista mensual) que marca los días con pendientes; las entregas/actividades completadas se ven marcadas. Al elegir un día se ven sus pendientes.
  - **Derecha:** tres tarjetas **apiladas**, cada una con un enlace **"Ver todo"**:
    1. **Hoy:** los pendientes de hoy (hora de Lima) ordenados por prioridad calculada. "Ver todo" → Hoy.
    2. **Próximas entregas:** las siguientes entregas pendientes por fecha límite. "Ver todo" → Pendientes.
    3. **Promedios:** el promedio actual de cada curso (en rojo si es < 10.5). "Ver todo" → Promedios.
- **En celular:** todo se apila en una sola columna. Orden: Hoy, Próximas entregas, Promedios y, al final, el calendario.
- El calendario de Inicio usa solo datos de la app; la integración con Google Calendar es de la Fase 3.

---

## Modelo de datos inicial (fase 1)

- `profiles`: `id` (= auth.users.id), `nombre`, `ultimo_resumen` (date), `created_at`
- `courses`: `id`, `user_id`, `nombre`, `color`, `created_at`
- `tasks`: `id`, `user_id`, `course_id` (nullable), `titulo`, `descripcion`, `tipo`, `prioridad_base`, `fecha_entrega` (timestamptz, nullable), `fecha_actividad` (date, nullable), `hora_inicio` y `hora_fin` (time, nullable; solo actividades), `estado`, `justificacion`, `completed_at`, `google_event_id` (nullable), `created_at`
- `evaluations`: `id`, `user_id`, `course_id`, `parent_id` (nullable, apunta a `evaluations`), `nombre`, `peso` (numeric), `nota` (numeric 0–20, nullable), `orden`

---

## Fases

- [ ] **Fase 1:** proyecto base, login/registro, tareas, checklist, resumen del día, promedios, PWA básica, despliegue en Vercel
- [ ] **Fase 2:** recordatorios
- [ ] **Fase 3:** Google Calendar y Google Drive
- [ ] **Fase 4:** IA (preguntas y lectura de sílabos)

Actualiza esta lista cuando terminemos cada fase.
