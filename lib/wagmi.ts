import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { wirefluid } from "./contracts/clients";

export const wagmiConfig = createConfig({
  chains: [wirefluid],
  connectors: [injected()],
  transports: {
    [wirefluid.id]: http(
      process.env.NEXT_PUBLIC_WIREFLUID_RPC_URL ?? "https://evm.wirefluid.com"
    ),
  },
});
