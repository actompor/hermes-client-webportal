# syntax=docker/dockerfile:1

FROM node:22-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM node:22-alpine AS backend-build
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci
COPY backend/ ./
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8787
ENV STATIC_DIR=/app/public
ENV LOG_DIR=/app/logs

RUN addgroup -S portal && adduser -S portal -G portal \
  && mkdir -p /app/logs /app/data \
  && chown -R portal:portal /app/logs /app/data

COPY --from=backend-build /app/backend/package.json ./
COPY --from=backend-build /app/backend/node_modules ./node_modules
COPY --from=backend-build /app/backend/dist ./dist
COPY --from=frontend-build /app/frontend/dist ./public

USER portal
EXPOSE 8787
CMD ["node", "dist/index.js"]
