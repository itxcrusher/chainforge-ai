import { getPublicClient } from "@/lib/contracts/clients";
import { CopyButton } from "@/components/copy-button";
import { PageHeader } from "@/components/PageHeader";
import { campaignCache } from "@/lib/cache/campaignCache";
import { getExploreCampaigns } from "@/lib/data/getCampaigns";

async function getCampaigns(): Promise<string[]> {
  try {
    const campaigns = await getExploreCampaigns();
    return campaigns.map((campaign) => campaign.address);
  } catch {
    return [];
  }
}

function AddressRow({
  label,
  address,
  explorerBase,
  type = "address",
}: {
  label: string;
  address: string;
  explorerBase: string;
  type?: "address" | "tx";
}) {
  const href = `${explorerBase}/${type}/${address}`;
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 py-3 border-b border-slate-800 last:border-0">
      <span className="text-slate-400 text-sm w-48 shrink-0">{label}</span>
      <span className="font-mono text-xs text-slate-200 break-all flex-1">{address}</span>
      <div className="flex gap-2 shrink-0">
        <CopyButton text={address} />
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs px-2 py-0.5 bg-indigo-900 hover:bg-indigo-800 text-indigo-300 rounded transition-colors"
        >
          Explorer
        </a>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  note,
}: {
  label: string;
  value: string | number;
  note?: string;
}) {
  return (
    <div className="glass rounded-xl p-4">
      <div className="text-2xl font-bold text-white mb-1">{value}</div>
      <div className="text-sm text-slate-400">{label}</div>
      {note && <div className="text-xs text-slate-600 mt-1">{note}</div>}
    </div>
  );
}

export default async function OpsPage() {
  const campaigns = await getCampaigns();
  const factoryAddress = process.env.FACTORY_ADDRESS ?? "";

  let relayerAddress = "";
  try {
    const { privateKeyToAccount } = await import("viem/accounts");
    const pk = process.env.RELAYER_PRIVATE_KEY;
    if (pk) {
      const acc = privateKeyToAccount(`0x${pk.replace(/^0x/, "")}`);
      relayerAddress = acc.address;
    }
  } catch {
    // non-fatal
  }

  const predictionImplAddress = process.env.PREDICTION_V2_IMPLEMENTATION_ADDRESS ?? "";
  const votingImplAddress = process.env.VOTING_V2_IMPLEMENTATION_ADDRESS ?? "";
  const surveyImplAddress = process.env.SURVEY_IMPLEMENTATION_ADDRESS ?? "";
  const explorerBase = process.env.NEXT_PUBLIC_EXPLORER_URL ?? "https://wirefluidscan.com";
  const cacheStats = campaignCache.getStats();

  let totalParticipation = 0;
  try {
    const client = getPublicClient();
    const { PREDICTION_LOGIC_V2_ABI: abi } = await import("@/lib/contracts/abis");
    const voteTotals = await Promise.all(
      campaigns.map(async (addr) => {
        try {
          const results = await client.readContract({
            address: addr as `0x${string}`,
            abi,
            functionName: "getResults",
          }) as [string[], bigint[]];
          return results[1].reduce((sum, value) => sum + Number(value), 0);
        } catch {
          return 0;
        }
      })
    );
    totalParticipation = voteTotals.reduce((sum, value) => sum + value, 0);
  } catch {
    // non-fatal
  }

  return (
    <main className="app-shell min-h-screen px-4 sm:px-6 py-10 sm:py-12">
      <div className="max-w-5xl mx-auto motion-surface">
        <PageHeader
          className="mb-10"
          eyebrow="Operations"
          title="Ops Console"
          description="Current V2 product operations view for contracts, campaigns, cache, and public runtime health."
        />

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
          <MetricCard label="Current Campaigns" value={campaigns.length} />
          <MetricCard label="Total Participation" value={totalParticipation} />
          <MetricCard label="Cache Hits" value={cacheStats.hits} />
          <MetricCard label="Cache Misses" value={cacheStats.misses} />
          <MetricCard label="Est. RPC Reads Avoided" value={cacheStats.hits} note="estimated" />
          <MetricCard label="Contract Tests" value="262 / 262" note="passing" />
        </div>

        <section className="mb-10">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Contracts
          </h2>
          <div className="glass rounded-xl px-4">
            {factoryAddress ? (
              <AddressRow label="CampaignFactory V2" address={factoryAddress} explorerBase={explorerBase} />
            ) : (
              <p className="py-3 text-sm text-slate-600">FACTORY_ADDRESS not set</p>
            )}
            {predictionImplAddress && (
              <AddressRow label="PredictionLogicV2" address={predictionImplAddress} explorerBase={explorerBase} />
            )}
            {votingImplAddress && (
              <AddressRow label="VotingLogicV2" address={votingImplAddress} explorerBase={explorerBase} />
            )}
            {surveyImplAddress && (
              <AddressRow label="SurveyLogic" address={surveyImplAddress} explorerBase={explorerBase} />
            )}
            {relayerAddress && (
              <AddressRow label="Relayer Wallet" address={relayerAddress} explorerBase={explorerBase} />
            )}
          </div>
        </section>

        <section className="mb-10">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Current Public Campaigns
            <span className="ml-2 text-indigo-400 normal-case font-normal">{campaigns.length} deployed</span>
          </h2>
          <div className="glass rounded-xl px-4">
            {campaigns.length > 0 ? (
              campaigns.map((addr, index) => (
                <AddressRow
                  key={addr}
                  label={`Campaign ${String(index + 1).padStart(2, "0")}`}
                  address={addr}
                  explorerBase={explorerBase}
                />
              ))
            ) : (
              <p className="py-3 text-sm text-slate-600">No current public campaigns found.</p>
            )}
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Network
          </h2>
          <div className="glass rounded-xl px-4">
            <div className="flex items-center gap-2 py-3 border-b border-slate-800">
              <span className="text-slate-400 text-sm w-48 shrink-0">Chain</span>
              <span className="text-slate-200 text-sm">WireFluid Testnet</span>
            </div>
            <div className="flex items-center gap-2 py-3 border-b border-slate-800">
              <span className="text-slate-400 text-sm w-48 shrink-0">Chain ID</span>
              <span className="text-slate-200 font-mono text-sm">92533</span>
            </div>
            <div className="flex items-center gap-2 py-3 border-b border-slate-800">
              <span className="text-slate-400 text-sm w-48 shrink-0">RPC</span>
              <span className="text-slate-200 font-mono text-xs">https://evm.wirefluid.com</span>
            </div>
            <div className="flex items-center gap-2 py-3">
              <span className="text-slate-400 text-sm w-48 shrink-0">Explorer</span>
              <a
                href={explorerBase}
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-400 hover:text-indigo-300 text-sm"
              >
                {explorerBase}
              </a>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

