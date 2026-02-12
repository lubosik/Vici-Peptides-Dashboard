# NeonMetrics Dashboard Demo

A modern, neon-themed analytics dashboard demo built with Next.js, React, and Tailwind CSS. This is a public-safe demo version that showcases a beautiful dashboard UI with sample e-commerce data.

## Features

- **Neon Purple Theme**: Deep purple gradient backgrounds with vibrant neon accents (cyan, pink, green, orange)
- **Glassy Card Design**: Dark, translucent cards with neon glow effects
- **Interactive Dashboard**: 
  - Circular stat meters with animated progress arcs
  - Multi-line revenue charts with neon gradients
  - Progress bars and visualizations
  - Calendar widget with highlighted dates
  - Connected percentage ring widgets
- **Demo Data**: Fully functional with local state management and localStorage persistence
- **Responsive Design**: Mobile-friendly with collapsible sidebar

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS with custom neon theme
- **Charts**: Recharts
- **State Management**: Zustand with localStorage persistence
- **UI Components**: Radix UI primitives

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

```bash
npm install
```

### Development

**Option A – Double‑click (easiest on Mac)**  
1. In Finder, double‑click **`start-dev-server.command`** in the project folder.  
2. A Terminal window will open and start the server. **Leave that window open.**  
3. When you see `✓ Ready`, open [http://localhost:3000](http://localhost:3000) in your browser.

**Option B – Terminal**  
1. Open **Terminal.app** (or iTerm), then run:
   ```bash
   cd "/Users/ghost/Downloads/Vici Peptides Dashboard"
   npm run dev
   ```
2. **Keep that terminal window open.** Wait until you see `✓ Ready`.  
3. Open [http://localhost:3000](http://localhost:3000) in your browser.

**If you see "This site can’t be reached" / ERR_CONNECTION_REFUSED:**  
The dev server is not running. Start it using Option A or B above (do **not** start it from Cursor’s AI/agent). Leave the terminal window open and use [http://localhost:3000](http://localhost:3000).

### Build

```bash
npm run build
npm start
```

## Demo Mode

This dashboard runs in **demo mode by default** with sample data. All data is stored locally in your browser's localStorage.

### Reset Demo Data

To reset the demo data to default values:
1. Navigate to Settings
2. Click "Reset Demo Data"

## Project Structure

```
├── app/                    # Next.js app router pages
│   ├── page.tsx           # Main dashboard
│   ├── orders/            # Orders page
│   ├── products/          # Products page
│   ├── expenses/          # Expenses page
│   └── settings/          # Settings page
├── components/            # React components
│   ├── dashboard/        # Dashboard-specific components
│   ├── charts/            # Chart components
│   └── ui/                # Reusable UI components
├── lib/
│   ├── demo/              # Demo data infrastructure
│   │   ├── store.ts       # Zustand store
│   │   ├── generator.ts   # Data generator
│   │   ├── queries.ts     # Query functions
│   │   └── hooks.ts       # React hooks
│   └── metrics/           # Calculation utilities
└── public/                 # Static assets
```

## Environment Variables

Create a `.env.local` file (optional):

```env
# Demo Mode (default: true)
NEXT_PUBLIC_DEMO_MODE=true
```

## Deployment

This project is ready to deploy to Vercel:

1. Push to GitHub
2. Import project in Vercel
3. Deploy

No environment variables are required for demo mode.

## License

ISC
