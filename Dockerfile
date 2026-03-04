FROM node:18

WORKDIR /app

# backendフォルダのpackage.jsonをコピー
COPY backend/package*.json ./
RUN npm install

# backendフォルダの中身を全部コピー
COPY backend ./

EXPOSE 3000

CMD ["node", "app.js"]