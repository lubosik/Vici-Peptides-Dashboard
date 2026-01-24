# Vici Peptides Dashboard

A production-grade, live-updating, ledger-accurate analytics dashboard for Vici Peptides. This dashboard ingests WooCommerce data into Supabase Postgres, normalizes it into an order ledger (parent orders + child order_lines), calculates every metric with explicit deterministic formulas, and presents results in a fast, clean UI.

## Features

- 📊 **Real-time Analytics**: Live-updating dashboard with Supabase Realtime subscriptions
- 🛒 **WooCommerce Integration**: Automatic sync from WooCommerce REST API
- 📈 **Ledger-Accurate Metrics**: Deterministic calculations for revenue, profit, ROI, and more
- 📱 **Responsive Design**: Mobile-optimized with hamburger menu navigation
- 🎨 **On-Brand UI**: Design system extracted from vicipeptides.com
- 🔄 **Idempotent Sync**: Prevents duplicate data with unique constraints and upsert logic
- 🚫 **Smart Filtering**: Excludes draft/cancelled orders and placeholder products from calculations

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: Supabase (PostgreSQL)
- **Styling**: Tailwind CSS + shadcn/ui
- **Charts**: Recharts
- **Authentication**: Supabase Auth
- **Deployment**: Vercel

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase account
- WooCommerce store with REST API access

### Installation

1. Clone the repository:
```bash
git clone https://github.com/lubosik/Vici-Peptides-Dashboard.git
cd Vici-Peptides-Dashboard
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

Edit `.env.local` with your credentials:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SECRET_KEY=your_supabase_service_role_key
WOOCOMMERCE_STORE_URL=your_woocommerce_store_url
WOOCOMMERCE_CONSUMER_KEY=your_consumer_key
WOOCOMMERCE_CONSUMER_SECRET=your_consumer_secret
```

4. Run database migrations:
```bash
# Apply all migrations in supabase/migrations/
# Use Supabase CLI or run SQL files directly in Supabase dashboard
```

5. Import initial data (optional):
```bash
npm run import
```

6. Start the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
├── app/                    # Next.js App Router pages
│   ├── orders/            # Orders listing and detail pages
│   ├── products/          # Products inventory page
│   ├── expenses/          # Expenses management
│   ├── revenue/           # Revenue analytics
│   ├── analytics/         # Analytics dashboard
│   └── settings/          # Settings and sync controls
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   ├── charts/           # Chart components
│   └── sidebar.tsx       # Navigation sidebar (mobile-responsive)
├── lib/                   # Utility libraries
│   ├── queries/          # Database query functions
│   ├── metrics/          # Metric calculation functions
│   ├── sync/             # WooCommerce sync logic
│   └── supabase/         # Supabase client setup
├── supabase/
│   ├── migrations/       # Database migrations
│   └── functions/       # Edge functions
└── scripts/                # Utility scripts
```

## Key Features

### Order Management
- View all orders with filtering and pagination
- Order detail pages with line items (automatically generated for every order)
- Status updates and order tracking
- Export to CSV
- Excludes draft/cancelled orders from revenue calculations

### Product Inventory
- Product listing with sales metrics
- Stock status tracking
- Low stock alerts
- Product detail views
- Placeholder products automatically filtered out

### Analytics
- Revenue over time charts
- Profit analysis
- Top products by revenue/units
- Expense tracking and categorization
- All metrics exclude draft/cancelled orders

### WooCommerce Sync
- Manual sync trigger from Settings
- Automatic sync via Make.com webhooks
- Idempotent data ingestion
- Sync state tracking

## Mobile Responsive Design

- **Desktop (≥1024px)**: Traditional sidebar navigation
- **Mobile (<1024px)**: Hamburger menu with slide-out drawer
- All pages optimized for mobile with responsive typography and spacing

## Deployment

### Vercel

1. Push code to GitHub (already done!)
2. Import project in Vercel: https://vercel.com
3. Add environment variables in Vercel dashboard
4. Deploy

The dashboard will automatically deploy on every push to main.

See `DEPLOYMENT.md` for detailed deployment instructions.

## Environment Variables

See `.env.example` for all required environment variables.

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run import` - Import CSV data
- `npm run sync` - Trigger WooCommerce sync
- `npm run diagnose` - Diagnose Supabase connection

## License

ISC

## Support

For issues and questions, please open an issue on GitHub.
