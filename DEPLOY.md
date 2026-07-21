# Deploying SERVIO Kargo (first time, step by step)

You need a domain and a bank card (~30 min). Replace `kargo.servio.uz` below with your own domain everywhere.

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
database or uploaded photos.

## 9. Turn on nightly backups
Run `crontab -e` and add (nightly at 03:00, keeps 14 days in `/var/backups/kargotrack`):
```
0 3 * * * /root/kargotrack/scripts/backup.sh >> /var/log/kargotrack-backup.log 2>&1
```
