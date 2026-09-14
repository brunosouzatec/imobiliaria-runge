FROM node:24-bookworm-slim

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV DB_PATH=/data/imoveis.db

COPY package*.json ./
RUN npm install --omit=dev --ignore-scripts

COPY . .
RUN mkdir -p /data && chown -R node:node /app /data

USER node
VOLUME ["/data"]
EXPOSE 3000

CMD ["node", "apps/backend/src/server.js"]
