# Deploying SERVIO Kargo (first time, step by step)

You need a domain and a bank card (~30 min). Replace `kargo.servio.uz` below with your own domain everywhere.

Sections 1–9 get the site running by hand. Section 10 wires up GitHub Actions so
every push to `main` deploys itself — do that once the manual deploy works.

## 1. Buy a server (VPS)

- Sign up at any VPS provider (Hetzner, DigitalOcean, Contabo).
- Create a server: **Ubuntu 24.04**, 2 vCPU / 4 GB RAM.
- Note its **IP address** and how to log in (root password or SSH key).

## 2. Point your domain at the server

In your domain's DNS settings add two **A records**, both to your server IP:
`kargo.servio.uz` and `bot.kargo.servio.uz`. Wait ~10 minutes for DNS to spread.

## 3. Log in and install Docker

`ssh root@YOUR_SERVER_IP`, then:

```
curl -fsSL https://get.docker.com | sh
docker compose version    # should print a version
```

## 4. Get the code

```
git clone YOUR_REPO_URL kargotrack && cd kargotrack
```

## 5. Configure secrets

```
cp .env.example .env && nano .env
```

Fill in `DOMAIN`, `ACME_EMAIL`, `POSTGRES_PASSWORD`, `SESSION_SECRET`,
`SUPERADMIN_TOKEN`, and set `DATABASE_URL` to use the same password. Set
`WEBHOOK_BASE_URL=https://bot.<your-domain>`. For a random secret run
`openssl rand -base64 32`. Save with Ctrl+O, exit with Ctrl+X.

Leave the `IMAGE_TAG` / `WEB_IMAGE` / `BOT_IMAGE` lines commented out unless you
forked the repo — see §10.6.

## 6. First run

```
chmod +x deploy.sh scripts/backup.sh
./deploy.sh
```

This builds everything, creates the database tables, and starts the site.
Open `https://kargo.servio.uz` — HTTPS turns on by itself within a minute. Add
your first company at `https://kargo.servio.uz/sa` (use your `SUPERADMIN_TOKEN`).

## 7. Check the logs

```
docker compose -f docker-compose.prod.yml ps        # all containers up?
docker compose -f docker-compose.prod.yml logs -f web    # or: bot
```

Press Ctrl+C to stop watching.

## 8. Update later (new code)

`cd kargotrack && ./deploy.sh` — your data is safe; deploy never deletes the
database or uploaded photos. Once §10 is set up you will rarely need this.

## 9. Turn on nightly backups

Run `crontab -e` and add (nightly at 03:00, keeps 14 days in `/var/backups/kargotrack`):

```
0 3 * * * /root/kargotrack/scripts/backup.sh >> /var/log/kargotrack-backup.log 2>&1
```

> **One-time after the F3 release (webhook secret):** every tenant's webhook
> must be re-pointed at the new `/webhook/t/<tenantId>` URL with its secret.
> Open `/sa` and press the **Webhook** button on each tenant row (new tenants
> get it automatically at onboarding). Until then the old token-in-path URL
> keeps working but logs a warning on every update. Do the re-set at a quiet
> hour: `setWebhook` drops pending updates, so in-flight customer messages
> at that moment are discarded.

Each run produces TWO files: `kargotrack_<stamp>.sql.gz` (the database) and
`uploads_<stamp>.tar.gz` (warehouse photos — the evidence in every damage
dispute, tasks.md F4). Copy both off the VPS periodically; a backup on the
same disk as the data survives a bad deploy, not a dead server.

### 9.1 Restore procedure (rehearse this once BEFORE you need it)

Database — into the running postgres container:

```bash
gunzip -c /var/backups/kargotrack/kargotrack_<stamp>.sql.gz \
  | docker exec -i -e PGPASSWORD="$POSTGRES_PASSWORD" serviokargo-postgres \
      psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
```

(For a truly fresh start, drop and recreate the database first — the dump is
`--no-owner` plain SQL and re-creates every table it contains.)

Uploads — back into the shared volume via the bot container:

```bash
gunzip -c /var/backups/kargotrack/uploads_<stamp>.tar.gz \
  | docker cp - serviokargo-bot:/data/
```

The archive contains the `uploads/` directory itself, so extracting into
`/data/` restores `/data/uploads/...`. Verify with:
`docker exec serviokargo-bot ls /data/uploads`.

---

## 10. Automatic deploys with GitHub Actions

### 10.1 What runs when

| Workflow                        | Trigger                                        | What it does                                                                                                                 |
| ------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `.github/workflows/ci.yml`      | every pull request; called by `deploy.yml`      | `pnpm typecheck`, `pnpm lint` (`pnpm test` is part of the local definition of done and not yet a CI gate)                     |
| `.github/workflows/deploy.yml`  | push to `main`; manual run from the Actions tab | **verify** (reuses `ci.yml`) → **build** web + bot images and push to GHCR → **deploy**: SSH to the VPS, which pulls, migrates and restarts |

