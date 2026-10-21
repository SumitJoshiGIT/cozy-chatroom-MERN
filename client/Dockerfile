FROM node:20-bookworm-slim AS build

WORKDIR /app

ARG VITE_API_ORIGIN=http://localhost:3000
ARG VITE_LIVEKIT_URL=
ARG VITE_DEMO_ENABLED=false
ENV VITE_API_ORIGIN=$VITE_API_ORIGIN
ENV VITE_LIVEKIT_URL=$VITE_LIVEKIT_URL
ENV VITE_DEMO_ENABLED=$VITE_DEMO_ENABLED

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
