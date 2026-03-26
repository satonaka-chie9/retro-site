# Terminal-style-retro-site 📟

![Label](https://img.shields.io/badge/Node.js-339933?logo=node.js&logoColor=white)

黒背景に緑文字。90年代後半から2000年代初頭のインターネットを彷彿とさせる、ターミナル風デザインの多機能レトロサイトです。


## 🌟 特徴
- **ターミナルUI**: 全てのページが黒背景・緑文字のレトロな雰囲気。
- **多機能掲示板 (BBS)**: CRUD機能を完備し、編集済みマークの表示にも対応。
- **リアルタイムチャット (Etchat)**: Socket.ioを使用したリアルタイムなコミュニケーション。
- **ブログ機能**: 記事の投稿、一覧表示が可能。
- **拍手機能 (Claps)**: 記事やプロフィールに対するリアクション。
- **管理画面**: 投稿の管理や拍手の確認が可能な管理者専用ページ。
- **モダンなバックエンド**: Express, SQLite/PostgreSQL, Socket.ioを使用した堅牢な設計。

## 🛠 使用技術
### フロントエンド
- Vanilla JavaScript / CSS (レトロスタイル)
- Socket.io-client

### バックエンド
- Node.js / Express
- SQLite (ローカル/Docker用)
- PostgreSQL / Supabase (デプロイ用)
- Multer (ファイルアップロード)
- Helmet / Rate Limit (セキュリティ対策)

### インフラ・デプロイ
- Docker / Docker Compose
- Render (Blueprint 対応)

## 📂 ディレクトリ構成
```text
.
├── backend/            # Expressサーバー, API, WebSocket
│   ├── db/            # データベース接続・初期化
│   ├── frontend/      # 静的コンテンツ (HTML, CSS, JS, Images)
│   ├── routes/        # APIルーティング
│   ├── services/      # ロジック・ユーティリティ
│   └── validators/    # バリデーション
├── data/               # SQLiteデータベース保存先 (永続化)
├── docker-compose.yml  # コンテナ管理
└── README.md           # このファイル
```

## 🚀 はじめかた

### 1. ローカルでの実行 (Docker Compose)
最も簡単な開始方法です。

```bash
docker-compose up --build
```

- **URL**: [http://localhost:3000](http://localhost:3000)
- データの永続化: `./data/database.db` に保存されます。

### 2. 環境変数の設定
`.env` ファイル（または環境変数）で以下の設定が可能です。

| 変数名 | 説明 | デフォルト値 |
| :--- | :--- | :--- |
| `PORT` | サーバーのポート番号 | `3000` |
| `DATABASE_PATH` | SQLiteの保存先 | `/var/lib/data/database.db` |
| `ADMIN_PASSWORD` | 管理画面へのログインパスワード | (任意) |
| `DATABASE_URL` | Supabaseなどの接続文字列 | (未指定時はSQLite) |

## 🛡 セキュリティと工夫
- **データ永続化**: Dockerボリュームマウントにより、再起動後もデータを保持。
- **バリデーション**: `express-validator` による入力値チェック。
- **セキュリティヘッダー**: `helmet` による基本的なWebセキュリティの確保。
- **連投防止**: `express-rate-limit` によるAPI制限。
- **レスポンシブ**: レトロな外観を保ちつつ、ブラウザサイズに合わせた表示。

## 📝 ライセンス
This project is open-sourced under the MIT License.
