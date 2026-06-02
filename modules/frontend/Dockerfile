FROM node:20-alpine

WORKDIR /app

COPY modules/frontend/package.json ./
RUN npm install

COPY modules/frontend/ .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npm run build

EXPOSE 3000

CMD ["sh", "-c", "node_modules/.bin/next start -p ${PORT:-3000}"]
