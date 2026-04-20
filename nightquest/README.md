# NightQuest

Monorepo TypeScript per NightQuest: frontend utente mobile-first, pannello admin e backend Express/Prisma.

## Stack

- `apps/web`: React + Vite + Tailwind
- `apps/admin`: React + Vite + Tailwind
- `server`: Express + Prisma + SQLite
- `packages/shared`: schemi Zod e tipi condivisi

## Setup

1. Installa dipendenze:

```bash
npm install
```

2. Configura le variabili d'ambiente:

`server/.env`

```env
DATABASE_URL="file:./dev.db"
OPENAI_API_KEY="sk-..."
JWT_SECRET="super-secret"
ADMIN_BOOTSTRAP_EMAIL="admin@nightquest.it"
ADMIN_BOOTSTRAP_PASSWORD="admin"
PORT=3001
```

`apps/web/.env`

```env
VITE_API_BASE_URL="http://localhost:3001"
```

`apps/admin/.env`

```env
VITE_API_BASE_URL="http://localhost:3001"
```

3. Genera il client Prisma, prepara lo schema SQLite di sviluppo e lancia il seed:

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
```

4. Avvia tutto:

```bash
npm run dev
```

## URL locali

- Web utente: `http://localhost:5173`
- Admin: `http://localhost:5174`
- Backend: `http://localhost:3001`

## Credenziali admin bootstrap

Alla prima partenza del server, se non esiste alcun admin, viene creato un utente bootstrap con email `ADMIN_BOOTSTRAP_EMAIL` e password `ADMIN_BOOTSTRAP_PASSWORD`. Se esiste gia almeno un admin, il bootstrap non crea nulla.

## Flussi disponibili

- Utente: scelta citta > alias > 5 missioni > finale
- Admin: login > dashboard > CRUD base citta/luoghi/toni/missioni/checkpoint > editor prompt globale > telemetria sessioni

## Note

- Il Narrator usa solo `gpt-4o-mini`.
- Se `OPENAI_API_KEY` non e configurata o la chiamata fallisce, il backend usa fallback deterministici.
- Tutti i testi dell'interfaccia sono in italiano.
- In sviluppo `db:migrate` inizializza lo schema SQLite locale tramite bootstrap script e poi Prisma client opera sul database seedato.

## Deploy con Docker + Caddy

Questo repository include ora uno stack Docker con:

- `api`: backend Express/Prisma
- `caddy`: reverse proxy HTTPS automatico e static hosting per `web` e `admin`

### Perche Caddy qui

Per questo progetto Caddy e preferibile a Nginx se vuoi il deploy piu semplice possibile su Lightsail:

- TLS automatico con Let's Encrypt
- configurazione piu corta
- gestione semplice di `nightquest`, `admin`, `api` su domini separati

Nginx resta valido se vuoi piu controllo fine, ma per questo stack non ti serve.

### 1. Prepara il file env di deploy

Copia `.env.docker.example` in `.env` alla root del monorepo e imposta i domini reali:

```bash
cp .env.docker.example .env
```

Valori richiesti:

- `WEB_DOMAIN`
- `ADMIN_DOMAIN`
- `API_DOMAIN`
- `ACME_EMAIL`
- `JWT_SECRET`
- `ADMIN_BOOTSTRAP_PASSWORD`

### 2. Primo bootstrap database

Attenzione: in questo repo `npm run prisma:migrate` esegue `server/prisma/bootstrap_sqlite.py` e ricrea il database da zero.
Usalo solo al primo deploy o quando vuoi esplicitamente azzerare i dati.

Primo bootstrap:

```bash
docker compose build
docker compose run --rm --profile init api-init
```

### 3. Avvio stack

```bash
docker compose up -d
```

### 4. Aggiornamenti futuri

```bash
git pull
docker compose build
docker compose up -d
```

Se cambi solo il codice applicativo non devi rilanciare `api-init`.

### 5. Persistenza dati

SQLite vive nel volume Docker `nightquest_data` montato in `/app/server/data`.
Il valore di default e:

```env
DATABASE_URL=file:./data/prod.db
```

### 6. Porte e DNS

Su Lightsail apri:

- `22`
- `80`
- `443`

Punta i record DNS dei tre domini all'IP statico della VPS.
