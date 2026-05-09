FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package*.json ./
COPY packages/backend/package*.json packages/backend/
RUN npm ci --workspace=packages/backend

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/backend/node_modules ./packages/backend/node_modules
COPY packages/backend ./packages/backend
COPY tsconfig*.json ./
WORKDIR /app/packages/backend
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY --from=builder /app/packages/backend/dist ./dist
COPY --from=deps /app/packages/backend/node_modules ./node_modules
EXPOSE 10000 10001
CMD ["node", "dist/index.js"]
