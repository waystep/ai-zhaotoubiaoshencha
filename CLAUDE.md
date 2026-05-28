# Smart Tender Review (智能投标审查平台)

## Project Overview

AI-powered construction bidding document review platform for Shanghai Construction Group (上海建工). Automates tender parsing, bid document generation, risk analysis, and review report generation through a pipeline of specialized AI agents.

## Tech Stack

- **Framework**: Next.js 14 (App Router) with TypeScript
- **Database**: PostgreSQL via Drizzle ORM (`drizzle-orm` + `drizzle-kit`)
- **Auth**: NextAuth.js with SAML SSO (`@boxyhq/saml-jackson`), SMS login
- **AI**: Mastra framework (`@mastra/core`) + AI SDK (`ai`, `@ai-sdk/openai`)
- **UI**: React + Tailwind CSS + Radix UI (`@radix-ui/*`) + shadcn/ui components
- **Charts**: Recharts
- **Document Processing**: mammoth (Word), docx (Word generation), pdfjs-dist/react-pdf
- **Editor**: TipTap (`@tiptap/react`)

## Project Structure

```
src/
├── app/
│   ├── (auth)/              # Auth pages: login, register, forgot/reset password
│   ├── (dashboard)/         # Main app pages (route group, no URL prefix)
│   │   ├── admin/           # Admin: models, knowledge bases, rules, agent configs, SSO
│   │   ├── analytics/       # Statistics & analysis page
│   │   ├── chat/            # AI chat interface
│   │   ├── documents/       # Global document viewer
│   │   ├── projects/        # Project workspace (core business flow)
│   │   │   └── [projectId]/ # Per-project: documents, analysis, draft, review, reports
│   │   └── settings/        # User settings
│   ├── dashboard/           # Redirects to /projects
│   └── api/
│       ├── admin/           # Admin CRUD APIs
│       ├── analytics/       # Analytics aggregation endpoints
│       ├── auth/            # NextAuth + SMS + SSO endpoints
│       ├── documents/       # Document CRUD, parsing, extraction
│       ├── projects/        # Project CRUD + business operations
│       ├── reports/         # Report generation & management
│       ├── v1/              # Public v1 REST API (integration output)
│       └── upload/          # File upload handler
├── components/
│   ├── ui/                  # shadcn/ui base components
│   ├── chat/                # Chat UI components
│   ├── document/            # Document viewer components
│   ├── review/              # Review workflow components
│   └── providers/           # React context providers
├── hooks/                   # Custom React hooks
├── lib/
│   ├── ai/                  # AI prompts and utilities
│   ├── auth/                # Auth providers (SSO, SMS)
│   ├── db/
│   │   ├── schema/          # Drizzle schema definitions (centralized index.ts)
│   │   └── seed/            # Database seed scripts
│   ├── schemas/             # Zod validation schemas
│   ├── services/            # Business logic services (singleton pattern)
│   ├── storage/             # File storage utilities
│   ├── tasks/               # Background task definitions
│   ├── forms/               # Form validation
│   ├── nav/                 # Navigation config
│   └── ui/                  # UI utility functions
├── mastra/
│   ├── agents/              # Mastra AI agent definitions (A1-A7)
│   ├── config/              # Mastra configuration
│   ├── mcp/                 # MCP tools
│   ├── services/            # Mastra service layer
│   └── tools/               # Mastra tool definitions
├── styles/                  # Global CSS
└── types/                   # TypeScript type definitions
```

## Key Conventions

### Database
- All schemas in `src/lib/db/schema/` with a central `index.ts` re-export
- Drizzle ORM with PostgreSQL, configured via `drizzle.config.ts`
- Run migrations: `npm run db:push` or `npm run db:migrate`
- Seed: `npm run db:seed`

### Services
- Singleton pattern: each service file exports a class + `const xxxService = new XxxService()`
- Services handle all business logic; API routes are thin wrappers
- Database access via `db` from `@/lib/db/client`

### API Routes
- Admin APIs under `/api/admin/*` — CRUD for models, knowledge bases, rules, agents
- Business APIs under `/api/projects/[projectId]/*` — project-scoped operations
- Public v1 API under `/api/v1/*` — versioned integration outputs with API key auth
- Analytics APIs under `/api/analytics/*` — overview, trends, top metrics

### Frontend
- `"use client"` for all interactive pages (fetch data in useEffect)
- UI components use shadcn/ui: `Card`, `Button`, `Badge`, `Input`, `Select`, etc.
- All user-facing text is in Chinese (中文)
- Icons from `lucide-react`
- Custom CSS classes: `text-h2` (headings), `text-stat` (large stat numbers)

### AI Agents (Mastra)
- A1: Tender parsing with auto legal verification
- A2: Bid document generation with template matching
- A3: Enhanced bid review with rule-set driven checking
- A4: Risk location identification
- A5: Legal regulation parsing
- A6: Report generation
- A7: Bid document parsing

## Development

```bash
npm run dev          # Start Next.js dev server on 0.0.0.0
npm run worker       # Start background worker (tsx worker.ts)
npm run db:studio    # Drizzle Studio for DB inspection
npm run db:push      # Push schema changes to DB
npm run db:seed      # Seed database with defaults
npm run db:seed:agents  # Seed agent configurations
```

## Implementation Phases

- **Phase 1** (Foundation): Models, auth, basic infrastructure
- **Phase 2** (Knowledge): Knowledge bases, agent configs, rules
- **Phase 3** (Business Flow): A1-A7 agents, review workflow, bid editor
- **Phase 4** (Integration + Dashboard): v1 API, webhooks, dashboard analytics (in progress)
