FROM node:20-alpine

WORKDIR /app

COPY modules/frontend/package.json modules/frontend/package-lock.json* ./
RUN npm ci

COPY modules/frontend/ .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
