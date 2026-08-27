# ChainForge

**Prompt-to-deploy on-chain campaign apps.**

Describe a fan campaign in plain English. ChainForge plans it, picks a reviewed Solidity template, validates the configuration deterministically, deploys a clone, and sponsors the gas so participants can take part without holding native tokens or paying fees.

```text
"Run a prediction on who wins the final, closing at 8pm, three options"
   -> planner selects PredictionLogicV2
   -> deterministic normalization and validation
   -> EIP-1167 clone deployed from the factory
   -> participants act through a relayer, gasless
```

> **Archived.** This project is no longer developed or deployed, and it carries known design failures documented under [Known design failures](#known-design-failures). Read it, do not run it against anything of value.

## What it does

A campaign is a small on-chain app with a lifecycle: it opens, people take part, the creator closes it, and the result is finalized on chain. ChainForge generates one from a sentence.

| Surface | Purpose |
|---|---|
| `/builder` | Describe a campaign, review the generated plan, deploy it |
| `/explore` | Browse deployed campaigns |
| `/campaigns/[address]` | Take part in a live campaign |
| `/manage/[address]` | Creator dashboard: close, finalize, reveal |
| `/profile/[address]` | Participation history and reputation |
| `/leaderboard` | Ranked participants |
| `/proof` | Deployed contract addresses and explorer links |
| `/ops` | Operational status |

Eleven API routes back these, including `plan`, `deploy`, `relay`, `reveal`, and an `indexer`.

## The ten templates

The planner never writes Solidity. It selects among ten reviewed implementations and returns a structured configuration for the chosen one. Anything it cannot match falls back to an explicit `unsupported` response rather than a guess.

| Template | Selected for |
|---|---|
| `PredictionLogicV2` | predicting an outcome, who will win, MVP |
| `VotingLogicV2` | votes, favourites, ranking |
| `SurveyLogic` | feedback, sentiment, best moment |
| `QuizLogic` | trivia with a correct answer |
| `RaffleLogic` | giveaways, lucky draws, single entry |
| `BountyLogic` | a challenge where the creator picks a winning submission |
| `AuctionLogic` | bidding and pledges |
| `FanPassLogic` | tiered access passes and membership |
| `PointsPoolLogic` | reputation-weighted prediction pools |
| `TournamentLogic` | multi-round brackets with cumulative scoring |

Contracts follow a simple on-chain lifecycle, `OPEN -> CLOSED -> FINALIZED`, enforced by the implementation rather than the application.

## How it works

```text
prompt
  -> planner (lib/agents)        interprets intent, selects a template,
                                 returns a strict structured plan
  -> normalization (lib)         deterministic: fills defaults, coerces
                                 types, rejects invalid configurations
  -> deploy API                  EIP-1167 minimal-proxy clone from
                                 CampaignFactory
  -> relayer                     submits participant transactions so
                                 users pay no gas
  -> indexer + read models       campaign state, profiles, leaderboard
```

The architecture idea worth keeping: **the model proposes, deterministic code decides.** Constraining a planner to a finite set of reviewed templates is far easier to inspect than treating generated code as trusted output.

## Running it

Requires a recent Node LTS and an EVM RPC endpoint. The project declares no `engines` range, so the exact minimum is untested.

```bash
npm ci
npx hardhat compile          # 20 Solidity files
npx hardhat test             # 262 tests
npm run dev                  # Next.js app on :3000
```

Configuration is in `.env.example`: an OpenAI key for the planner, RPC URL and chain id, deployer and relayer keys, the factory address, and Upstash Redis credentials for the cache. Copy it to `.env` and fill it in.

Deployment scripts live in `scripts/`, including template deployment and registration against the factory.

## Layout

```text
app/          Next.js routes: builder, explore, campaign, manage, proof
components/   Shared UI
contracts/    CampaignFactory plus 12 template implementations
lib/          Planner agents, normalization, chain clients, read models, cache
scripts/      Deployment, registration, and diagnostic scripts
test/         Hardhat contract tests
```

Demo seed data uses fictional teams.

## Known design failures

This is why the project is archived rather than maintained. A post-hoc review of the final commit found eight design failures, all of which are still present in this code:

1. **Attribution boundary.** The factory accepts a creator address from its caller without binding it to `msg.sender`.
2. **Participation boundary.** Participation methods take a user address while the signature check lives in the API and a relayer submits the transaction.
3. **Role concentration.** Campaign clones are initialized with the server's deployer wallet as owner, so one key holds sponsorship, custody, ownership, and lifecycle authority.
4. **Lifecycle authorization scope.** Signed creator messages carry no nonce, expiry, chain, or domain version.
5. **Raffle entropy.** Winner selection derives from recent block data, timestamp, and participant count.
6. **Auction semantics.** Bids are declared numbers with no custody of the asset, and the creator may pick any registered bidder.
7. **Reputation semantics.** A participant supplies a bounded weight that is added directly to their chosen option.
8. **Index provenance.** Indexed campaigns store a placeholder block number of `"0"`.

The common thread: **a check in the API is not an invariant in the contract.** All 262 tests pass with every one of these present, because each test verifies behaviour inside the trust boundary the author already assumed.

Full reconstruction, including the trust-boundary diagram and the reasoning behind each finding, is in **[README vs Reality](https://github.com/itxcrusher/readme-vs-reality)**. The authorization lessons were rebuilt properly in **[spendlock](https://github.com/itxcrusher/spendlock)**.

## Status

**Not maintained.** Published as a portfolio artifact, to be read rather than run or extended. Issues and discussions are disabled, there is no roadmap, and the failures above will not be fixed.

The hosted deployment was decommissioned in August 2026. See [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE). Free to read, learn from, and reuse. The design failures travel with the code, so reuse the architecture idea rather than the authorization model.
