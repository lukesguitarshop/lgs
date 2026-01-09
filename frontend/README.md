# Guitar Price Database - Frontend

A Next.js 15 application for browsing and analyzing guitar pricing data from the Reverb marketplace.

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **API**: .NET 9 backend (http://localhost:5000/api)

## Getting Started

### Prerequisites

- Node.js 18+ installed
- npm or yarn
- Backend API running on http://localhost:5000

### Installation

1. Install dependencies:
```bash
npm install
```

2. Create environment file:
```bash
cp .env.example .env.local
```

3. Update `.env.local` with your API URL:
```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:5000/api
```

### Development

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build

Create a production build:

```bash
npm run build
npm run start
```

## Project Structure

```
frontend/
├── app/
│   ├── components/        # Reusable React components
│   │   ├── Header.tsx     # Site header with navigation
│   │   └── Footer.tsx     # Site footer
│   ├── layout.tsx         # Root layout with header/footer
│   ├── page.tsx           # Home page
│   └── globals.css        # Global styles
├── lib/
│   └── api.ts             # API client utility
├── public/                # Static assets
└── .env.local             # Environment variables (not in git)
```

## API Integration

The app uses a custom API client (`lib/api.ts`) to communicate with the .NET backend:

```typescript
import api from '@/lib/api';

// GET request
const guitars = await api.get('/guitars');

// POST request
const result = await api.post('/guitars', { data });
```

The API base URL is configured via the `NEXT_PUBLIC_API_BASE_URL` environment variable.

## Features

- **Server Components**: Leverages Next.js 15 App Router for optimal performance
- **Responsive Design**: Mobile-first design with Tailwind CSS
- **Type Safety**: Full TypeScript support throughout
- **API Ready**: Pre-configured to fetch data from .NET backend

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_BASE_URL` | Backend API base URL | `http://localhost:5000/api` |

## Development Notes

- The `NEXT_PUBLIC_` prefix makes environment variables available in the browser
- API client includes error handling and type safety
- Layout components (Header/Footer) are shared across all pages

## License

MIT
