FROM node:22-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules /app/node_modules
COPY . .
RUN node ace build

FROM base AS production-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

FROM base
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8888
RUN apk add --no-cache curl
WORKDIR /app
COPY --from=production-deps /app/node_modules /app/node_modules
COPY --from=build /app/build /app
COPY swagger.yml /app/swagger.yml
EXPOSE 8888
CMD ["node", "./bin/server.js"]
