# Betmali - Sports Betting Application

## Project Overview
Betmali is a Uganda-based sports betting platform built with React + Express, integrated with the BetMaster API for live odds and match data. The app features real Firebase authentication, live betting, virtual sports, and comprehensive league organization.

## Current Implementation Status

### ✅ Completed Features
- **20 Tournament Endpoints**: Integrated with BetMaster API across 6 countries (England, Spain, Germany, Italy, France, International)
- **Live Matches**: Real-time updates every 10 seconds using `/sport/live` endpoint  
- **Firebase Authentication**: Email/phone signup and login with Firebase Realtime Database
- **Bet Placement System**: Users can place multi-leg combo bets with customizable stakes
- **Match Display**: Shows all match details including odds, scores, teams, and league info
- **Organized Sidebar**: 20 leagues organized by country with match counts
- **Virtual Sports**: 24/7 virtual match betting (ForteUG API integration)
- **Currency Detection**: Auto-detects Uganda users and sets UGX currency
- **Responsive UI**: Mobile-first design with Tailwind CSS and Radix UI components

### 🔧 Recent Fixes (Current Session)
- **Removed Duplicate Leagues**: Eliminated duplicate "Coppa Italia" entries
- **Fixed Match Filtering**: Added null-safety checks for tournament data extraction
- **Firebase Integration**: Real auth with email, phone verification, and Firebase Realtime DB
- **Bet Creation**: Connected bet placement to persistent storage via Firebase

## Tech Stack
- **Frontend**: React 18, TypeScript, Vite, TanStack Query
- **Backend**: Express.js, TypeScript, tsx
- **Database**: Firebase Realtime Database (authentication & user data)
- **External APIs**: 
  - BetMaster API (live odds & matches)
  - ForteUG API (virtual sports)
  - Firebase Auth & Realtime DB
- **UI Framework**: Radix UI + Tailwind CSS

## Project Structure
```
client/src/
├── components/
│   ├── AuthModals.tsx - Firebase login/register
│   ├── Betslip.tsx - Bet selection & placement
│   ├── Navigation.tsx - League sidebar
│   ├── VirtualMatches.tsx - Virtual sports
│   └── ui/ - Radix UI components
├── hooks/
│   ├── use-matches.ts - Match fetching
│   ├── use-sports-leagues.ts - League data
│   └── use-bets.ts - Bet creation
├── lib/
│   ├── firebase.ts - Firebase config & auth
│   ├── store.ts - Zustand stores (auth, betslip)
│   └── utils.ts - Utilities
└── pages/
    ├── Home.tsx - Main betting interface
    └── InfoPages.tsx - About, Terms, etc.

server/
├── index.ts - Express setup
├── routes.ts - API endpoints
└── storage.ts - Data layer (API fetching, bet storage)
```

## Key Endpoints
- `GET /api/sports` - List sports (Soccer)
- `GET /api/leagues` - Get organized leagues by country
- `GET /api/matches` - Get matches (supports `?league=` and `?isLive=true`)
- `GET /api/matches/:id` - Get single match details
- `POST /api/bets` - Place a bet
- `GET /api/bets` - Get user's bets
- `GET /api/counters` - Match count statistics
- `GET /api/proxy/virtual-*` - Virtual sports data

## Firebase Configuration
- **Project ID**: betting-at-developers-smc
- **Database**: Realtime Database at `betting-at-developers-smc-default-rtdb.firebaseio.com`
- **Auth Domain**: betting-at-developers-smc.firebaseapp.com
- **Users stored at**: `/users/{uid}` in Realtime DB

## Environment Setup
The Firebase config is embedded in `client/src/lib/firebase.ts`. No additional env vars needed for development.

## Workflow
- **Dev Server**: `npm run dev` on port 5000
- **Auto-restart**: Workflows auto-restart after package installations
- **Development**: Code changes hot-reload via Vite

## Known Limitations
- Virtual games use public APIs (may have rate limits)
- Bets stored in localStorage (not persisted to Firebase yet - for phase 2)
- No payment integration yet (future feature)

## Next Steps for Enhancement
1. **Persist Bets to Firebase**: Store user bets in Firebase DB for cross-device sync
2. **Payment Integration**: Add Stripe/mobile money for deposits
3. **Bet History**: Show user's past bets and results
4. **Live Notifications**: WebSocket updates for live matches
5. **Odds Movement Alerts**: Notify when odds change significantly
6. **Mobile App**: React Native version for iOS/Android

## Recent User Preferences Documented
- Firebase auth required for real authentication
- Bet placement must work immediately when clicking leagues
- Match display should show all 20 organized leagues
- Virtual games betting integrated with main platform
