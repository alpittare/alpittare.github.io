# Setup Guide - Game Ecosystem Backend

Complete setup instructions for deploying the Convex backend.

## Prerequisites

- Node.js 18+ and npm/yarn
- Convex account (free tier available)
- Git (optional)

## Installation Steps

### 1. Install Dependencies

```bash
npm install
# or
yarn install
```

This installs:
- `convex`: Convex SDK and CLI tools
- `typescript`: Type checking for schema

### 2. Create Convex Project

If you don't have a Convex project yet:

```bash
npx convex init
```

This will:
- Prompt you to sign in to Convex
- Create a new Convex project
- Set up authentication
- Generate `.env.local`

### 3. Start Development Server

```bash
npm run dev
```

This will:
- Deploy schema to local Convex instance
- Watch for file changes
- Provide development endpoints
- Show deployment URL in console

Output example:
```
Watching your functions...

Your Convex deployment is available at:
  App URL: https://proud-gazelle-123.convex.cloud
  Dashboard: https://dashboard.convex.dev/...
```

Save this URL for client configuration.

### 4. Environment Configuration

Create `.env.local` in project root:

```env
# Convex Deployment URL (from dev server output)
CONVEX_DEPLOYMENT=proud-gazelle-123

# Optional: Analytics settings
ANALYTICS_ENABLED=true
ANALYTICS_SAMPLE_RATE=1.0

# Optional: Feature flags
MULTIPLAYER_ENABLED=true
CAMPAIGN_ENABLED=true
ACHIEVEMENTS_ENABLED=true
```

## Client Integration

### 1. Configure ConvexClient

```javascript
import { ConvexClient } from './ConvexClient.js';

const client = new ConvexClient({
  deploymentUrl: 'https://proud-gazelle-123.convex.cloud',
  maxRetries: 3,
  timeout: 30000
});
```

### 2. Initialize Authentication

```javascript
import AuthService from './auth/AuthService.js';

const auth = new AuthService({
  convexClient: client,
  useCapacitor: false, // true for mobile
  storageKey: 'game_ecosystem_auth'
});

const result = await auth.initialize();
console.log(`Player: ${result.playerId}`);
```

### 3. Setup Analytics

```javascript
import AnalyticsService from './analytics/AnalyticsService.js';

const analytics = new AnalyticsService({
  convexClient: client,
  playerId: result.playerId,
  batchSize: 10,
  flushInterval: 30000
});

analytics.setupUnloadHandler();
```

## Testing the Setup

### 1. Test Player Registration

```javascript
const result = await client.mutation('registerPlayer', {
  name: 'TestPlayer',
  email: 'test@example.com'
});

console.log('New player:', result.playerId);
```

Expected output:
```
New player: j8n4k2m9r5v1p3
```

### 2. Test Session Submission

```javascript
const session = await client.mutation('submitGameSession', {
  playerId: result.playerId,
  game: 'cricket',
  score: 150,
  difficulty: 'medium',
  won: true,
  duration: 120
});

console.log('Session recorded:', session.sessionId);
```

### 3. Test Leaderboard Query

```javascript
const leaderboard = await client.query('getLeaderboard', {
  game: 'cricket',
  difficulty: 'medium',
  limit: 10
});

console.log('Top 10 players:', leaderboard);
```

## Deployment to Production

### 1. Build Project

```bash
npm run build
```

This compiles and validates all functions.

### 2. Deploy

```bash
npm run deploy
```

This will:
- Compile TypeScript
- Validate schema
- Deploy to production
- Print production URL

Output:
```
Deploying your functions to Convex...
Successfully deployed!

Production URL: https://your-prod-deployment.convex.cloud
```

### 3. Update Environment

Update `.env.production`:

```env
CONVEX_DEPLOYMENT=your-prod-deployment
REACT_APP_CONVEX_URL=https://your-prod-deployment.convex.cloud
```

### 4. Verify Deployment

```bash
# Run tests against production
npx convex test --prod
```

## Database Initialization

The schema automatically creates all tables on first deploy. No migration needed.

### Verify Tables

In Convex Dashboard:
1. Go to https://dashboard.convex.dev
2. Select your project
3. Click "Data" tab
4. Confirm these tables exist:
   - players
   - sessions
   - leaderboard
   - multiplayer_rooms
   - multiplayer_queue
   - achievements
   - campaign_progress
   - seasons
   - analytics_events

### Create Initial Season

```javascript
const season = await client.mutation('createSeason', {
  name: 'Season 1',
  startDate: Date.now(),
  endDate: Date.now() + (90 * 24 * 60 * 60 * 1000), // 90 days
  game: 'cricket'
});

console.log('Season created:', season);
```

## Monitoring & Debugging

### View Logs

In Convex Dashboard:
1. Click "Logs" tab
2. Filter by function name or player ID
3. View execution details and errors

### Performance Metrics

In Dashboard:
1. Click "Metrics" tab
2. Monitor query/mutation latency
3. Track database storage usage
4. Review error rates

