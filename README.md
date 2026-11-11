# AI Engineering Copilot

**An AI-powered bug investigation assistant that combines GitHub evidence, internal knowledge retrieval, and structured issue analysis.**

AI Engineering Copilot helps engineers investigate software bugs by gathering relevant evidence from GitHub and an internal knowledge base, then generating structured investigation results and Jira ticket proposals.

The project explores practical AI engineering patterns, including tool calling, RAG, evaluation, MCP, API design, observability, and production-oriented architecture.

---

## Features

- **AI-powered Bug Investigation**  
  Uses OpenAI models to investigate bug reports through multiple steps.

- **GitHub Integration**  
  Searches GitHub issues, code, files, and pull requests to collect relevant evidence.

- **Retrieval-Augmented Generation (RAG)**  
  Retrieves relevant technical knowledge from an internal vector database.

- **Jira Ticket Generation**  
  Generates structured Jira ticket proposals based on investigation results.

- **Ticket Validation**  
  Validates generated ticket proposals before further use.

- **MCP Integration**  
  Explores Model Context Protocol (MCP) for connecting AI agents with external tools.

- **Human Approval**  
  Includes a human confirmation step before Jira ticket creation in the CLI workflow.

- **Structured Logging**  
  Records application events, execution times, and errors using structured JSON logs.

- **Docker Support**  
  Provides a containerized environment with a non-root runtime user.

---

## Architecture

```text
                 Bug Report
                     |
                     v
              HTTP API / CLI
                     |
                     v
               Bug Workflow
                     |
          +----------+----------+
          |                     |
          v                     v
   Bug Investigation      Jira Proposal
          |                     |
          v                     v
     OpenAI Agent          Validation
          |
     +----+----------------+
     |                     |
     v                     v
 GitHub Tools         Internal Knowledge
     |                     |
     v                     v
 GitHub API              RAG
                           |
                           v
                    Vector Database

              Investigation Result
                     |
                     v
                 Jira Proposal
                     |
                     v
               Human Approval
                     |
                     v
                 Jira API
```

The architecture separates HTTP routing, business logic, and external integrations to keep the application modular and maintainable.

---

## Tech Stack

| Category | Technology |
|---|---|
| Language | TypeScript |
| Runtime | Node.js |
| AI | OpenAI API |
| Backend | Node.js HTTP Server |
| Validation | Zod |
| Source Control Integration | GitHub API |
| Issue Tracking | Jira API |
| Messaging | Slack API |
| RAG | Embeddings, Chroma |
| Agent Integration | Model Context Protocol (MCP) |
| Containerization | Docker |

---

## Project Structure

```text
src/
├── app/
│   └── server.ts
├── integrations/
│   ├── github/
│   │   └── client.ts
│   ├── jira/
│   │   └── client.ts
│   └── slack/
│       └── client.ts
├── lib/
│   ├── logger.ts
│   └── openai.ts
├── mcp/
│   ├── agent.ts
│   ├── client.ts
│   └── server.ts
├── rag/
│   ├── evaluation.ts
│   └── ...
├── routes/
│   └── bug.ts
└── services/
    ├── bug-investigation.ts
    ├── bug-workflow.ts
    └── jira-ticket.ts
```

---

## Getting Started

### Prerequisites

- Node.js
- npm
- OpenAI API key
- GitHub personal access token

Additional credentials are required for Jira and Slack integrations.

### Installation

```bash
git clone https://github.com/f2hard3/ai-engineering-copilot.git

cd ai-engineering-copilot

npm install
```

### Environment Variables

Create a `.env` file in the project root.

```env
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini

GITHUB_TOKEN=
GITHUB_REPO=fastify/fastify

JIRA_BASE_URL=
JIRA_EMAIL=
JIRA_API_TOKEN=
JIRA_PROJECT_KEY=

SLACK_BOT_TOKEN=
SLACK_CHANNEL_ID=

PORT=3000
NODE_ENV=development
```

Never commit your `.env` file or expose API credentials.

### Run the Development Server

```bash
npm run dev
```

The server starts at:

```text
http://localhost:3000
```

### Investigate a Bug

Send a POST request to the investigation endpoint:

```bash
curl -X POST http://localhost:3000/bugs/investigate \
  -H "Content-Type: application/json" \
  -d '{
    "bugReport": "Describe the bug here"
  }'
```

---

## Engineering Focus

This project is being developed with a focus on practical AI engineering and production readiness.

Key engineering areas include:

- Modular backend architecture
- LLM tool calling and orchestration
- Retrieval-Augmented Generation and evaluation
- External API integrations
- Input validation and error handling
- Structured logging and observability
- Security and credential management
- Cost control and resource management
- Human-in-the-loop workflows
- Docker-based deployment

---

## Project Status

This is an ongoing engineering project.

The current implementation includes the core bug investigation workflow, GitHub integration, Jira proposal generation and validation, RAG evaluation experiments, MCP integration, and a Dockerized HTTP service.

Further improvements are planned around security, cost control, monitoring, and production deployment.

---

# AI Engineering Copilot（日本語）

**GitHubの証拠情報と社内ナレッジ検索を組み合わせ、ソフトウェアの不具合調査を支援するAIアシスタントです。**

AI Engineering Copilotは、GitHubと社内ナレッジベースから関連情報を収集し、構造化された調査結果とJiraチケットの提案を生成するプロジェクトです。

