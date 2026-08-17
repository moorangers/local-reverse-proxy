FROM node:24-bookworm-slim AS base
RUN corepack enable

FROM base AS deps
WORKDIR /app
COPY package.json yarn.lock .yarnrc.yml ./
RUN yarn install --immutable

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json yarn.lock .yarnrc.yml tsconfig.json ./
COPY src ./src
RUN yarn build

FROM base AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package.json yarn.lock .yarnrc.yml ./
RUN yarn workspaces focus --all --production \
    && yarn cache clean --all

COPY --from=builder /app/dist ./dist
COPY gateway.config.example.json ./gateway.config.example.json

USER node
EXPOSE 18080

CMD ["node", "dist/index.js"]
