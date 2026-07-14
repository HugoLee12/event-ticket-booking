# Build context = root repo (để COPY được shared/contracts và tsconfig.base.json)
FROM node:22-alpine
WORKDIR /app/services/auth
COPY services/auth/package*.json ./
RUN npm ci
COPY tsconfig.base.json /app/tsconfig.base.json
COPY shared /app/shared
COPY services/auth ./
RUN npm run build
ENV NODE_ENV=production
CMD ["npm", "start"]
