FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package*.json ./
COPY packages/dashboard/package*.json packages/dashboard/
RUN npm ci --workspace=packages/dashboard

FROM base AS builder
COPY --from=deps /app/packages/dashboard/node_modules ./node_modules
COPY packages/dashboard ./packages/dashboard
WORKDIR /app/packages/dashboard
RUN npm run build

FROM nginx:alpine AS runner
COPY --from=builder /app/packages/dashboard/dist /usr/share/nginx/html
COPY packages/dashboard/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 3000
