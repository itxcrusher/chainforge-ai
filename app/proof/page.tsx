import { PageHeader } from "@/components/PageHeader";
import { CopyButton } from "@/components/copy-button";

const EXPLORER = "https://wirefluidscan.com";

const CONTRACTS = [
  {
    label: "CampaignFactory V2",
    note: "EIP-1167 clone factory with creator and template attribution",
    address: "0x596FDe32DDde7e6e471adD72161F455429753c73",
    deployTx: "0x2e198d21ad7b8d3c2f0f4102ddf3006b6f29b2a62d6ea110c2796249d0212baa",
  },
  {
    label: "PredictionLogicV2",
    note: "Relay-friendly lifecycle prediction template",
    address: "0x16FCFEf59360f1e7d8C615014328bD8419a9Be59",
    deployTx: "0xaabaecce1669c8171274dff7901fcd6715316a31f1b30c4fc97ef5aa81fa2eaf",
  },
  {
    label: "VotingLogicV2",
    note: "Relay-friendly lifecycle voting template",
    address: "0x0225592B56BA91f153AE461C829b6fcC7B575B0e",
    deployTx: "0x552e3b92b50211f354a655d3a84d5dfdc8435ac87d68d5a87785f02b87c5b936",
  },
  {
    label: "SurveyLogic",
    note: "Relay-friendly survey template",
    address: "0x582fE72d288aF5621D1B4052D1164403825f7500",
    deployTx: "0x7c2757591c3128dbc0a1a064b2d9e5b30b6aeabd14e4c6f5b071519dd56c6114",
  },
  {
    label: "QuizLogic",
    note: "Trivia and scored-answer expansion template",
    address: "0x3BC74478c8F30208F79CF1DE3fEE79A40a96Eddf",
    deployTx: "0x20bc60795c8f6bbbd2e2d1c78f8219e8d039bc8e871c023e975066346d9c9a0d",
  },
  {
    label: "RaffleLogic",
    note: "Fan giveaway entry template with on-chain winner selection",
    address: "0x3e932167a611B26007B3A1106A1f79a89a7326d0",
    deployTx: "0x63e4d50220aa2893c7e78099700f5dc7e67363a75c3ec21b8d1c22eb35f66c1a",
  },
  {
    label: "BountyLogic",
    note: "Creator-curated challenge and winner finalization template",
    address: "0xb222Fd7C5bc0f07b344Cf7f9993C2C32C51E0074",
    deployTx: "0x7549d6133b5564a8e9b9f8dd8206c5a4304a5758ab916eccc0e89f011974e5b9",
  },
  {
    label: "FanPassLogic",
    note: "Tiered soulbound fan access pass template with supply caps",
    address: "0xf865A87C5B254108db24dc70b157862059d4f6C5",
    deployTx: "0x38042e6927f9a48f915ee4d0c8c78b65186951632a1c131c05495712b3fedac2",
  },
  {
    label: "PointsPoolLogic",
    note: "Reputation-weighted prediction pool template without custody",
    address: "0xBdC80710954d3b3482f3AEdd2C8Cb02692743708",
    deployTx: "0x78cf60e06d7257ab61e533995c7600468310a72b110da16f9a7abd5c35addceb",
  },
  {
    label: "TournamentLogic",
    note: "Multi-round bracket prediction template with cumulative scoring",
    address: "0x8eDa9899F81F4CA94b05Fde4C55a5DD567b485B5",
    deployTx: "0xf0fbc9f2f241ce7e398e6fddb0c0b7fa41e18d78da65d1602e5d5d528587a358",
  },
  {
    label: "AuctionLogic",
    note: "Pledge-based fan privilege auction template",
    address: "0x8D4B539ca32464aa2fA79c679Aa176a4a2e58929",
    deployTx: "0xcc7b48652217725e09ff163a02f53d384c012f27d77e067d24d7b95272d1bd45",
  },
];

const CAMPAIGNS = [
  {
    title: "the demo league Final 2026: Who will win?",
    template: "PredictionLogicV2",
    address: "0xdb2aFF6E8Bd6C45C55A07f69FEC18c119eb47e3c",
    deployTx: "0x80011cce4c98c13822226a4f1b1d453dfc1b69afe5b072cd9e06cdd6b0609c32",
    state: "REVEALED",
    stateColor: "bg-indigo-900 text-indigo-300",
  },
  {
    title: "the demo league Player of the Season 2026",
    template: "VotingLogicV2",
    address: "0xB677Ba75b479a06FF014B00f6f91391C3eE97Baf",
    deployTx: "0x472ee9cc98f155c1ab1ed0b93ebd5915a2159961de11f094d79e66c089c86c42",
    state: "OPEN",
    stateColor: "bg-emerald-900 text-emerald-300",
  },
  {
    title: "What was the best moment of the demo league 2026?",
    template: "SurveyLogic",
    address: "0x9Def9d04f9e64BB510b0Bb2CAdb2802A6Ee54Aab",
    deployTx: "0x014b7c2981e45d668a884cdc5a2f7e10a007ff4aa91599a8ade3242d5ba8707c",
    state: "CLOSED",
    stateColor: "bg-amber-900 text-amber-300",
  },
];

