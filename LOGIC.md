# Interactive Persistent Playlist System - Technical Specification

## Overview
A dual-access playlist platform that functions as a 24/7 shuffled radio station with adaptive song weighting based on user feedback. The system maintains song play frequency dynamically while preventing burnout through acceptance caps and automatic removal via rejection thresholds.

---

## Access Tiers

### Admin Access
- Authentication: Direct backend access (you only)
- Capabilities: 
  - Upload/manage playlist directly
  - Playlist persists indefinitely
  - Changes take effect immediately
  - View system statistics

### User Access
- Discovery: Blank black homepage with twinkling stars
- Entry Point: Brightest star acts as hidden access point
- Interaction: Click-and-hold (desktop) or press-and-hold (mobile) to reveal player
- Playback: Immediate shuffle playback begins across all active listeners (synchronized time)

---

## Core Mechanics

### Song Weighting System

Base Concept: Each song has a running net score that determines its likelihood of being selected next.

| Metric | Default | Cap/Threshold | Effect |
|--------|---------|---------------|--------|
| Accepts (Likes) | 0 | Cap at 10 | +1 per accept (max +10) |
| Rejects (Dislikes) | 0 | Removal at -10 | -1 per reject |
| Net Score | 0 (baseline) | +10 max or -10 removal | Dynamic adjustment |
| Play Frequency | ~1-2x per 24h | Up to ~5x per 24h | Based on net score |

Key Rules:
- Each play instance can receive multiple accepts and rejects from different users
- Net score = (total accepts) - (total rejects) across all plays
- At net score +10: song benefit caps (no further increases even if more accepts come)
- At net score -10: song is removed from rotation
- Net score persists forever and never resets

---

## Vote Accumulation Per Play

### How Voting Works
- Each time a song plays, multiple users can vote
- Votes from a single play instance are tallied:
  - Accepts during that play: +X to net score
  - Rejects during that play: -X to net score
- Net score updates after each play based on vote differential

### Example Scoring

Song #113 Monster Ink - SkyDxddy
=============================
Play 1     |   rejects 2  |  accepts 0  | net: -2
Play 2     |   rejects 2  |  accepts 1  | net: -3
Play 3     |   rejects 0  |  accepts 3  | net: 0
Play 4     |   rejects 2  |  accepts 0  | net: -2
Play 5     |   rejects 3  |  accepts 0  | net: -5
Play 6     |   rejects 2  |  accepts 0  | net: -7
Play 7     |   rejects 2  |  accepts 0  | net: -9
Play 8     |   rejects 1  |  accepts 2  | net: -8
Play 9     |   rejects 0  |  accepts 0  | net: -8
Play 10    |   rejects 0  |  accepts 0  | net: -8
Play 11    |   rejects 2  |  accepts 1  | net: -9
Play 12    |   rejects 1  |  accepts 0  | net: -10 <- REMOVED


Song #47 Numb Little Bug - Em Beihold
=============================
Play 1     |   rejects 0  |  accepts 3  | net: +3
Play 2     |   rejects 1  |  accepts 2  | net: +4
Play 3     |   rejects 0  |  accepts 4  | net: +8
Play 4     |   rejects 0  |  accepts 2  | net: +10 <- CAPPED
Play 5     |   rejects 2  |  accepts 5  | net: +10 (capped, no change)
Play 6     |   rejects 1  |  accepts 0  | net: +9
Play 7     |   rejects 0  |  accepts 3  | net: +10 (back to cap)


Song #201 Sideways - Citizen Soldier
=============================
Play 1     |   rejects 1  |  accepts 1  | net: 0
Play 2     |   rejects 0  |  accepts 2  | net: +2
Play 3     |   rejects 3  |  accepts 1  | net: 0
Play 4     |   rejects 1  |  accepts 2  | net: +1
Play 5     |   rejects 0  |  accepts 0  | net: +1
Play 6     |   rejects 2  |  accepts 3  | net: +2

---

## Playback Algorithm

### Queue Generation
1. Shuffle Pool: All active songs (excluding songs at net score -10)
2. Weight Distribution: Each song's play probability based on net score
   - Baseline (net 0): 100% weight
   - Positive net (+1 to +10): 100% + (net × 1%)
   - Negative net (-1 to -9): 100% + (net × 1%)
3. Selection: Random weighted selection (higher weight = more likely)
4. Deduplication: No song replays until 80% of playlist cycles through

Expected Outcomes (Large Playlist):
- Typical song (net 0) plays <3 times per 24 hours
- Popular songs (net +10) play ~5 times per 24 hours
- Unpopular songs (net -5 to -9) play rarely
- After net -10: song removed permanently from queue

