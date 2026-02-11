import { createConfig, http } from "wagmi";
import { baseSepolia, base } from "viem/chains";
import { injected } from "wagmi/connectors";

const isBase = process.env.NEXT_PUBLIC_CHAIN === "base";

export const config = isBase
  ? createConfig({
      chains: [base],
      transports: { [base.id]: http() },
      connectors: [injected()],
      ssr: true,
    })
  : createConfig({
      chains: [baseSepolia],
      transports: { [baseSepolia.id]: http() },
      connectors: [injected()],
      ssr: true,
    });
