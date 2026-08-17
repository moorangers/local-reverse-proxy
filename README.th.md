# local-reverse-proxy

Reverse proxy สำหรับ map domain (เช่น `*.localtest.me`) ไปยัง target service ในเครื่อง พร้อม health check และรองรับ WebSocket

[English version](./README.md)

## Prerequisites

- Node.js 22+
- Yarn 4.17.1 (จัดการผ่าน Corepack)
- Docker (ถ้าจะรันผ่าน container)

## Project Structure

- `gateway.config.example.json` template config ที่ถูก version control
- `gateway.config.json` config จริงที่ service จะอ่าน (ไม่ถูก commit)
- `src/index.ts` ตัว gateway server

## Config Flow (สำคัญ)

โปรเจกต์นี้ใช้ `gateway.config.json` เป็นหลัก

ตอน pull repo มาใหม่:

- รัน `yarn setup:config` เพื่อสร้าง `gateway.config.json` จาก template
- หรือไม่ต้องรันก็ได้ เพราะตอน service start ถ้าไม่เจอไฟล์ จะสร้างให้อัตโนมัติ

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

ให้รันคำสั่งต่อไปนี้จากโฟลเดอร์ root ของ repository เท่านั้น และ `gateway.config.json` ต้องเป็นไฟล์ JSON ปกติ ไม่ใช่โฟลเดอร์

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

คำสั่งที่ใช้บ่อย:

- ดูสถานะ service: `docker compose ps`
- ดู log แบบต่อเนื่อง: `docker compose logs -f gateway`
- หยุด service: `docker compose down`

## ทางลัดสำหรับรันโดยไม่ต้องเปิด VS Code

สคริปต์หลักอยู่ที่ `./scripts/proxy.sh` และใช้ PM2 เพื่อให้ service อยู่เป็น background process

ครั้งแรกในเครื่อง:

```bash
npm i -g pm2
./scripts/proxy.sh setup
./scripts/proxy.sh startup
```

ถ้า `pm2 startup` แสดงคำสั่ง `sudo env ...` ให้รันคำสั่งนั้นหนึ่งครั้ง แล้วรัน `pm2 save`

หลัง restart เครื่อง:

```bash
./scripts/proxy.sh status
./scripts/proxy.sh start
```

ถ้าตั้ง `startup` สำเร็จ โดยปกติ service จะกลับมาเองหลัง login/reboot แค่ใช้ `status` เช็กได้เลย

บน macOS สามารถ double-click `start-proxy.command` จาก Finder ได้ด้วย ถ้าอยาก start/reload แบบไม่พิมพ์ command

คำสั่งที่ใช้บ่อย:

```bash
./scripts/proxy.sh restart
./scripts/proxy.sh logs
./scripts/proxy.sh health
./scripts/proxy.sh stop
```

ถ้าชอบใช้ผ่าน Yarn:

```bash
yarn proxy:start
yarn proxy:restart
yarn proxy:status
yarn proxy:logs
```

## Config Example

แก้ไฟล์ `gateway.config.json` ให้เป็นรูปแบบนี้:

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

- `healthCheckEnabled` (optional): default เป็น `false`
- ถ้าต้องการเปิด health check ให้ route ที่พร้อม ให้ตั้งเป็น `true`

## เพิ่ม Route ภายหลัง

หลังแก้ `gateway.config.json` แล้ว ให้ restart service เพื่อ reload config:

```bash
docker compose restart gateway
```

ถ้าแก้โค้ด/แก้ dependency (ไม่ใช่แค่ config) ให้ rebuild ด้วย:

```bash
docker compose up -d --build
```

## ใช้งานในทีมโดยไม่ต้องเปิด VS Code

ในเครื่องที่เปิด Docker daemon ไม่ได้ (ติด policy) ให้ใช้ Node + PM2 เป็นมาตรฐานทีม

### One-time Setup (ครั้งแรกในเครื่อง)

```bash
yarn install
yarn setup:config
yarn build
npm i -g pm2
pm2 start dist/index.js --name local-reverse-proxy
pm2 startup
# รันคำสั่งที่ PM2 แสดงกลับมา (มักต้องใช้สิทธิ์ admin/sudo) แล้วค่อย save
pm2 save
```

### Daily Ops (เปิดงานประจำวัน)

```bash
pm2 status
pm2 logs local-reverse-proxy
```

- ถ้า `status` เป็น `online` แปลว่าใช้งานได้
- หลัง reboot เครื่อง PM2 จะพยายาม restore process ให้อัตโนมัติ (ถ้าทำ `pm2 startup` + `pm2 save` แล้ว)

### Update Config (เพิ่ม/แก้ route)

1. แก้ไฟล์ `gateway.config.json`
2. restart เพื่อ reload config

```bash
pm2 restart local-reverse-proxy
pm2 logs local-reverse-proxy
```

หมายเหตุ: service อ่าน config ตอน start จึงต้อง restart ทุกครั้งหลังแก้ config

### Update Code (แก้ source/dependency)

```bash
yarn install
yarn build
pm2 restart local-reverse-proxy
pm2 logs local-reverse-proxy
```

### Health Check หลัง deploy/restart

```bash
curl -i http://127.0.0.1:18080/__routes
```

- ต้องได้ `HTTP 200`
- response ควรเห็น routes ล่าสุดที่เพิ่งแก้

### Admin UI

ถ้าอยากดู status และ config แบบหน้าเว็บ:

- เปิด `http://127.0.0.1:18080/__admin`
- หน้าเว็บจะแสดง proxy online status, route status, active connections, recent logs และ config snapshot
- หน้าเว็บนี้เป็นแบบ monitor/read-only สำหรับส่วน manage service ให้ใช้ command snippet ที่หน้าเว็บแสดง แล้วสั่งเองใน terminal
- ถ้าจะแก้ config ให้แก้ไฟล์ `gateway.config.json` โดยตรง แล้วค่อย `./scripts/proxy.sh restart`

### Useful Commands

```bash
pm2 status
pm2 logs local-reverse-proxy
pm2 restart local-reverse-proxy
pm2 stop local-reverse-proxy
pm2 delete local-reverse-proxy
pm2 save
```

### คำสั่งเช็คพอร์ต

เช็คว่า port `18080` มี process ไหนกำลังฟังอยู่:

```bash
lsof -nP -iTCP:18080 -sTCP:LISTEN
```

เช็คทุก TCP port ที่กำลัง LISTEN:

```bash
lsof -nP -iTCP -sTCP:LISTEN
```

เช็คเร็วๆ ว่า port เปิดและเข้าถึงได้ไหม:

```bash
nc -zv 127.0.0.1 18080
```

ถ้ามี process อื่นชนพอร์ต ให้ปิดด้วย PID:

```bash
kill <PID>
# ถ้ายังไม่ลงค่อยใช้
kill -9 <PID>
```

### Troubleshooting สั้นๆ

- พอร์ตชน: ตรวจ process อื่นที่ใช้ `18080` ก่อน start/restart
- เจอ `(node) [DEP0060]` warning: เป็น warning จาก dependency `http-proxy` บน Node ใหม่ แอปยังรันได้
- แก้ config แล้วไม่เปลี่ยน: มักลืม `pm2 restart local-reverse-proxy`