### Real-Time Synchronization
- All active listeners hear same song at same timestamp
- No buffering lag = global playlist state
- Single shared playback server (not per-user streams)

---

## User Interaction Flow

### Listening Experience
```
[Hidden Star on Black Screen] 
    |
    v (click and hold / press and hold)
[Player Appears & Auto-Plays]
    |
    v
[Song Playing] <- Synchronized across ALL users globally
    |
    v
[Accept Button] [Reject Button]
    |
    v
[Net Score Updates] <- Affects future rotation probability
```

### Accept/Reject Mechanics
- Accept Button: Increases song's net score (+1 per accept)
- Reject Button: Decreases song's net score (-1 per reject)
- No Immediate Effect: Current song continues playing; affects future rotations only
- Multiple Users: Each user's vote counts independently toward that play's total

---

## Data Model

### Song Record
```json
{
  "id": "track_12345",
  "title": "Monster Ink",
  "artist": "SkyDxddy",
  "uri": "spotify:track:xxxxx",
  "net_score": -8,
  "total_plays": 11,
  "total_accepts": 10,
  "total_rejects": 18,
  "status": "active",
  "created_at": "2026-01-15T10:30:00Z",
  "last_played": "2026-01-29T11:45:00Z"
}
```

### Play Instance Record
```json
{
  "play_id": "play_98765",
  "song_id": "track_12345",
  "play_number": 11,
  "played_at": "2026-01-29T12:00:00Z",
  "accepts_this_play": 1,
  "rejects_this_play": 2,
  "net_score_after": -9,
  "listener_count": 15
}
```

### User Vote Record
```json
{
  "vote_id": "vote_11223",
  "user_id": "user_456",
  "play_id": "play_98765",
  "song_id": "track_12345",
  "vote_type": "reject",
  "voted_at": "2026-01-29T12:02:34Z"
}
```

---

## Lifecycle Examples

### Scenario 1: Universally Loved Song

Day 1-3: Song receives consistent positive votes
- Play 1: 4 accepts, 0 rejects -> net +4
- Play 2: 3 accepts, 1 reject -> net +6
- Play 3: 5 accepts, 0 rejects -> net +11 (capped at +10)
- Weight: 110% (maximum reached)
- Plays/24h: ~5 times

Week 1-4: Song maintains high rating
- Occasional rejects bring it to net +8, then back to +10
- Weight fluctuates between 108-110%
- Plays/24h: ~4-5 times
- Status: Highly rotated, community favorite

### Scenario 2: Divisive Song

Week 1: Mixed reception
- Play 1-3: Fluctuates between net +2 and net -1
- Weight: 98-102%
- Plays/24h: ~2 times

Week 2: Negative trend begins
- Play 4-7: Drops to net -5
- Weight: 95%
- Plays/24h: ~1 time

Week 3: Rapid decline
- Play 8-10: Reaches net -9
- Weight: 91%
- Plays/24h: <1 time

Week 4: Removal
- Play 11: Hits net -10
- Status: REMOVED from rotation permanently
- Plays/24h: 0

### Scenario 3: Stable Average Song

Month 1-12: Consistent neutral performance
- Plays 1-50: Hovers between net -2 and net +3
- Average weight: 100-103%
- Plays/24h: ~1-2 times
- Status: Steady rotation, no strong opinion

Year 1 Summary:
- Total plays: 487
- Total accepts: 156
- Total rejects: 152
- Net score: +4
- Status: Slightly favored, will continue playing indefinitely

---

## Edge Cases & Clarifications

### Accept Cap Behavior
Question: If a song has net +10 (capped) and then gets 5 rejects in one play, what happens?
Answer: 
- Net score: +10 - 5 = +5
- Weight: 105%
- Song is no longer capped and can climb back to +10

### Reject Removal Threshold
Question: Can a song come back after being removed at net -10?
Answer: 
- Not automatically - once removed, it's gone from rotation
- Admin can manually re-add it (resets net score to 0)
- Consider: Adjust threshold to -15 or -20 if removal feels too aggressive

### Net Score Persistence
Question: Do net scores reset daily/weekly/monthly?
Answer: 
- NEVER. Net scores are permanent lifetime statistics
- A song's reputation is built over its entire existence in the playlist
- This prevents gaming the system with temporary spam

### Multiple Votes Per User
Question: Can one user vote multiple times on the same play?
Answer:
- No. One vote per user per play instance
- System should track user_id + play_id combination
- Duplicate votes from same user ignored

