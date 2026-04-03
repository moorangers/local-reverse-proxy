FROM node:24-bookworm-slim AS base

FROM base AS deps
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json tsconfig.json ./
COPY src ./src
RUN yarn build

FROM base AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production=true \
    && yarn cache clean

COPY --from=builder /app/dist ./dist
COPY gateway.config.example.json ./gateway.config.example.json

USER node
EXPOSE 18080

CMD ["node", "dist/index.js"]