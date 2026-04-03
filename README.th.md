# local-reverse-proxy

Reverse proxy สำหรับ map domain (เช่น `*.localtest.me`) ไปยัง target service ในเครื่อง พร้อม health check และรองรับ WebSocket

[English version](./README.md)

## Prerequisites

- Node.js 22+
- Yarn 1.x
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
yarn install
yarn setup:config
yarn typecheck
yarn build
yarn start
```

### Build Image

```bash
docker build -t local-tunnel-gateway:latest .
```

### Run Container

```bash
docker run --rm \
  -p 18080:18080 \
  -v "$(pwd)/gateway.config.json:/app/gateway.config.json:rw" \
  local-tunnel-gateway:latest
```

## Docker Compose

```bash
docker compose up --build -d
```

คำสั่งที่ใช้บ่อย:

- ดูสถานะ service: `docker compose ps`
- ดู log แบบต่อเนื่อง: `docker compose logs -f gateway`
- หยุด service: `docker compose down`

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
pm2 start dist/index.js --name local-tunnel-gateway
pm2 startup
# รันคำสั่งที่ PM2 แสดงกลับมา (มักต้องใช้สิทธิ์ admin/sudo) แล้วค่อย save
pm2 save
```

### Daily Ops (เปิดงานประจำวัน)

```bash
pm2 status
pm2 logs local-tunnel-gateway
```

- ถ้า `status` เป็น `online` แปลว่าใช้งานได้
- หลัง reboot เครื่อง PM2 จะพยายาม restore process ให้อัตโนมัติ (ถ้าทำ `pm2 startup` + `pm2 save` แล้ว)

### Update Config (เพิ่ม/แก้ route)

1. แก้ไฟล์ `gateway.config.json`
2. restart เพื่อ reload config

```bash
pm2 restart local-tunnel-gateway
pm2 logs local-tunnel-gateway
```

หมายเหตุ: service อ่าน config ตอน start จึงต้อง restart ทุกครั้งหลังแก้ config

### Update Code (แก้ source/dependency)

```bash
yarn install
yarn build
pm2 restart local-tunnel-gateway
pm2 logs local-tunnel-gateway
```

### Health Check หลัง deploy/restart

```bash
curl -i http://127.0.0.1:18080/__routes
```

- ต้องได้ `HTTP 200`
- response ควรเห็น routes ล่าสุดที่เพิ่งแก้

### Useful Commands

```bash
pm2 status
pm2 logs local-tunnel-gateway
pm2 restart local-tunnel-gateway
pm2 stop local-tunnel-gateway
pm2 delete local-tunnel-gateway
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
- แก้ config แล้วไม่เปลี่ยน: มักลืม `pm2 restart local-tunnel-gateway`
