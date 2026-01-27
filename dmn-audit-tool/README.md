# DMN Audit Tool

A web application for browsing and auditing SSI eligibility checks defined in DMN (Decision Model and Notation) files. Built for Subject Matter Experts (SMEs) to review decision logic without needing technical expertise.

## Features

- **Catalog View**: Browse all eligibility checks organized by category with search
- **Check Details**: View check purpose, inputs, outputs, and composition
- **FEEL Translation**: Human-readable English translations of FEEL expressions
- **Syntax Highlighting**: Color-coded FEEL expressions for readability
- **Composition Trees**: Visualize how composite checks combine sub-checks
- **Citation Links**: Direct links to POMS policy documentation

## Getting Started

### Prerequisites

- Node.js 18+
- Access to the BDT codebase (for DMN files)

### Installation

```bash
# Install dependencies
npm install

# Sync DMN files from BDT codebase
npm run sync-dmn

# Start development server
npm run dev
```

The app will be available at http://localhost:5173

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run sync-dmn` | Copy DMN files from BDT codebase |
| `npm run test` | Run tests in watch mode |
| `npm run test:run` | Run tests once |
| `npm run lint` | Run ESLint |

## Architecture

```
src/
├── components/       # Reusable UI components
│   ├── ui/          # shadcn/ui primitives
│   ├── composition-tree.tsx
│   └── error-boundary.tsx
├── hooks/           # React Query data hooks
├── lib/             # Core business logic
│   ├── dmn-parser.ts          # XML parsing
│   ├── feel-translator/       # FEEL-to-English translation
│   ├── feel-highlighter.ts    # Syntax highlighting
│   ├── dependency-graph.ts    # Composition tree builder
│   └── citation-extractor.ts  # POMS link extraction
└── pages/           # Route components
    ├── catalog.tsx
    └── check-detail.tsx
```

## Deployment

### Static Build

The app builds to a static `dist/` folder that can be served by any web server:

```bash
npm run build
# Serve dist/ with any static file server
```

### Docker

```bash
docker build -t dmn-audit-tool .
docker run -p 8080:80 dmn-audit-tool
```

## Development

### Tech Stack

- **React 19** with TypeScript
- **Vite** for build tooling
- **TanStack Query** for data fetching
- **React Router** for navigation
- **Tailwind CSS 4** for styling
- **shadcn/ui** for components
- **Vitest** for testing

### Testing

```bash
# Run all tests
npm test

# Run tests once (CI mode)
npm run test:run
```

### Adding New FEEL Patterns

To improve FEEL-to-English translation, add patterns to `src/lib/feel-translator/patterns.ts`:

```typescript
// Example: Match a new expression pattern
{
  pattern: /your-regex-here/,
  translate: (match) => ({
    english: `human readable: ${match[1]}`,
    confidence: 'high'
  })
}
```

## License

Internal use only.
