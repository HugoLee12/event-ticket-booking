# Build context = root repo. npm workspaces: manifest + lockfile nằm ở root,
# phải COPY package.json của cả 2 workspace để npm ci validate được lockfile.
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
COPY services/auth/package.json services/auth/
COPY services/booking/package.json services/booking/
RUN npm ci -w services/auth
COPY tsconfig.base.json ./
COPY shared ./shared
COPY services/auth services/auth
RUN npm run build -w services/auth
ENV NODE_ENV=production
WORKDIR /app/services/auth
CMD ["npm", "start"]
