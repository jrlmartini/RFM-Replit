# RFM Analysis Application

## Overview

This is a web application for RFM (Recency, Frequency, Monetary) customer segmentation analysis. Users upload Excel files containing sales data, and the application calculates RFM scores to classify customers into strategic categories. The analysis results are visualized through a 5x5 heatmap, bar charts showing customer distribution by category, and detailed customer lists with individual scores.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript
- **Routing**: Wouter for lightweight client-side routing
- **Styling**: Tailwind CSS with shadcn/ui component library (New York style)
- **State Management**: TanStack React Query for server state management
- **Charts**: Recharts for data visualization (bar charts)
- **Excel Processing**: xlsx library for client-side Excel file parsing
- **Image Export**: html-to-image for exporting visualizations as images

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **HTTP Server**: Node.js createServer
- **API Structure**: RESTful endpoints under `/api/` prefix
- **Static File Serving**: Express static middleware for production builds

### Data Storage
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM with drizzle-zod for schema validation
- **Schema**: Single table `saved_analyses` storing analysis results as JSONB
- **Session Storage**: connect-pg-simple for PostgreSQL-backed sessions

### Build System
- **Client Bundler**: Vite with React plugin
- **Server Bundler**: esbuild for production builds
- **Development**: tsx for running TypeScript server directly
- **Database Migrations**: drizzle-kit push for schema synchronization

### Project Structure
```
├── client/src/          # React frontend application
│   ├── components/ui/   # shadcn/ui components
│   ├── hooks/           # Custom React hooks
│   ├── lib/             # Utility functions and RFM logic
│   └── pages/           # Page components
├── server/              # Express backend
│   ├── routes.ts        # API route definitions
│   ├── storage.ts       # Database access layer
│   └── static.ts        # Static file serving
├── shared/              # Shared types and schemas
│   └── schema.ts        # Drizzle schema definitions
└── attached_assets/     # Reference documentation
```

### Key Design Decisions
1. **Client-side Excel Processing**: RFM calculations happen in the browser using the xlsx library, reducing server load and enabling immediate feedback
2. **JSONB Storage**: Analysis results are stored as JSONB in PostgreSQL, allowing flexible schema for complex RFM data without additional tables
3. **Shared Schema**: TypeScript types are derived from Drizzle schemas using drizzle-zod, ensuring type safety between frontend and backend
4. **Monorepo Structure**: Client and server code coexist with shared path aliases (`@/`, `@shared/`)

## External Dependencies

### Database
- **PostgreSQL**: Primary database accessed via `DATABASE_URL` environment variable
- **Connection Pool**: pg library with connection pooling

### Third-Party Libraries
- **UI Components**: Full shadcn/ui component library with Radix UI primitives
- **Data Visualization**: Recharts for charts, html-to-image for exports
- **Excel Handling**: xlsx for reading/writing Excel files, file-saver for downloads
- **Date Handling**: date-fns for date manipulation
- **Form Validation**: Zod with @hookform/resolvers for form validation

### Replit-Specific Integrations
- **vite-plugin-runtime-error-modal**: Error overlay during development
- **vite-plugin-cartographer**: Development tooling
- **vite-plugin-dev-banner**: Development environment indicator
- **Custom meta-images plugin**: OpenGraph image URL configuration for deployments