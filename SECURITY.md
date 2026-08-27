# Security

## Read this before running anything here

This repository is an **archived prototype with known, documented design failures**. It is published as an engineering artifact to be read, not as software to deploy.

**Do not deploy these contracts to any network holding real value.** The [README](README.md) lists eight design failures found during a post-hoc review, including authorization boundaries that do not bind the acting principal, a single server key that concentrates ownership and lifecycle authority, signed messages without replay protection, and winner selection derived from block data. These are described so the code is useful to learn from. They are not fixed, and they will not be.

The original hosted deployment was **decommissioned in August 2026** before this analysis was published. Nothing here describes a reachable service.

## Reporting

If you find a factual error in the analysis, or something published here creates a risk I have not accounted for, open a private report through GitHub's private vulnerability reporting, or contact me through the verified method on the `itxcrusher` GitHub profile.

Please do not post exploit detail, credentials, or private data in a public issue.

## What this repository does not contain

No credentials, API keys, private keys, mnemonics, or deployment secrets. `.env.example` carries placeholder values only, and the full history was scanned before publication. Transaction hashes that appear in the analysis are public on-chain facts.
