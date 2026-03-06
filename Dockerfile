FROM node:18-slim

# sqlite3のビルドに必要な依存関係をインストール
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# backendフォルダのpackage.jsonをコピー
COPY backend/package*.json ./
# ネイティブモジュールをクリーンにインストール
RUN npm install

# アプリケーションのソースをコピー
COPY backend/ ./

# データ保存用ディレクトリ
RUN mkdir -p /app/data

EXPOSE 3000

CMD ["node", "app.js"]
