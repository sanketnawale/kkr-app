FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./

RUN npm install --legacy-peer-deps
RUN npx playwright install --with-deps chromium
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
COPY package*.json ./

RUN npm install --only=production --legacy-peer-deps --no-package-lock
COPY --from=builder /app/dist ./dist
EXPOSE 3000
CMD ["npm", "run", "start:prod"]
