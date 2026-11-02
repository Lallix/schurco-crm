# Schurco CRM

Customer relationship manager for Schurco: clients, contacts, opportunities, contracts and activities, with OMNI orders and ageing.

- **Work / personal:** Work (Schurco Slurry)
- **Port:** 8093 (set in `vite.config.ts`, strict)
- **Start:** `npm run dev -- --port 8093 --strictPort` (or the `schurco-crm` entry in `.claude\launch.json`), then open http://localhost:8093/schurco-crm/
- **GitHub:** https://github.com/Lallix/schurco-crm (public — deployed to GitHub Pages by `.github\workflows\deploy.yml`; never commit secrets)
- **Stack:** React 19 + TypeScript + Vite, Supabase (database, auth, edge functions in `supabase\functions\`, migrations in `supabase\migrations\`)
- **Non-code files:** `_files\` (create `docs\`, `data\`, `design\`, `archive\` as needed). Synced by OneDrive, gitignored.

## Rules
- Only work inside this folder. Never start another app's server.
- Use relative paths only. This folder is opened on two PCs with different Windows usernames (`GideonV` and `lalli`).
- The repo is public: `.env` stays local; only the Supabase anon/publishable key may appear in front-end code.
