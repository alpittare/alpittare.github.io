# Game Development Ecosystem - Backend Services

Production-ready Convex backend for multi-game platform supporting Cricket, Football, and Baseball with multiplayer, achievements, leaderboards, and analytics.

## Quick Start

### 1. Convex Setup

```bash
npm install convex
npx convex dev
```

### 2. Environment Variables

```env
# .env.local
CONVEX_DEPLOYMENT=prod_deployment_name
```

### 3. Initialize Backend

```javascript
import { ConvexClient } from './ConvexClient';
import AuthService from './auth/AuthService';
import AnalyticsService from './analytics/AnalyticsService';

// Initialize clients
const convexClient = new ConvexClient({
  deploymentUrl: 'https://your-deployment.convex.cloud'
});

const authService = new AuthService({
  convexClient,
  useCapacitor: true // For mobile apps
});

const analyticsService = new AnalyticsService({
  convexClient,
  playerId: null // Set after auth
});

// Initialize auth
const auth = await authService.initialize();
console.log(`Player ID: ${auth.playerId}, New: ${auth.isNew}`);

// Update analytics with player ID
analyticsService.playerId = auth.playerId;
```

## Architecture

### Database Schema

#### Tables

**players**
- Core player profile with stats and settings
- Indexed by email, created, lastSeen
- Stats: gamesPlayed, totalWins, totalScore
- Settings: sound, music, difficulty, theme

**sessions**
- Individual game session records
- Tracks score, difficulty, outcome, duration
- Indexed for fast player session retrieval
- Compound index on playerId + game

**leaderboard**
- Season-based rankings
- Multiple difficulty levels per game
- Automatically ranked by score
- Indexed by game, difficulty, season

**multiplayer_rooms**
- Cricket, Football, Baseball matches
- Host vs Guest structure
- Status tracking: waiting → playing → finished
- Timestamps for matchmaking analytics

**multiplayer_queue**
- Matchmaking queue entries
- Difficulty-based matching
- Status tracking: searching → matched
- Tracks matched room assignment

**achievements**
- Player achievement progress
- 8 different achievement types
- Per-game tracking
- Unlocked timestamp

**campaign_progress**
- Single-player campaign levels
- Stars (0-3) per level
- Best score tracking
- Completion timestamps

**seasons**
- Time-based leaderboard seasons
- Per-game seasons
- Active flag for current season
- Start/end dates

**analytics_events**
- Privacy-compliant event tracking
- No PII collected
- Batched for performance
- Full event catalog support

## API Reference

### Authentication

#### Initialize Authentication
```javascript
const auth = await authService.initialize();
// Returns: { success, playerId, isNew, playerName }
```

#### Register Anonymous Player
```javascript
const result = await authService.registerAnonymousPlayer(name);
// Auto-generates ID if no name provided
```

#### Validate Session
```javascript
const { valid, player } = await authService.validateSession();
```

#### Logout
```javascript
await authService.logout();
```

### Player Management

#### Register Player
```javascript
const { playerId } = await convexClient.mutation('registerPlayer', {
  name: 'Player Name',
  email: 'optional@email.com' // optional
});
```

#### Get Player
```javascript
const player = await convexClient.query('getPlayer', { playerId });
// Returns: { name, email, stats, settings, created, lastSeen }
```

#### Update Settings
```javascript
await convexClient.mutation('updatePlayerSettings', {
  playerId,
  soundEnabled: true,
  musicEnabled: false,
  difficulty: 'hard', // easy | medium | hard
  theme: 'dark' // light | dark
});
```

### Game Sessions

#### Submit Session
```javascript
const { sessionId, stats } = await convexClient.mutation('submitGameSession', {
  playerId,
  game: 'cricket', // cricket | football | baseball
  score: 150,
  difficulty: 'medium',
  won: true,
  duration: 120 // seconds
});
```

#### Get Player Sessions
```javascript
const sessions = await convexClient.query('getPlayerSessions', {
  playerId,
  limit: 20,
  game: 'cricket' // optional filter
});
```

#### Get Session Stats
```javascript
const stats = await convexClient.query('getSessionStats', {
  playerId,
  game: 'cricket'
});
// Returns: { totalGames, wins, winRate, averageScore, bestScore, difficultyBreakdown }
```