### Test Offline Queue

```javascript
// Simulate offline
client.handleOffline();

// Queue mutations (will queue, not execute)
const queued = await client.mutation('submitGameSession', args);
console.log(queued.queued); // true

// Simulate back online
client.handleOnline();

// Check status
const status = client.getStatus();
console.log(status.offlineQueueLength); // Should process
```

## Common Issues & Solutions

### Issue: "Deployment not found"
**Solution**: Verify CONVEX_DEPLOYMENT in env matches actual deployment

```bash
# Check deployments
npx convex deployments list
```

### Issue: "Function not found"
**Solution**: Ensure file is in convex/ directory and named correctly

```bash
# Verify files
ls -la convex/*.ts
```

### Issue: "Schema validation failed"
**Solution**: Check TypeScript compilation

```bash
# Compile schema
npx tsc convex/schema.ts
```

### Issue: "Rate limit exceeded"
**Solution**: Adjust rate limit settings

```javascript
const client = new ConvexClient({
  enableRateLimit: true,
  rateLimit: 200 // Increase from default 100
});
```

### Issue: "Offline queue not syncing"
**Solution**: Verify online event is detected

```javascript
window.addEventListener('online', () => {
  console.log('Online detected');
});
```

## Performance Tuning

### 1. Optimize Queries

Add indexes for common query patterns:

```typescript
// Already included in schema.ts
.index("by_playerId_game", ["playerId", "game"])
```

### 2. Batch Analytics

Configure batching to reduce requests:

```javascript
const analytics = new AnalyticsService({
  batchSize: 20,      // Larger batches
  flushInterval: 60000 // Longer intervals
});
```

### 3. Implement Caching

Cache frequently accessed data:

```javascript
// Cache player profile
const player = await client.query('getPlayer', { playerId });
localStorage.setItem(`player_${playerId}`, JSON.stringify(player));

// Use cache on subsequent loads
const cached = JSON.parse(localStorage.getItem(`player_${playerId}`));
```

## Security Setup

### 1. Enable HTTPS

All Convex deployments use HTTPS by default.

### 2. Protect API Keys

Never commit secrets to git:

```bash
# Add to .gitignore
.env.local
.env.production.local
.env.*.local
```

### 3. Rate Limiting

Enabled by default in ConvexClient:

```javascript
const client = new ConvexClient({
  enableRateLimit: true,
  rateLimit: 100 // requests/minute
});
```

### 4. Input Validation

All mutations validate input server-side (no client-side only validation).

## Scaling Considerations

### Database Growth

Monitor storage in Convex Dashboard:

```
Estimated monthly growth:
- 1000 active players
- 5 games/player/day = 5000 sessions/day
- ~10KB per session = 50MB/day
- ~1.5GB/month per 1000 players
```

### Query Performance

Typical query times:
- `getLeaderboard`: <200ms
- `getPlayerSessions`: <300ms
- `getSessionStats`: <400ms

Add pagination for large result sets:

```javascript
const sessions = await client.query('getPlayerSessions', {
  playerId,
  limit: 50
});
```

### Concurrent Users

Convex auto-scales. Monitor in Dashboard:
- Concurrent connections
- Request throughput
- Database connection count

## Backup Strategy

### Automatic Backups

Convex includes automatic daily backups.

### Manual Export

Export data via Convex Dashboard:
1. Click "Settings"
2. Click "Export data"
3. Download JSON backup

### Restore Process

Contact Convex support for restoration requests.

## Support Resources

- **Convex Docs**: https://docs.convex.dev
- **Convex Discord**: https://discord.gg/convex
- **This Backend README**: See README.md
- **API Reference**: See README.md API Reference section

## Troubleshooting Checklist

- [ ] Node.js version >= 18
- [ ] npm/yarn dependencies installed
- [ ] Convex account created and authenticated
- [ ] .env.local configured with deployment URL
- [ ] `npm run dev` completes without errors
- [ ] Schema tables visible in Dashboard
- [ ] Test player registration succeeds
- [ ] Test session submission succeeds
- [ ] Leaderboard query returns data
- [ ] Offline queue works when simulated

## Next Steps

1. ✓ Complete setup steps
2. Run test scripts above
3. Integrate with game client
4. Monitor logs in Dashboard
5. Load test with realistic data
6. Deploy to production
7. Configure monitoring alerts
8. Implement additional features

## Quick Reference Commands

```bash
# Development
npm run dev                 # Start dev server
npm run build              # Compile TypeScript
npm test                   # Run tests
npm run deploy             # Deploy to production

# Convex CLI
npx convex logs           # View logs
npx convex dashboard      # Open Dashboard
npx convex deployments    # List deployments
npx convex env show       # Show environment
```

---

**Setup Time**: ~5 minutes
**Deployment Time**: ~2 minutes
**First Test**: ~1 minute

Total: ~8 minutes from start to production-ready backend
