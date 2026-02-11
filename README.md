# ShadowVote

Social deduction game (Mafia-lite) as a Base Mini App with onchain reputation.

## Features

- 6-10 players per room
- Roles: Impostors, Detective, Citizens
- Night/Day phases with voting
- Real-time updates via SSE
- Onchain soulbound reputation (ERC-compliant)

## Tech Stack

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS
- **Real-time**: Server-Sent Events (SSE)
- **Database**: Prisma + SQLite
- **Web3**: wagmi + viem
- **Contract**: Solidity (ShadowReputation)

## Quick Start

```bash
# Install dependencies
npm install

# Setup database
npx prisma generate
npx prisma db push

# Run development server
npm run dev
```

## Environment Variables

```env
# Database
DATABASE_URL="file:./dev.db"

# Contract (after deployment)
NEXT_PUBLIC_CONTRACT_ADDRESS=0x...
NEXT_PUBLIC_CHAIN=baseSepolia

# Server signing key
SIGNER_PRIVATE_KEY=0x...

# For contract deployment
PRIVATE_KEY=0x...
BASESCAN_API_KEY=...
```

## Deploy Contract

```bash
# Set your private key
set PRIVATE_KEY=0x...

# Deploy to Base Sepolia
node scripts/deploy.js
```

## Game Flow

1. **Lobby**: Players join with room code, ready up
2. **Night**: Impostors pick target, Detective investigates
3. **Day**: Discussion chat, then voting
4. **Repeat** until win condition
5. **End**: Claim reputation onchain

## Role Distribution

| Players | Impostors | Detectives | Citizens |
|---------|-----------|------------|----------|
| 6       | 2         | 1          | 3        |
| 7       | 2         | 1          | 4        |
| 8       | 2         | 1          | 5        |
| 9       | 3         | 1          | 5        |
| 10      | 3         | 1          | 6        |

## API Endpoints

- `POST /api/room/create` - Create new room
- `POST /api/room/join` - Join existing room
- `GET /api/room/[roomId]` - Get room state
- `GET /api/room/[roomId]/stream` - SSE stream
- `POST /api/room/[roomId]/start` - Start game (host)
- `POST /api/room/[roomId]/ready` - Toggle ready
- `POST /api/room/[roomId]/action` - Night action
- `POST /api/room/[roomId]/vote` - Day vote
- `POST /api/room/[roomId]/chat` - Send message
- `POST /api/room/[roomId]/transition` - Phase transition (host)
- `POST /api/claim` - Get claim signature

## Contract

**ShadowReputation** (Soulbound):
- `claimResult(gameId, outcome, repDelta, expiry, signature)` - Claim reputation
- `getStats(address)` - Get (rep, games, wins)
- `hasClaimed(gameId, player)` - Check if claimed

## Security Notes

- All roles hidden server-side, only own role revealed
- Night actions validated by role
- Votes validated for alive players only
- Chat rate-limited (1 msg/sec)
- Claims require valid EIP-712 signature
- Double-claims prevented onchain

## Deploy to Vercel

```bash
vercel
vercel env add DATABASE_URL
vercel env add NEXT_PUBLIC_CONTRACT_ADDRESS
vercel env add SIGNER_PRIVATE_KEY
vercel --prod
```

## Base.dev Verification

1. Add `base:app_id` meta tag to layout
2. Create `public/.well-known/farcaster.json`
3. Generate account association
4. Submit at base.dev

## License

MIT