### Leaderboards

#### Get Leaderboard
```javascript
const leaderboard = await convexClient.query('getLeaderboard', {
  game: 'cricket',
  difficulty: 'hard',
  limit: 100
});
// Returns: [{ playerId, playerName, score, rank, ... }]
```

#### Get Player Rank
```javascript
const rank = await convexClient.query('getPlayerRank', {
  playerId,
  game: 'cricket',
  difficulty: 'medium'
});
// Returns: { playerId, score, rank, ... } or null
```

#### Update Leaderboard
```javascript
const entry = await convexClient.mutation('updateLeaderboard', {
  playerId,
  game: 'cricket',
  score: 250,
  difficulty: 'hard'
});
// Only updates if score is better
```

#### Get Season Leaderboard
```javascript
const seasonBoard = await convexClient.query('getSeasonLeaderboard', {
  seasonId,
  game: 'cricket',
  limit: 50
});
```

### Multiplayer

#### Create Room
```javascript
const room = await convexClient.mutation('createRoom', {
  hostId: playerId,
  game: 'cricket'
});
// Returns: { roomId, code, status: 'waiting', ... }
```

#### Join Room
```javascript
const room = await convexClient.mutation('joinRoom', {
  code: 'ABC123',
  guestId: playerId
});
// Status changes to 'playing' automatically
```

#### Get Room
```javascript
const room = await convexClient.query('getRoom', { roomId });
// Returns: { code, hostId, guestId, hostScore, guestScore, status, ... }
```

#### Update Innings/Score
```javascript
const updated = await convexClient.mutation('updateInnings', {
  roomId,
  playerId,
  score: 120
});
// Automatically assigns to host or guest
```

#### Finish Room
```javascript
const final = await convexClient.mutation('finishRoom', { roomId });
// Automatically creates sessions for both players
// Winner determined by higher score
```

#### Join Queue
```javascript
const { matched, roomId, queueId } = await convexClient.mutation('joinQueue', {
  playerId,
  game: 'cricket',
  difficulty: 'medium'
});

if (matched) {
  // Start playing immediately
} else {
  // Wait for match
}
```

#### Check Queue Status
```javascript
const status = await convexClient.query('checkQueue', { playerId });
// Returns: { inQueue, matched, roomId, position }
```

#### Leave Queue
```javascript
await convexClient.mutation('leaveQueue', { playerId });
```

### Achievements

#### Unlock Achievement
```javascript
const achievement = await convexClient.mutation('unlockAchievement', {
  playerId,
  achievementId: 'first_win', // See achievement list
  game: 'cricket'
});
```

#### Get Player Achievements
```javascript
const achievements = await convexClient.query('getPlayerAchievements', {
  playerId,
  game: 'cricket' // optional
});
// Returns: [{ achievementId, name, description, category, unlockedAt }]
```

#### Get Achievement Progress
```javascript
const progress = await convexClient.query('getAchievementProgress', {
  playerId,
  achievementId: 'ten_wins',
  game: 'cricket'
});
// Returns: { progress, requirement, unlocked, percentage }
```

#### Achievement List

```
Milestone Category:
- first_win: Win your first game
- ten_wins: Win 10 games
- fifty_wins: Win 50 games

Skill Category:
- perfect_score: Achieve perfect score
- speedrun: Complete game in <30 seconds

Rank Category:
- leaderboard_top_10: Reach top 10

Difficulty Category:
- hard_mode_master: Win 10 games on hard

Multiplayer Category:
- multiplayer_win: Win first multiplayer match

Exploration Category:
- all_games: Play all three games
```

### Campaign

#### Sync Campaign Progress
```javascript
const progress = await convexClient.mutation('syncCampaign', {
  playerId,
  game: 'cricket',
  level: 5,
  stars: 3,
  bestScore: 180
});
// Only updates if better progress
```

#### Get Campaign Progress
```javascript
const progress = await convexClient.query('getCampaignProgress', {
  playerId,
  game: 'cricket'
});
// Returns: { level, stars, bestScore, lastPlayedAt, completedAt }
```

