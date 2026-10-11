FROM node:24-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json tsconfig.playground.package.json vite.config.ts ./
COPY src ./src
COPY playground ./playground

RUN npm run build:playground:package

FROM nginx:1.29-alpine

COPY playground/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/playground-dist /usr/share/nginx/html

EXPOSE 80
