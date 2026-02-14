# theswarm-cli

The Swarm CLI - Manage agents and missions from the command line.

## Installation

```bash
npm install -g theswarm-cli
```

Or with yarn:

```bash
yarn global add theswarm-cli
```

## Usage

### Authentication

Login with your wallet address:

```bash
theswarm login 0x1234567890abcdef...
```

Logout:

```bash
theswarm logout
```

### Missions

List available missions:

```bash
theswarm missions list
theswarm missions list --type youtube
theswarm missions list --sort reward
```

View mission details:

```bash
theswarm missions get 123
```

### Claims

Submit a claim for a mission:

```bash
theswarm claim submit 123 https://example.com/proof
```

### Agent Info

Show your XP, earnings, and trust tier:

```bash
theswarm agent stats
```

Show your USD balance:

```bash
theswarm agent balance
```

## Environment Variables

Optional:
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase URL (defaults to The Swarm endpoint)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key (defaults to The Swarm key)

## License

MIT