#### Get Campaign Leaderboard
```javascript
const board = await convexClient.query('getCampaignLeaderboard', {
  game: 'cricket',
  level: 5, // optional - specific level
  limit: 100
});
// Returns: [{ playerId, score, level, stars, rank }]
```

## Analytics Events

### Supported Events

**Game Events**
- `game_start`: Track game begins
  - Metadata: game, difficulty
- `game_end`: Track game completion
  - Metadata: game, difficulty, score, won, duration

**Achievement Events**
- `achievement_unlock`: Player unlocks achievement
  - Metadata: achievementId, game
- `achievement_progress`: Achievement progress update
  - Metadata: achievementId, progress, requirement

**Social Events**
- `multiplayer_win`: Win multiplayer match
  - Metadata: game, difficulty
- `matchmaking`: Matchmaking attempt
  - Metadata: game, difficulty, matched

**Funnel Events** (User Journey)
- `funnel_event`: Track conversion funnel
  - Stages: menu, game_selection, difficulty, game_start, game_end, result, leaderboard

**Screen Events**
- `screen_view`: Track screen navigation
  - Metadata: screen name

**Purchase Events**
- `purchase`: In-app purchase
  - Metadata: itemId, price, currency

**Session Events**
- `session_end`: End of session
  - Metadata: duration, eventCount

### Tracking Usage

```javascript
// Track game start
analyticsService.trackGameStart('cricket', 'hard');

// Track game end
analyticsService.trackGameEnd('cricket', {
  duration: 120,
  score: 250,
  won: true,
  difficulty: 'hard'
});

// Track achievement
analyticsService.trackAchievementUnlock('first_win', 'cricket');

// Track purchase
analyticsService.trackPurchase('power_up_2x', 99, 'USD');

// Track funnel
analyticsService.trackFunnelEvent('game_started', { game: 'cricket' });

// Force flush
await analyticsService.flush();

// Setup unload handler for session end
analyticsService.setupUnloadHandler();
```

## Offline Support

### Offline Queue

When a player goes offline, mutations are queued and synced when back online:

```javascript
const client = new ConvexClient({
  enableOfflineQueue: true,
  deploymentUrl: 'https://...'
});

// When offline, mutations return:
// { queued: true, requestId: '...', message: '...' }

// When online, queue syncs automatically
// Listen to online/offline events
```

### Check Connection Status

```javascript
const status = client.getStatus();
// Returns: { online, offlineQueueLength, requestsThisMinute, rateLimit }

const queue = client.getOfflineQueue();
// Returns: [{ type, name, args, timestamp, id }]
```

## Rate Limiting

Default: 100 requests per minute per client

```javascript
const client = new ConvexClient({
  enableRateLimit: true,
  rateLimit: 100
});

// Rate limit exceeded throws error:
// Error: Rate limit exceeded
```

## Error Handling

```javascript
try {
  const result = await convexClient.mutation('submitGameSession', args);
} catch (error) {
  if (error.status === 404) {
    console.error('Player not found');
  } else if (error.status === 429) {
    console.error('Rate limited');
  } else if (error.name === 'AbortError') {
    console.error('Request timeout');
  } else {
    console.error('Unknown error:', error.message);
  }
}
```

### Retryable Errors

Automatically retried with exponential backoff:
- 5xx Server errors
- 408 Request timeout
- 429 Rate limit
- Network timeouts

## Best Practices

### 1. Player Registration
```javascript
// Always initialize auth first
const auth = await authService.initialize();
analyticsService.playerId = auth.playerId;

// Update last seen on app open
await authService.updateLastSeen();
```

### 2. Session Management
```javascript
// Save progress frequently
const sessionEnd = await convexClient.mutation('submitGameSession', {
  playerId,
  game,
  score,
  difficulty,
  won,
  duration
});

// Update stats immediately
await convexClient.mutation('updateLeaderboard', {
  playerId,
  game,
  score,
  difficulty
});
```

### 3. Multiplayer Flow
```javascript
// 1. Create room (host)
const room = await convexClient.mutation('createRoom', { hostId, game });

// 2. Share code with guest
// Guest joins:
await convexClient.mutation('joinRoom', { code, guestId });

// 3. Update scores during game
await convexClient.mutation('updateInnings', { roomId, playerId, score });

// 4. Finish when complete
await convexClient.mutation('finishRoom', { roomId });
```