LLMのTool Calling、RAG、評価、MCP、API設計、Observabilityなど、実践的なAI Engineeringの技術を取り入れています。

---

## 主な機能

- **AIによる不具合調査**  
  OpenAIのモデルを活用し、複数のステップで不具合を調査します。

- **GitHub連携**  
  GitHub Issues、コード、ファイル、Pull Requestsを検索し、調査に必要な情報を収集します。

- **RAG（検索拡張生成）**  
  社内ナレッジベースから関連する技術情報を検索します。

- **Jiraチケット生成**  
  調査結果に基づいて、構造化されたJiraチケットの提案を生成します。

- **チケット検証**  
  生成されたチケットの内容を検証します。

- **MCP連携**  
  Model Context Protocol（MCP）を利用したAIエージェントと外部ツールの連携を検証します。

- **Human-in-the-Loop**  
  CLIワークフローでは、Jiraチケット作成前に人間による確認を行います。

- **構造化ログ**  
  JSON形式でアプリケーションのイベント、実行時間、エラーを記録します。

- **Docker対応**  
  非rootユーザーで実行するコンテナ環境を提供します。

---

## アーキテクチャ

```text
                 Bug Report
                     |
                     v
              HTTP API / CLI
                     |
                     v
               Bug Workflow
                     |
          +----------+----------+
          |                     |
          v                     v
   Bug Investigation      Jira Proposal
          |                     |
          v                     v
     OpenAI Agent          Validation
          |
     +----+----------------+
     |                     |
     v                     v
 GitHub Tools         Internal Knowledge
     |                     |
     v                     v
 GitHub API              RAG
                           |
                           v
                    Vector Database

              Investigation Result
                     |
                     v
                 Jira Proposal
                     |
                     v
               Human Approval
                     |
                     v
                 Jira API
```

HTTPルーティング、ビジネスロジック、外部サービスとの連携を分離し、保守性と拡張性を考慮した構成にしています。

---

## 技術スタック

| カテゴリー | 技術 |
|---|---|
| 言語 | TypeScript |
| ランタイム | Node.js |
| AI | OpenAI API |
| バックエンド | Node.js HTTP Server |
| バリデーション | Zod |
| ソースコード管理 | GitHub API |
| チケット管理 | Jira API |
| メッセージング | Slack API |
| RAG | Embeddings、Chroma |
| エージェント連携 | Model Context Protocol (MCP) |
| コンテナ | Docker |

---

## プロジェクト構成

```text
src/
├── app/
│   └── server.ts
├── integrations/
│   ├── github/
│   │   └── client.ts
│   ├── jira/
│   │   └── client.ts
│   └── slack/
│       └── client.ts
├── lib/
│   ├── logger.ts
│   └── openai.ts
├── mcp/
│   ├── agent.ts
│   ├── client.ts
│   └── server.ts
├── rag/
│   ├── evaluation.ts
│   └── ...
├── routes/
│   └── bug.ts
└── services/
    ├── bug-investigation.ts
    ├── bug-workflow.ts
    └── jira-ticket.ts
```

---

## セットアップ

### 必要な環境

- Node.js
- npm
- OpenAI APIキー
- GitHub Personal Access Token

JiraおよびSlackとの連携には、それぞれの認証情報が必要です。

### インストール

```bash
git clone https://github.com/f2hard3/ai-engineering-copilot.git

cd ai-engineering-copilot

npm install
```

### 環境変数

プロジェクトのルートディレクトリに `.env` ファイルを作成します。

```env
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini

GITHUB_TOKEN=
GITHUB_REPO=fastify/fastify

JIRA_BASE_URL=
JIRA_EMAIL=
JIRA_API_TOKEN=
JIRA_PROJECT_KEY=

SLACK_BOT_TOKEN=
SLACK_CHANNEL_ID=

PORT=3000
NODE_ENV=development
```

`.env` ファイルをGitにコミットしたり、API認証情報を公開したりしないでください。

### 開発サーバーの起動

```bash
npm run dev
```

サーバーは以下のURLで起動します。

```text
http://localhost:3000
```

### 不具合調査の実行

以下のエンドポイントにPOSTリクエストを送信します。

```bash
curl -X POST http://localhost:3000/bugs/investigate \
  -H "Content-Type: application/json" \
  -d '{
    "bugReport": "Describe the bug here"
  }'
```

---

## エンジニアリングの重点領域

このプロジェクトでは、実践的なAI Engineeringと本番環境を意識した開発に重点を置いています。

- モジュール化されたバックエンドアーキテクチャ
- LLM Tool Callingとオーケストレーション
- RAGと検索評価
- 外部API連携
- 入力バリデーションとエラーハンドリング
- 構造化ログとObservability
- セキュリティと認証情報の管理
- コスト管理とリソース制御
- Human-in-the-Loopワークフロー
- Dockerを利用したデプロイ

---

## プロジェクトの進捗

本プロジェクトは現在も開発中です。

不具合調査の基本ワークフロー、GitHub連携、Jiraチケットの提案と検証、RAG評価実験、MCP連携、Docker対応のHTTPサービスを実装しています。

今後はセキュリティ、コスト管理、モニタリング、本番環境へのデプロイを中心に改善を進める予定です。