const LIFECYCLE_TXS = [
  {
    action: "closeCampaign",
    campaign: "Historical full lifecycle proof",
    tx: "0xc50c3d638250bf219b0a84a125e946ee2e68f12bd737549cbd1cbe8e002258d1",
  },
  {
    action: "revealResult",
    campaign: "Historical full lifecycle proof -> Northern Falcons",
    tx: "0x03f76a918c260c9c1ace0ca70091281f6e9271c33cd2e22a46ce5cf881fd9bd8",
  },
];

const JUDGING_MAP = [
  {
    criterion: "Smart contract security",
    evidence: "OpenZeppelin Initializable-based templates, explicit lifecycle states, creator attribution, and 262 contract tests.",
    verify: "Contracts + tests + proof records",
  },
  {
    criterion: "Reusability",
    evidence: "Factory-based clone deployment and three public V2 templates plus seven Phase 1 expansion templates reusable across campaign-style apps.",
    verify: "Builder, factory, proof page",
  },
  {
    criterion: "Usability / UI-UX",
    evidence: "Builder, explore, manage, profile, leaderboard, proof, and gas-sponsored participation all exist in one live app.",
    verify: "Route surfaces in production",
  },
  {
    criterion: "Gas and RPC discipline",
    evidence: "Gas sponsorship removes end-user chain friction and cache-backed view snapshots reduce repeated read pressure.",
    verify: "Relay flow + ops + cached views",
  },
  {
    criterion: "Real-world impact",
    evidence: "the demo league is the flagship demo because it proves a visible creator-fan-observer loop with real engagement behavior.",
    verify: "Live campaigns + profile + proof",
  },
  {
    criterion: "Code quality and proof",
    evidence: "Public repo, current addresses, lifecycle transactions, and proof surface all line up with the live deployment.",
    verify: "Repo + proof + explorer",
  },
];

function AddrCell({ value }: { value: string }) {
  return (
    <span className="font-mono text-xs text-slate-400">
      {value.slice(0, 10)}…{value.slice(-6)}
    </span>
  );
}

function ExplorerLink({ path, label }: { path: string; label: string }) {
  return (
    <a
      href={`${EXPLORER}/${path}`}
      target="_blank"
      rel="noopener noreferrer"
      className="text-xs px-2 py-0.5 bg-indigo-900 hover:bg-indigo-800 text-indigo-300 rounded transition-colors"
    >
      {label}
    </a>
  );
}