---

## Admin Dashboard Recommendations

Suggested metrics to display:
- Now Playing: Current track with global sync status
- Active Listeners: Real-time count
- Playlist Stats: Total songs, active vs. removed
- Top 10 Highest Rated: Songs with net scores +5 to +10
- Bottom 10 Lowest Rated: Songs with net scores -5 to -9
- At Risk: Songs at net -8 or -9 (one bad play from removal)
- Net Score Distribution: Histogram showing score ranges
- Recent Removals: Last 10 songs removed from rotation
- Upcoming Queue: Next 5 songs scheduled to play

---

## Technical Implementation Notes

### Frontend (User Side)
- Black canvas background with CSS star field animation
- Brightest star = button with onmousedown/ontouchstart event (hold detection)
- Audio player syncs to server timestamp via WebSocket or Server-Sent Events
- Accept/Reject buttons send POST requests (non-blocking, fire-and-forget)
- Disable buttons after vote to prevent duplicate submissions
- Show current song info: title, artist, current net score (optional)

### Backend (Server Side)
- Database: Songs table with net_score column, plays table, votes table
- Playback Engine: Weighted random selector with net score modifiers
- Sync Server: Broadcasts current song + timestamp to all connected clients
- Vote Handler: 
  1. Validates user hasn't voted on current play_id
  2. Records vote in votes table
  3. Updates play instance accept/reject tallies
  4. Recalculates song net_score
  5. Checks for cap (+10) or removal (-10) thresholds
  6. Updates song status if threshold reached

### Performance Considerations
- For 1000-song playlist with 100 concurrent users:
  - Net score update: O(1) per vote (simple addition/subtraction)
  - Next song selection: O(n) weighted random (acceptable for n < 10,000)
  - Sync broadcast: WebSocket fanout (handle with Redis pub/sub)
  - Vote validation: O(1) with indexed lookup on (user_id, play_id)

### Suggested Tech Stack
- Frontend: React or Vue with WebSocket client
- Backend: Node.js/Express or Python/FastAPI
- Database: PostgreSQL with indexed columns on net_score and status
- Real-time: Socket.io or native WebSockets
- Audio: Spotify Web Playback SDK or custom streaming solution

---

## Summary for Developer

What You're Building: A 24/7 global radio station with adaptive song weighting based on cumulative community feedback.

Key Features:
1. Hidden star access on blank homepage (click-and-hold mechanic)
2. Global synchronized playback (everyone hears the same thing at the same time)
3. Accept/Reject buttons that adjust future play frequency
4. Persistent lifetime net scores (never reset)
5. Burnout protection (+10 cap prevents overplay)
6. Auto-removal (-10 threshold removes unpopular songs)
7. Perpetual shuffle with weighted randomization

Expected User Experience: 
User clicks the hidden star, music starts playing immediately, and they can vote on songs they like or dislike. Over time, the playlist learns what the community wants and plays popular songs more often while phasing out unpopular ones, but never overplaying anything.

Success Metric: 
Songs the community loves play ~5x/day, songs the community hates disappear after sufficient negative feedback, and the playlist never feels stale or repetitive.

---

## Implementation Checklist

### Phase 1: Basic Playback
- [ ] Set up database schema (songs, plays, votes tables)
- [ ] Build admin interface for playlist upload
- [ ] Implement weighted random song selection
- [ ] Create synchronized playback server
- [ ] Build hidden star homepage with click-hold detection

### Phase 2: Voting System
- [ ] Add Accept/Reject buttons to player interface
- [ ] Implement vote recording and validation
- [ ] Build net score calculation logic
- [ ] Add cap (+10) and removal (-10) threshold checks
- [ ] Update song weights in real-time after each play

### Phase 3: Admin Dashboard
- [ ] Display currently playing song
- [ ] Show active listener count
- [ ] Create net score distribution visualization
- [ ] Build top/bottom rated songs lists
- [ ] Add recent removals log
- [ ] Implement manual song re-add functionality

### Phase 4: Optimization
- [ ] Add database indexes for performance
- [ ] Implement WebSocket connection pooling
- [ ] Add rate limiting on vote endpoints
- [ ] Set up monitoring and logging
- [ ] Test with simulated load (100+ concurrent users)

### Phase 5: Polish
- [ ] Add smooth animations for star reveal
- [ ] Implement graceful reconnection on network drops
- [ ] Add optional net score display for transparency
- [ ] Create fallback for browsers without WebSocket support
- [ ] Write documentation for future maintenance
