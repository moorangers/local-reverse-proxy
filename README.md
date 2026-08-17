# local-reverse-proxy

Reverse proxy for mapping domains (for example, `*.localtest.me`) to local target services, with health checks and WebSocket support.

[เวอร์ชันภาษาไทย](./README.th.md)

## Prerequisites

- Node.js 22+
- Yarn 4.17.1 (managed through Corepack)
- Docker (if you want to run in a container)

## Project Structure

- `gateway.config.example.json`: Version-controlled config template
- `gateway.config.json`: Runtime config read by the service (not committed)
- `src/index.ts`: Gateway server

## Config Flow (Important)

This project uses `gateway.config.json` as the primary config file.

When you pull the repo for the first time:

- Run `yarn setup:config` to create `gateway.config.json` from the template
- Or skip it, because the service auto-generates the file on startup if it does not exist

## Run (Local)

```bash
corepack enable
yarn install --immutable
yarn setup:config
yarn typecheck
yarn build
yarn start
```

### Build Image

```bash
docker build -t local-reverse-proxy:latest .
```

### Run Container

Run these commands from the repository root. `gateway.config.json` must be a regular file containing valid JSON; do not run the command from a directory that has a folder with that name.

```bash
corepack enable
yarn setup:config
docker build -t local-reverse-proxy:latest .

docker run --rm --name local-reverse-proxy \
  -p 18080:18080 \
  -v "$PWD/gateway.config.json:/app/gateway.config.json:ro" \
  local-reverse-proxy:latest
```

## Docker Compose

```bash
docker compose up --build -d
```

Common commands:

- Check service status: `docker compose ps`
- Follow logs: `docker compose logs -f gateway`
- Stop services: `docker compose down`

## Quick Run Without VS Code

The main helper script is `./scripts/proxy.sh`. It uses PM2 so the gateway can run as a background process.

First time on a machine:

```bash
npm i -g pm2
./scripts/proxy.sh setup
./scripts/proxy.sh startup
```

If `pm2 startup` prints a `sudo env ...` command, run that command once, then run `pm2 save`.

After restarting your computer:

```bash
./scripts/proxy.sh status
./scripts/proxy.sh start
```

If startup is configured successfully, the service should usually come back automatically after login/reboot, so `status` is enough to check it.

On macOS, you can also double-click `start-proxy.command` from Finder to start/reload without typing a command.

Common helper commands:

```bash
./scripts/proxy.sh restart
./scripts/proxy.sh logs
./scripts/proxy.sh health
./scripts/proxy.sh stop
```

If you prefer Yarn scripts:

```bash
yarn proxy:start
yarn proxy:restart
yarn proxy:status
yarn proxy:logs
```

## Config Example

Update `gateway.config.json` to this format:

```json
{
  "listenPort": 18080,
  "healthCheckIntervalMs": 60000,
  "routes": [
    {
      "domain": "oms.localtest.me",
      "target": "http://127.0.0.1:3002",
      "healthCheckEnabled": false,
      "websocket": true
    }
  ]
}
```

- `healthCheckEnabled` (optional): defaults to `false`
- Set it to `true` if you want to enable health checks for a ready route

## Add Routes Later

After editing `gateway.config.json`, restart the service to reload config:

```bash
docker compose restart gateway
```

If you changed code or dependencies (not only config), rebuild as well:

```bash
docker compose up -d --build
```

## Team Usage Without VS Code

On machines where Docker daemon cannot be enabled (policy restrictions), use Node + PM2 as the team standard.

### One-time Setup (First Time on a Machine)

```bash
yarn install
yarn setup:config
yarn build
npm i -g pm2
pm2 start dist/index.js --name local-reverse-proxy
pm2 startup
# Run the command that PM2 prints (usually requires admin/sudo), then save
pm2 save
```

### Daily Ops

```bash
pm2 status
pm2 logs local-reverse-proxy
```

- If `status` is `online`, the service is running
- After reboot, PM2 will try to restore the process automatically (if `pm2 startup` + `pm2 save` were done)

### Update Config (Add/Edit Routes)

1. Edit `gateway.config.json`
2. Restart to reload config

```bash
pm2 restart local-reverse-proxy
pm2 logs local-reverse-proxy
```

Note: The service reads config at startup, so you must restart every time config changes.

### Update Code (Source/Dependency Changes)

```bash
yarn install
yarn build
pm2 restart local-reverse-proxy
pm2 logs local-reverse-proxy
```

### Health Check After Deploy/Restart

```bash
curl -i http://127.0.0.1:18080/__routes
```

- Must return `HTTP 200`
- Response should include the latest routes you changed

### Useful Commands

```bash
pm2 status
pm2 logs local-reverse-proxy
pm2 restart local-reverse-proxy
pm2 stop local-reverse-proxy
pm2 delete local-reverse-proxy
pm2 save
```

### Port Check Commands

Check which process is listening on port `18080`:

```bash
lsof -nP -iTCP:18080 -sTCP:LISTEN
```

Check all listening TCP ports:

```bash
lsof -nP -iTCP -sTCP:LISTEN
```

Quickly verify whether the port is reachable:

```bash
nc -zv 127.0.0.1 18080
```

If a process is blocking the port, stop it by PID:

```bash
kill <PID>
# if needed
kill -9 <PID>
```

### Quick Troubleshooting

- Port conflict: check for another process using `18080` before start/restart
- `(node) [DEP0060]` warning: this comes from `http-proxy` dependency on newer Node versions; app still runs
- Config changed but not applied: usually forgot `pm2 restart local-reverse-proxy`
