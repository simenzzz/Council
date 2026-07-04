FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .

# Vite inlines import.meta.env.VITE_* into the JS bundle at build time, so
# this must be a browser-reachable address (the WS connection is made by the
# browser, not container-to-container) and must be set before `npm run build`.
ARG VITE_WS_URL=ws://localhost:8080/ws
ENV VITE_WS_URL=$VITE_WS_URL
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
