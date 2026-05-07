# Looma

An AI-native zero-code platform that combines traditional SaaS capabilities with AI-powered interactions. Build forms, workflows, and AI agents through natural language and visual drag-and-drop.

## Tech Stack

- **Frontend**: Next.js 15 (App Router)
- **AI Protocol**: AG-UI Protocol
- **Agent Orchestration**: LangGraph
- **AI SDK**: CopilotKit
- **Database**: PostgreSQL + Drizzle ORM
- **Authentication**: NextAuth.js v5
- **UI Components**: shadcn/ui + Radix
- **Drag & Drop**: dnd-kit / React Flow

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL database
- pnpm or npm

### Installation

1. Install dependencies:

```bash
npm install
```

2. Set up environment variables:

```bash
cp .env.example .env.local
# Edit .env.local with your database and auth credentials
```

3. Configure your database:

```bash
# Update DATABASE_URL in .env.local
DATABASE_URL=postgresql://user:password@localhost:5432/looma
```

4. Push database schema:

```bash
npm run db:push
```

5. Start development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## Project Structure

```
looma/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (auth)/            # Authentication routes
│   │   ├── (dashboard)/       # Main application routes
│   │   └── api/               # API routes
│   ├── components/            # React components
│   │   ├── ui/               # shadcn/ui components
│   │   └── providers/        # Context providers
│   ├── lib/                   # Core libraries
│   │   ├── auth/             # Authentication
│   │   ├── db/               # Database
│   │   └── forms/            # Form engine
│   └── types/                 # TypeScript types
└── docs/                     # Documentation
```

## Features

### Phase 1: Core Framework
- [x] Project scaffolding
- [x] Database schema
- [x] Authentication
- [x] UI components

### Phase 2: Organization Management
- [ ] Team management
- [ ] Department structure
- [ ] Member roles and permissions

### Phase 3: Form Engine
- [ ] Drag-and-drop form builder
- [ ] Dynamic form rendering
- [ ] Form validation
- [ ] Data collection and export

### Phase 4: Workflow Engine
- [ ] Visual workflow editor
- [ ] Automated processes
- [ ] Triggers and conditions

### Phase 5: AI Integration
- [ ] CopilotKit integration
- [ ] AG-UI protocol
- [ ] Natural language form generation

### Phase 6: Agent System
- [ ] AI agent builder
- [ ] LangGraph integration
- [ ] Tool execution

## Development

### Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start         # Start production server
npm run lint          # Run ESLint
npm run db:generate   # Generate database migrations
npm run db:push       # Push schema to database
npm run db:studio     # Open Drizzle Studio
npm run db:seed       # Seed database with sample data
```

### Adding Components

```bash
npx shadcn@latest add button card input
```

## Documentation

- [Specification](./SPEC.md) - Detailed feature specifications
- [Roadmap](./docs/ROADMAP.md) - Project roadmap and execution plan

## License

MIT
