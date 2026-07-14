# Build context = root repo (để COPY được shared/contracts và tsconfig.base.json)
FROM node:22-alpine
WORKDIR /app/services/booking
COPY services/booking/package*.json ./
RUN npm ci
COPY tsconfig.base.json /app/tsconfig.base.json
COPY shared /app/shared
COPY services/booking ./
RUN npm run build
ENV NODE_ENV=production
CMD ["npm", "start"]
