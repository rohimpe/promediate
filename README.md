# Tablero de Vida (promediate)

App web para organizar la vida universitaria: tareas, checklist diario, calendario, archivos y promedios por curso.

## Stack

- **Frontend:** React + Vite, React Router, Tailwind CSS
- **Backend:** Supabase (Auth, Postgres, Storage, Edge Functions)
- **Hosting:** Vercel

## Correr en local

Requisitos: [Node.js](https://nodejs.org/) LTS y un proyecto en [Supabase](https://supabase.com/).

```bash
npm install
cp .env.example .env.local   # luego completa las claves de Supabase
npm run dev
```

La app queda en http://localhost:5173.

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo con recarga automática |
| `npm run build` | Genera la versión de producción en `dist/` |
| `npm run preview` | Sirve `dist/` para probar el build |
| `npm run lint` | Revisa el código con oxlint |