export default function ProofPage() {
  return (
    <main className="app-shell min-h-screen px-4 sm:px-6 py-10 sm:py-12">
      <div className="max-w-5xl mx-auto motion-surface">
        <PageHeader
          className="mb-10"
          eyebrow="Proof Surface"
          title="On-Chain Proof"
          description={<>This page is not just a contract list. It is the proof surface for the 10-template ChainForge AI deployment on <span className="text-slate-300 font-mono">WireFluid EVM · Chain ID 92533</span>.</>}
          meta={(
            <div className="glass max-w-sm rounded-2xl px-4 py-3 border border-white/8">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500 mb-1">Template registry</p>
              <p className="text-sm font-medium text-slate-200">10 app types registered on WireFluid</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">Prediction, vote, survey, quiz, raffle, bounty, fan pass, points pool, tournament, auction.</p>
            </div>
          )}
        />

        <section className="mb-10 grid gap-4 md:grid-cols-3">
          <div className="glass rounded-2xl border border-white/8 p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500 mb-2">Live contracts</p>
            <p className="text-3xl font-bold text-white">11</p>
            <p className="text-sm text-slate-400 mt-2">Factory plus three public V2 templates and seven Phase 1 expansion templates.</p>
          </div>
          <div className="glass rounded-2xl border border-white/8 p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500 mb-2">Live public campaigns</p>
            <p className="text-3xl font-bold text-white">3</p>
            <p className="text-sm text-slate-400 mt-2">All current public campaigns are compatible with gas-sponsored participation.</p>
          </div>
          <div className="glass rounded-2xl border border-white/8 p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500 mb-2">Contract validation</p>
            <p className="text-3xl font-bold text-white">262</p>
            <p className="text-sm text-slate-400 mt-2">Passing contract tests covering the public system and Phase 1 expansion templates.</p>
          </div>
        </section>

        <section className="mb-10">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2">How This Maps To Judging</h2>
            <p className="text-sm text-slate-500">The point of this page is to make the scoring criteria legible through product evidence, not private explanation.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {JUDGING_MAP.map((item) => (
              <div key={item.criterion} className="glass rounded-2xl border border-white/8 p-5">
                <h3 className="text-sm font-semibold text-white mb-2">{item.criterion}</h3>
                <p className="text-xs leading-relaxed text-slate-400 mb-3">{item.evidence}</p>
                <p className="text-[11px] uppercase tracking-[0.15em] text-indigo-300">Verify: {item.verify}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-10">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Current Contracts ({CONTRACTS.length})
          </h2>
          <div className="glass rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left px-4 py-3 text-slate-500 font-medium text-xs uppercase">Contract</th>
                  <th className="text-left px-4 py-3 text-slate-500 font-medium text-xs uppercase hidden md:table-cell">Address</th>
                  <th className="text-left px-4 py-3 text-slate-500 font-medium text-xs uppercase">Links</th>
                </tr>
              </thead>
              <tbody>
                {CONTRACTS.map((contract) => (
                  <tr key={contract.address} className="border-b border-slate-800/60 last:border-0">
                    <td className="px-4 py-3">
                      <p className="text-slate-200 font-medium text-sm">{contract.label}</p>
                      <p className="text-slate-500 text-xs mt-0.5">{contract.note}</p>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="flex items-center gap-2">
                        <AddrCell value={contract.address} />
                        <CopyButton text={contract.address} />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 flex-wrap">
                        <ExplorerLink path={`address/${contract.address}`} label="Contract" />
                        <ExplorerLink path={`tx/${contract.deployTx}`} label="Deploy Tx" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mb-10">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Current Seeded Campaigns ({CAMPAIGNS.length})
          </h2>
          <div className="glass rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left px-4 py-3 text-slate-500 font-medium text-xs uppercase">Campaign</th>
                  <th className="text-left px-4 py-3 text-slate-500 font-medium text-xs uppercase hidden md:table-cell">Address</th>
                  <th className="text-left px-4 py-3 text-slate-500 font-medium text-xs uppercase">Links</th>
                </tr>
              </thead>
              <tbody>
                {CAMPAIGNS.map((campaign) => (
                  <tr key={campaign.address} className="border-b border-slate-800/60 last:border-0">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className={`text-xs px-2 py-0.5 rounded font-medium ${campaign.stateColor}`}>
                          {campaign.state}
                        </span>
                        <span className="text-xs text-slate-500">{campaign.template}</span>
                      </div>
                      <p className="text-slate-200 text-sm">{campaign.title}</p>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="flex items-center gap-2">
                        <AddrCell value={campaign.address} />
                        <CopyButton text={campaign.address} />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 flex-wrap">
                        <ExplorerLink path={`address/${campaign.address}`} label="Contract" />
                        <ExplorerLink path={`tx/${campaign.deployTx}`} label="Deploy Tx" />
                        <a
                          href={`/campaigns/${campaign.address}`}
                          className="text-xs px-2 py-0.5 bg-emerald-900 hover:bg-emerald-800 text-emerald-300 rounded transition-colors"
                        >
                          App
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mb-10">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Historical Full Lifecycle Proof
          </h2>
          <div className="glass rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left px-4 py-3 text-slate-500 font-medium text-xs uppercase">Action</th>
                  <th className="text-left px-4 py-3 text-slate-500 font-medium text-xs uppercase hidden md:table-cell">Tx Hash</th>
                  <th className="text-left px-4 py-3 text-slate-500 font-medium text-xs uppercase">Link</th>
                </tr>
              </thead>
              <tbody>
                {LIFECYCLE_TXS.map((entry) => (
                  <tr key={entry.tx} className="border-b border-slate-800/60 last:border-0">
                    <td className="px-4 py-3">
                      <p className="text-slate-200 font-mono text-sm">{entry.action}</p>
                      <p className="text-slate-500 text-xs mt-0.5">{entry.campaign}</p>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="flex items-center gap-2">
                        <AddrCell value={entry.tx} />
                        <CopyButton text={entry.tx} />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <ExplorerLink path={`tx/${entry.tx}`} label="Tx" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Submission Summary
          </h2>
          <div className="glass rounded-xl px-4">
            {[
              {
                label: "Repository",
                value: "https://github.com/itxcrusher/chainforge-ai",
                href: "https://github.com/itxcrusher/chainforge-ai",
              },
              {
                label: "Live App",
                value: "https://chainforge-ai.vercel.app",
                href: "https://chainforge-ai.vercel.app",
              },
              {
                label: "Factory",
                value: "0x596FDe32DDde7e6e471adD72161F455429753c73",
                href: `${EXPLORER}/address/0x596FDe32DDde7e6e471adD72161F455429753c73`,
              },
              {
                label: "Current Product",
                value: "10-template dev registry; 3 public seeded campaigns",
                href: undefined,
              },
              {
                label: "Contract Tests",
                value: "262 / 262 passing",
                href: undefined,
              },
            ].map(({ label, value, href }) => (
              <div
                key={label}
                className="flex flex-col sm:flex-row sm:items-center gap-2 py-3 border-b border-slate-800 last:border-0"
              >
                <span className="text-slate-400 text-sm w-36 shrink-0">{label}</span>
                {href ? (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-xs text-indigo-400 hover:text-indigo-300 break-all"
                  >
                    {value}
                  </a>
                ) : (
                  <span className="font-mono text-xs text-slate-300 break-all">{value}</span>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
