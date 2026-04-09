# Terminal-style-retro-site

https://retro-site-cm6n.onrender.com/index.html

![Label](https://img.shields.io/badge/Node.js-339933?logo=node.js&logoColor=white)
![Label](https://img.shields.io/badge/-Docker-EEE.svg?logo=docker&style=flat)
![Label](https://img.shields.io/badge/-Nginx-bfcfcf.svg?logo=nginx&style=flat)
![Label](https://img.shields.io/badge/-PostgreSQL-336791.svg?logo=postgresql&style=flat)
![Label](https://img.shields.io/badge/Javascript-276DC3.svg?logo=javascript&style=flat)
![Label](https://img.shields.io/badge/-CSS3-1572B6.svg?logo=css3&style=flat)

黒背景に緑文字を基調とした、1990年代後半から2000年代初頭のインターネットを彷彿とさせるターミナル風デザインの多機能レトロサイトです。

私は実務経験がない中で自身の技術力を示すため、本ポートフォリオの開発に取り組みました。一般的なモダンデザインのサイトが多い中で差別化を図るため、あえてレトロなWebサイトの表現を再現することをコンセプトとしています。

一方で、単に外観を再現するだけではなく、セキュリティや保守性を考慮し、バックエンドについては現代的な技術や設計思想を意識して実装しています。

開発過程ではAIツールも補助的に活用しましたが、技術的な理解を深めることを重視し、自ら調査・検証を行いながら、実用可能なレベルまで完成させました。


## 特徴
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

## ディレクトリ構成
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

## はじめかた

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

### 3. Render でのデプロイ (Blueprint 対応)
本プロジェクトは `render.yaml` を含んでいるため、Render の **Blueprint** 機能を利用して簡単にデプロイできます。

1.  GitHub にリポジトリをプッシュします。
2.  [Render Dashboard](https://dashboard.render.com/) にログインし、**"New"** > **"Blueprint"** を選択します。
3.  リポジトリを選択し、`render.yaml` の設定を確認します。
4.  **"Apply"** をクリックすると、以下のリソースが自動的に作成されます：
    *   **Web Service**: Docker ランタイムで動作する本体
    *   **Disk**: SQLite データベースを永続化するための 1GB のストレージ
5.  デプロイ完了後、Web Service の **"Environment"** 設定から、必要に応じて `ADMIN_PASSWORD` などの環境変数を追加してください。

※ 無料プラン（Free Plan）でも動作しますが、Disk 機能を使用するため、Render の有料インスタンス（Starter 以上）が必要になる場合があります。

#### 無料プランで永続化させたい場合 (Supabase の利用)
Render の無料プランで Disk を使用せずにデータを永続化するには、外部データベース（Supabase など）を利用します。

1.  [Supabase](https://supabase.com/) でプロジェクトを作成し、**Project Settings > Database** から **Connection String (Transaction mode または Session mode)** の URL を取得します。
2.  Render の Web Service 設定画面の **"Environment"** セクションで、以下の環境変数を追加します：
    *   `DATABASE_URL`: Supabase から取得した接続文字列
3.  `DATABASE_URL` が設定されると、アプリは自動的に SQLite から PostgreSQL (Supabase) モードに切り替わり、データが永続化されます。

## 🛡 セキュリティと工夫
- **データ永続化**: Dockerボリュームマウントにより、再起動後もデータを保持。
- **バリデーション**: `express-validator` による入力値チェック。
- **セキュリティヘッダー**: `helmet` による基本的なWebセキュリティの確保。
- **連投防止**: `express-rate-limit` によるAPI制限。
- **レスポンシブ**: レトロな外観を保ちつつ、ブラウザサイズに合わせた表示。

## ライセンス
This project is open-sourced under the MIT License.
