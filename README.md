# Terminal-style-retro-site

https://retro-site-cm6n.onrender.com/

## 概要
黒背景・緑文字のターミナル風デザインのホームページ。
CRUD機能を実装。

## 使用技術
- Node.js
- Express
- SQLite (or MySQL)
- Vanilla JavaScript
- Docker
- Git / GitHub

## 機能
- BBS
- 絵茶
- 拍手
- 管理者専用の日記
- アクセスカウンタ
- ターミナル風UI

## デプロイ方法

### 1. ローカルでの実行 (Docker Compose)
`docker-compose` を使用して、バックエンドとフロントエンドを両方立ち上げます。

```bash
docker-compose up --build
```

- **バックエンド/フロントエンド統合版**: [http://localhost:3000](http://localhost:3000)
- **フロントエンド専用版 (Nginx)**: [http://localhost:8080](http://localhost:8080)

データは `./data/database.db` に保存され、永続化されます。

### 2. Render へのデプロイ
Render では、1つの Web Service としてデプロイすることを推奨します。

1. GitHub リポジトリを Render に接続します。
2. `render.yaml` を使用した「Blueprint Instance」としてデプロイするか、手動で以下の設定を行います：
   - **Runtime**: `Docker`
   - **Dockerfile Path**: `Dockerfile`
   - **Environment Variables**:
     - `DATABASE_URL`: Supabase (PostgreSQL) を使用する場合の接続文字列。未指定の場合は SQLite を使用します。
     - `DATABASE_PATH`: SQLite を使用する場合の DB 保存パス（デフォルト：`/var/lib/data/database.db`）
     - `ADMIN_PASSWORD`: 管理者ログインのパスワード
   - **Disk (オプション)**: データの永続化が必要な場合、1GB 程度のディスクを `/var/lib/data` にマウントしてください（※ Render の Free Plan ではディスクが使用できません）。
   - renderの無料プランでデータベースを保持したい場合はSupabaseを使用してください

## 工夫した点
- **環境変数による柔軟な設定**: `DATABASE_PATH` を環境変数で指定可能に。
- **Render 対応**: `render.yaml` と専用の `Dockerfile` を用意。
- **データの永続化**: SQLite ファイルを特定のディレクトリに配置し、ボリュームマウントに対応。
- updated_atを使った編集済表示
- フロントで安全なイベントバインド
- ブランチ運用
