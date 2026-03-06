FROM node:18-alpine

WORKDIR /app

# backendフォルダのpackage.jsonをコピーしてインストール
COPY backend/package*.json ./
RUN npm install

# backendフォルダの内容をコピー
COPY backend/ ./

# データ保存用ディレクトリの作成
RUN mkdir -p /app/data

# ポート3000を開放
EXPOSE 3000

# 実行
CMD ["node", "app.js"]
