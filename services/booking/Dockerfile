# Build context = root repo. npm workspaces: manifest + lockfile nằm ở root,
# phải COPY package.json của cả 2 workspace để npm ci validate được lockfile.
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
COPY services/auth/package.json services/auth/
COPY services/booking/package.json services/booking/
RUN npm ci -w services/booking
COPY tsconfig.base.json ./
COPY shared ./shared
COPY services/booking services/booking
RUN npm run build -w services/booking
ENV NODE_ENV=production
WORKDIR /app/services/booking
CMD ["npm", "start"]
