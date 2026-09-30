FROM node:20-alpine

WORKDIR /app

COPY frontend/package.json ./
RUN npm install

COPY frontend/ ./

RUN npm run build

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0

EXPOSE 3000

CMD ["sh", "-c", "npm start -- -p ${PORT:-3000}"]