### 4. Analytics
```javascript
// Track game journey
analyticsService.trackFunnelEvent('menu_opened');
analyticsService.trackGameStart('cricket', 'hard');
analyticsService.trackGameEnd('cricket', result);
analyticsService.trackFunnelEvent('result_viewed');

// Batch events periodically
await analyticsService.flush();
```

### 5. Offline Handling
```javascript
// Mutations queue automatically
// Queries fail with network error
try {
  const rank = await convexClient.query('getPlayerRank', args);
} catch (error) {
  if (error.message === 'Network unavailable') {
    // Show offline indicator
  }
}

// When online, queue syncs automatically
// Listen for sync completion
client.on('queue:synced', () => {
  console.log('All offline requests synced');
});
```

## Performance Optimization

### 1. Batch Analytics
```javascript
// Default: flush every 30s or 10 events
const analytics = new AnalyticsService({
  batchSize: 20,
  flushInterval: 60000 // 60 seconds
});
```

### 2. Query Caching
```javascript
// Cache player data locally
const player = await convexClient.query('getPlayer', { playerId });
localStorage.setItem('player_cache', JSON.stringify(player));

// Check cache first
const cached = JSON.parse(localStorage.getItem('player_cache'));
```

### 3. Optimize Indexes
```typescript
// Schema uses compound indexes for common queries
.index("by_playerId_game", ["playerId", "game"])
.index("by_game_difficulty", ["game", "difficulty"])
```

## Security Considerations

### 1. Input Validation
All mutations validate input:
- String length limits
- Number ranges
- Enum constraints
- Required fields

### 2. Privacy
Analytics collects NO PII:
- No email addresses
- No player names in events
- No IP addresses
- Sanitized metadata only

### 3. Authentication
- Anonymous IDs stored locally
- Session tokens validated
- No passwords stored
- Capacitor Preferences for mobile

## Deployment

### 1. Convex Production
```bash
npx convex deploy
```

### 2. Environment
```env
CONVEX_DEPLOYMENT=prod_your_deployment
```

### 3. Testing
```bash
npx convex test
```

## Monitoring

### Check Database Health
```javascript
// Query leaderboard generation time
const start = Date.now();
const leaderboard = await convexClient.query('getLeaderboard', args);
const duration = Date.now() - start;
console.log(`Query took ${duration}ms`);
```

### Monitor Queue
```javascript
setInterval(() => {
  const { offlineQueueLength, online } = client.getStatus();
  if (!online && offlineQueueLength > 50) {
    console.warn('Large offline queue');
  }
}, 5000);
```

## Troubleshooting

### "Player not found"
- Verify playerId is correct
- Check player was registered successfully
- Reset auth: `await authService.logout()`

### "Rate limit exceeded"
- Reduce request frequency
- Batch operations together
- Increase rate limit in config

### "Network unavailable"
- Check internet connection
- Mutations will queue automatically
- Queries will fail until online

### "Invalid achievement ID"
- Check achievement list above
- Ensure game matches achievement
- Verify achievementId spelling

## Architecture Diagram

```
┌─────────────────────────────────────┐
│     Game Client (Web/Mobile)        │
├─────────────────────────────────────┤
│  AuthService    AnalyticsService    │
│  ConvexClient                       │
└────────────┬────────────────────────┘
             │ HTTP/REST
             ↓
┌─────────────────────────────────────┐
│    Convex Backend (serverless)      │
├─────────────────────────────────────┤
│  Players  Sessions  Leaderboard     │
│  Multiplayer  Achievements Campaign │
│  Analytics Events                   │
└────────────┬────────────────────────┘
             │ Storage
             ↓
┌─────────────────────────────────────┐
│        Convex Database              │
│      (Auto-scaling Postgres)        │
└─────────────────────────────────────┘
```

## Support

For issues or questions:
1. Check this README
2. Review Convex documentation: https://docs.convex.dev
3. Check error messages and stack traces
4. Verify network connectivity
5. Review Console logs for details