A failure at any stage stops the ones after it, so a type error, a lint error
or a broken `Dockerfile` never reaches the server. Deploys run one at a time
(`concurrency: deploy-production`) and queue rather than cancel, because a
half-applied migration is worse than a slow deploy.

The images are built on GitHub's runners, **not on your VPS** — a Next.js build
does not fit comfortably in 2 vCPU / 4 GB while the site is serving traffic. The
VPS only pulls a finished image.

`pnpm format:check` is not a gate: Prettier was added late and most of the repo
still fails it. Run `pnpm format` once and add it to `ci.yml` if you want it.

### 10.2 Create a deploy user and SSH key

On your **laptop**, make a key pair used only by CI (no passphrase — CI cannot type one):

```
ssh-keygen -t ed25519 -f ~/.ssh/kargotrack_deploy -C "github-actions" -N ""
```

On the **VPS**, authorise the public half for the user that owns the checkout
(root works; a dedicated user must be in the `docker` group):

```
cat >> ~/.ssh/authorized_keys       # paste the contents of kargotrack_deploy.pub, then Ctrl+D
```

Back on your laptop, capture the server's host key so CI can pin it:

```
ssh-keyscan -p 22 YOUR_SERVER_IP
```

### 10.3 Add the repository secrets

GitHub → your repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret            | Value                                                                | Required |
| ----------------- | -------------------------------------------------------------------- | -------- |
| `VPS_HOST`        | server IP or hostname                                                 | yes      |
| `VPS_USER`        | SSH user that owns the checkout, e.g. `root`                          | yes      |
| `VPS_SSH_KEY`     | full contents of the **private** key `~/.ssh/kargotrack_deploy`       | yes      |
| `VPS_KNOWN_HOSTS` | full output of the `ssh-keyscan` above                                | yes      |
| `VPS_PORT`        | SSH port, if not `22`                                                 | no       |
| `VPS_APP_DIR`     | checkout path, if not `/root/kargotrack`                              | no       |

No registry credentials are needed: the workflow logs in to GHCR with the
run-scoped `GITHUB_TOKEN` and logs out again when the script finishes, so no
long-lived token is ever stored on the VPS.

### 10.4 Optional: require an approval

The deploy job targets an `environment: production`. Create it under
**Settings → Environments → New environment → `production`** to add required
reviewers or restrict deploys to `main`. If you skip this, the environment is
created implicitly and deploys run unattended.

### 10.5 Make the VPS checkout deployable

The deploy script fast-forwards the checkout to the exact commit CI built, so:

- The server must be able to `git fetch origin` unattended. A public repo over
  HTTPS just works; for a private repo add a **read-only deploy key** to the
  repo (Settings → Deploy keys) and clone over SSH.
- The checkout must be on a branch that tracks `origin/main` with **no local
  commits or edits** — `git merge --ff-only` refuses to clobber them. Check with
  `git status` and `git stash` anything you edited on the server.

### 10.6 If you forked the repo

`docker-compose.prod.yml` defaults to `ghcr.io/oyatillo12/servio-kargo-{web,bot}`.
The workflow pushes to `ghcr.io/<your-owner>/<your-repo>-{web,bot}` instead, so
add both to the VPS `.env` (lowercase — GHCR rejects capitals):

```
WEB_IMAGE=ghcr.io/<owner>/<repo>-web
BOT_IMAGE=ghcr.io/<owner>/<repo>-bot
```

### 10.7 Try it

Push to `main`, or open **Actions → Deploy → Run workflow** and pick a branch or
tag. Watch the three jobs. The deploy job ends with `docker compose ps`, and it
fails the run if `web` or `bot` does not reach `healthy` within 180 s — a green
check means the site actually came back up, not just that the containers started.

### 10.8 Rolling back

Every deploy leaves the previous images on the VPS (pruned after 7 days), so a
rollback is local and takes seconds:

```
cd kargotrack
IMAGE_TAG=<older-commit-sha> ./deploy.sh --pull
```

To roll back permanently, revert the commit on `main` and let the workflow
deploy the revert. Note that **migrations are not rolled back** — if the bad
release changed the schema, restore from `scripts/backup.sh` instead.

### 10.9 Deploying by hand still works

`./deploy.sh` (no flag) builds the images on the server exactly as before —
useful if GitHub is down or you are testing an unpushed change. `--pull` is the
only thing CI adds; every other step (fast-forward, wait for Postgres, migrate,
restart, health-gate, prune) is shared by both paths.
