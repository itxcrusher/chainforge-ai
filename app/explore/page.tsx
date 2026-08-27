import { getExploreCampaigns } from "@/lib/data/getCampaigns";
import ExploreClient from "./ExploreClient";

export const revalidate = 30; // ISR — revalidate every 30s

export default async function ExplorePage() {
  const initialCampaigns = await getExploreCampaigns().catch(() => []);
  return <ExploreClient initialCampaigns={initialCampaigns} />;
}
