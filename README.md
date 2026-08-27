# ChainForge

**An archived prototype, published with its own post-mortem.**

ChainForge turned a plain-English request into a deployed on-chain campaign: an AI planner selected among ten fixed contract templates, deterministic code normalized and validated the result, and server-held keys sponsored gas so users could act without paying.

It worked. It was live for months. Then I audited it as if a stranger had written it, found eight design failures, and shut it down instead of relaunching it.

The code is here so the failures are legible. **Do not deploy it.** See [SECURITY.md](SECURITY.md).

## What the README used to claim, and what the code enforced

This repository exists because those two things were not the same.

| The old claim | What the code actually did |
|---|---|
| "AI builds a dApp" | AI selected and configured one of ten prewritten templates. Deterministic code and fixed contracts did the deploying. |
| "Gas-sponsored user actions" | True, but several contracts accepted a **caller-supplied** participant identity, so the API was the only real enforcement boundary. |
| "Audited before deployment" | Compatibility and configuration checks ran. That is schema validation, not an adversarial security audit. |

A narrower description would have been accurate and much easier to secure: *AI-assisted configuration of reviewed templates.*

## The eight design failures

Found by static review at commit `5380abd`, in my own code:

1. **Attribution boundary.** The factory accepted a creator address from its caller without binding it to `msg.sender`.
2. **Participation boundary.** Participation methods took a user address while the signature check lived in the API and a relayer submitted the transaction.
3. **Role concentration.** Campaign clones were initialized with the server's deployer wallet as owner. One key held sponsorship, custody, ownership, and lifecycle authority.
4. **Lifecycle authorization scope.** Signed creator messages carried no nonce, expiry, chain, or domain version.
5. **Raffle entropy.** Winner selection derived from recent block data, timestamp, and participant count.
6. **Auction semantics.** Bids were declared numbers with no custody of the asset, and the creator could pick any registered bidder.
7. **Reputation semantics.** A participant supplied a bounded weight that was added directly to their chosen option.
8. **Index provenance.** Indexed campaigns stored a placeholder block number of `"0"`.

The through-line: **a check in the API is not an invariant in the contract.** Every one of these is a case where the enforcing boundary sat somewhere other than where the claim implied.

Full reconstruction, including the trust-boundary diagram and the reasoning behind each finding: **[README vs Reality](https://github.com/itxcrusher/readme-vs-reality)**.

## The tests all pass. That is the uncomfortable part.

`test/` contains 13 files with **262** `it(...)` and `test(...)` declarations. During the forensic review I refused to describe those as passing tests, because I had not run them. Counting declarations and reporting them as coverage is one of the easier ways to mislead yourself about a codebase, including your own.

So I ran them:

```
262 passing (5m)
```

Verified on 2026-08-27 against the published tree: `npm ci && npx hardhat compile && npx hardhat test`. Twenty Solidity files compile clean, and every declaration is a real, passing test.

**And the eight design failures above were all present while those 262 tests passed.**

That is the lesson worth taking. A green suite proves the code does what the tests say. It says nothing about whether the tests assert the right things. Every one of these tests checks behaviour inside the trust boundary the author already assumed; none of them asks whether that boundary is where the product's claims implied it was. You cannot test your way to a correct authorization model, because the missing assertion is the one you did not think to write.

Reproduce it yourself:

```bash
npm ci
npx hardhat compile
npx hardhat test
```

## What was genuinely good about it

Rejecting a system is only honest if you can say what worked.

**The planner was constrained, not trusted.** It never synthesized arbitrary Solidity. It chose among ten known templates and returned a structured configuration that deterministic code then normalized and checked, with an explicit fallback for unsupported requests.

That is the one idea worth carrying forward: **separate probabilistic interpretation from deterministic enforcement.** The model may propose; typed, testable code decides what is allowed. A finite capability schema is vastly easier to inspect than generated code you have chosen to trust.

The test design also showed real intent to specify behaviour, and the integration work was complete rather than mocked: a full-stack app, a factory and template suite, API routes, relayer and deployer clients, event indexing, read models, and explorer links. The failure was never missing implementation. It was the gap between what the product said and what the boundaries enforced.

## Layout

```
app/          Next.js routes, builder UI, campaign and management views
components/   Shared UI
contracts/    Factory plus template implementations (Solidity)
lib/          Planner agents, normalization, chain clients, read models
scripts/      Deployment and utility scripts
test/         Hardhat contract tests
```

Demo seed data uses fictional teams. The original demo was themed around a real sports league; that branding has been removed and nothing in the architecture depended on it.

## Status

**Not maintained.** This is a portfolio artifact, published to be read rather than run or extended. Issues and discussions are disabled. There is no roadmap, no support, and no plan to fix the failures listed above; fixing them is what the analysis argues against, because the correct successor boundary was reasoning before code rather than faster deployment.

The hosted deployment was decommissioned in August 2026, before this analysis was published.

## License

[MIT](LICENSE). The code is free to read, learn from, and reuse. The design failures above travel with it, so reuse the ideas rather than the authorization model.
