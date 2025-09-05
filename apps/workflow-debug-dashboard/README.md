# 🎯 Workflow Debug Dashboard

A **standalone Next.js application** for monitoring and managing workflow executions with **real-time updates** powered by Supabase Realtime.

**✅ Completely Independent** - No custom Edge Functions required  
**✅ Real-time Updates** - Live data via Supabase Realtime subscriptions  
**✅ Modern UI** - Built with shadcn/ui and Tailwind CSS  
**✅ Deploy Anywhere** - Vercel, Netlify, or any static host

## 🚀 Features

### Real-Time Monitoring
- **Live Statistics**: Total executions, active jobs, success rates, and performance metrics
- **Real-time Updates**: Automatic updates via Supabase Realtime subscriptions
- **Active Job Indicator**: Animated pulse for currently processing workflows

### Workflow Management
- **View Execution Details**: Complete event data, error traces, and timing information
- **Resubmit Failed Jobs**: One-click reprocessing with original webhook data
- **Cancel Running Jobs**: Stop currently processing workflows
- **Test Webhooks**: Manual webhook submission for debugging

### Advanced Filtering & Search
- Filter by workflow name (content-moderation, etc.)
- Filter by execution status (pending, processing, completed, failed, etc.)
- Configurable page sizes (25, 50, 100, 200 rows)
- Auto-refresh mode with 5-second intervals

### Modern UI/UX
- Built with shadcn/ui components and Tailwind CSS
- Dark/light mode support
- Responsive design for desktop and mobile
- Toast notifications for user feedback
- Modal dialogs for detailed execution inspection

## 🚀 Quick Setup

### Prerequisites
- **Node.js 18+** and npm/yarn
- **Supabase project** with workflow_executions table
- **Database migrations** applied

### 1️⃣ Install Dependencies
```bash
cd apps/workflow-debug-dashboard
npm install
```

### 2️⃣ Configure Environment
Update `.env.local` with your Supabase credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_from_dashboard
```

### 3️⃣ Apply Database Migrations
```bash
# In your main Supabase project directory
supabase db push

# Or apply these migrations:
# - 20250831000001_workflow_executions_table.sql
# - 20250831000002_enable_realtime.sql
```

### 4️⃣ Start Development
```bash
npm run dev
```

**That's it!** Dashboard available at `http://localhost:3000`

> **No Edge Functions Required** - This app uses only standard Supabase client operations

## 📊 Dashboard Overview

### Statistics Cards
- **Total Executions**: Historical count across all workflows
- **Active Jobs**: Currently processing workflows (with live pulse indicator)
- **Success Rate**: Percentage of successful completions
- **Average Duration**: Mean execution time for completed workflows

### Execution Table
- **Real-time updates** via Supabase subscriptions
- **Detailed modal views** for each execution
- **Action buttons** for resubmit/cancel operations
- **Status badges** with color coding
- **Relative timestamps** and duration formatting

### Workflow Actions
- **Test Webhook Submission**: Quick testing with sample data
- **Bulk Operations**: (Future feature) Mass reprocessing
- **System Health**: (Future feature) Infrastructure monitoring

## 🔧 Architecture

### Technology Stack
- **Framework**: Next.js 14 with App Router
- **UI Components**: shadcn/ui (Radix UI + Tailwind CSS)
- **Database**: Supabase PostgreSQL with Realtime
- **Styling**: Tailwind CSS with CSS variables
- **Icons**: Lucide React
- **TypeScript**: Full type safety

### Real-time Data Flow
1. **Supabase Realtime** listens for changes to `workflow_executions` table
2. **React components** subscribe to database changes via `supabase.channel()`
3. **UI updates automatically** when new executions are created/updated
4. **Statistics recalculate** in real-time as data changes

### Component Structure
```
components/
├── ui/                 # shadcn/ui base components
├── stats-cards.tsx     # Dashboard statistics
├── execution-table.tsx # Main data table with filters
├── workflow-actions.tsx # Management operations
└── toaster.tsx        # Notification system
```

## 🎯 Usage Examples

### Debugging Failed Workflows
1. Filter table by status = "failed"
2. Click the eye icon to view error details and original event data
3. Click the refresh icon to resubmit with identical webhook data
4. Monitor real-time progress in the active jobs counter

### Testing New Webhook Data
1. Use the "Test Webhook" card to submit sample data
2. Watch the execution appear in real-time in the table
3. Monitor processing status and view results
4. Debug any issues with detailed error information

### Monitoring Live Activity
1. Enable auto-refresh for 5-second updates
2. Watch the active jobs counter pulse with running workflows
3. Filter by specific workflow types to focus monitoring
4. Track execution times and performance trends

## 🔐 Security Considerations

- Uses Supabase Row Level Security (RLS) for data access
- Service role key required for management operations
- CORS configured for browser-based requests
- Consider VPN/firewall restrictions for production environments

## 🚀 Deployment Options

### Vercel (Recommended)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy from the dashboard directory
cd apps/workflow-debug-dashboard
vercel

# Set environment variables in Vercel dashboard
```

### Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
CMD ["npm", "start"]
```

### Supabase Edge Functions
```bash
# Alternative: Deploy as a Supabase function
# (Requires adapting to Deno runtime)
```

## 📈 Performance & Scaling

- **Real-time subscriptions** scale with Supabase infrastructure
- **Client-side filtering** reduces database load
- **Pagination** prevents large result sets
- **Auto-refresh** can be disabled to reduce bandwidth
- **Indexed queries** for fast execution history lookups

## 🛠 Customization

The dashboard is designed to be easily extensible:

### Adding New Workflow Types
Update the workflow filter dropdown by modifying the stats query to include new workflow names.

### Custom Status Colors
Modify `getStatusColor()` in `lib/utils.ts` to add new status types or change existing colors.

### Additional Filters
Extend the filter interface in `execution-table.tsx` to add date ranges, error types, or custom metadata filters.

### New Action Buttons
Add custom workflow operations in `workflow-actions.tsx` for specific business logic.

## 🐛 Troubleshooting

### Realtime Not Working
- Verify `ALTER PUBLICATION supabase_realtime ADD TABLE workflow_executions;`
- Check Supabase project settings for Realtime enabled
- Confirm RLS policies allow reading workflow_executions

### No Data Showing
- Ensure the migration created the workflow_executions table
- Verify environment variables are correct
- Check browser console for JavaScript errors

### Performance Issues
- Reduce auto-refresh frequency or disable it
- Implement pagination for very large datasets
- Add database indexes for commonly filtered fields

This dashboard provides comprehensive observability into your queue-based workflow system with modern UX and real-time capabilities! 🎉