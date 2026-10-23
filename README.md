# Plum! Tracker

App web para organizar la producción del PrePlum (25/10) y del Festival Plum! 2026 (20, 21 y 22 de noviembre, Tafí del Valle).

- **Resumen:** cuenta regresiva, avance por área, vencidas, próximos 7 días y próximas llegadas.
- **Tablero:** Pendiente / En curso / Bloqueada / Hecha, con arrastrar y soltar y filtros por área, evento y persona.
- **Cronograma:** Gantt con el PrePlum y el festival marcados.
- **Invitados:** ficha de cada invitado y grilla de quién está en Tafí cada día (presentes y quiénes duermen).

Cada cambio se ve en vivo para todo el equipo y queda registrado quién lo hizo. Se instala en el celular como una app.

Sin configurar Supabase, la app arranca en **modo demo**: funciona igual pero guarda solo en ese navegador.

## Puesta en marcha (una sola vez, unos 15 minutos)

### 1. Base de datos (Supabase, gratis)

1. Entrá a [supabase.com](https://supabase.com), creá una cuenta y un proyecto nuevo (región: São Paulo).
2. En el proyecto, andá a **SQL Editor → New query**, pegá todo el contenido de [`supabase/schema.sql`](supabase/schema.sql) y tocá **Run**.
3. Abrí otra query nueva, pegá [`supabase/seed.sql`](supabase/seed.sql) y tocá **Run**. Esto carga las 53 tareas iniciales.
4. En **Authentication → Sign In / Providers**, desactivá **Allow new users to sign up**. Así solo entra la gente que vos cargues.
5. En **Project Settings → API** copiá la **Project URL** y la **anon public key**. Las vas a usar en el paso 2.

### 2. Publicar la app (Vercel, gratis)

1. Entrá a [vercel.com](https://vercel.com) con tu cuenta de GitHub.
2. **Add New → Project** y elegí el repo `plum-tracker`.
3. En **Environment Variables** agregá:
   - `VITE_SUPABASE_URL` = la Project URL
   - `VITE_SUPABASE_ANON_KEY` = la anon public key
4. Tocá **Deploy**. Al terminar te da la dirección de la app (algo como `plum-tracker.vercel.app`). Desde **Settings → Domains** podés cambiarla o usar un dominio propio.

### 3. Sumar al equipo

En Supabase: **Authentication → Users → Add user → Create new user**. Poné el mail y una contraseña provisoria, y marcá **Auto Confirm User**. Pasale a esa persona la dirección de la app, su mail y la contraseña. Desde la app puede cambiarla con el botón **Contraseña**.

Para sacar a alguien, borralo desde la misma pantalla.

### 4. En el celular

Abrí la dirección de la app y elegí **Agregar a pantalla de inicio** (en iPhone, desde el botón Compartir de Safari). Queda con su ícono, como una app más.

## Desarrollo

```bash
npm install
cp .env.example .env   # completar con los datos de Supabase, o dejar sin crear para modo demo
npm run dev
```

Estructura:

- `index.html`: estructura de la pantalla y login.
- `src/main.js`: vistas (resumen, tablero, cronograma, invitados) y formularios.
- `src/store.js`: datos y sesión (Supabase, o modo demo con `localStorage`).
- `src/seed.json`: tareas iniciales para el modo demo.
- `supabase/schema.sql`: tablas, permisos y tiempo real. `supabase/seed.sql`: tareas iniciales.
