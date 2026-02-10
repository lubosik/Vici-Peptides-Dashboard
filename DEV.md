# Development server

## Quick start

```bash
npm run dev
```

Then open **http://localhost:3782** (or http://127.0.0.1:3782).

The dev server is configured to:

- Listen on **port 3782**
- Bind to **0.0.0.0** so you can use http://localhost:3782 or your machine’s IP
- Use extra Node memory (`--max-old-space-size=4096`) to reduce build crashes

## If the dev server won’t connect or exits right away

The app can hit a **SIGBUS** (or similar) during the first compile, so the dev server may exit before it’s ready. Try these in order:

1. **Run from the project root in a normal terminal**
   - From the project folder: `npm run dev`
   - Avoid running it from scripts or tools that close stdin; use a real terminal session.

2. **Clear cache and try again**
   ```bash
   npm run dev:clean
   ```
   (On Windows, run `rmdir /s /q .next` then `npm run dev`.)

3. **Full reinstall**
   ```bash
   rm -rf node_modules .next
   npm install
   npm run dev
   ```

4. **Try another Node version** (if you use nvm)
   - Node 20 can hit SIGBUS on some macOS setups.
   ```bash
   nvm install 18
   nvm use 18
   npm run dev
   ```

5. **Production build + start** (if `npm run build` works on your machine)
   ```bash
   npm run build
   npm run start
   ```
   Then open http://localhost:3782 (same port as dev).

## Scripts

| Script        | Description                                      |
|---------------|--------------------------------------------------|
| `npm run dev` | Start dev server on port 3782, host 0.0.0.0     |
| `npm run dev:clean` | Remove `.next` and start dev (Mac/Linux)   |
| `npm run build`     | Production build (worker disabled in config) |
| `npm run start`     | Run production server after build            |

## Config notes

- **next.config.js**: `experimental.webpackBuildWorker: false` is set to avoid build worker SIGBUS on some systems.
- **Port**: 3782 is used to avoid clashes with other apps; change it in the `dev` script in `package.json` if needed.
