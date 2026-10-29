# Production image: docker build -t findam . && docker run -p 3000:3000 --env-file .env findam
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app ./
RUN mkdir -p /app/uploads
EXPOSE 3000
CMD ["npm", "start"]
