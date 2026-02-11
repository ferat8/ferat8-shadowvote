const { createWalletClient, http } = require("viem");
const { privateKeyToAccount } = require("viem/accounts");
const { baseSepolia } = require("viem/chains");

const PRIVATE_KEY = process.env.PRIVATE_KEY;
const DOMAIN = process.env.DOMAIN || "shadowvote.vercel.app";

if (!PRIVATE_KEY) {
  console.error("Set PRIVATE_KEY env var");
  process.exit(1);
}

async function main() {
  const account = privateKeyToAccount(PRIVATE_KEY);

  const header = {
    fid: 0, // Will be filled by user
    type: "custody",
    key: account.address,
  };

  const payload = {
    domain: DOMAIN,
  };

  const headerB64 = Buffer.from(JSON.stringify(header)).toString("base64url");
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");

  const message = `${headerB64}.${payloadB64}`;

  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(),
  });

  const signature = await walletClient.signMessage({
    message,
  });

  console.log("\\nAccount Association for farcaster.json:\\n");
  console.log(JSON.stringify({
    header: headerB64,
    payload: payloadB64,
    signature: signature,
  }, null, 2));

  console.log("\\n\\nNote: Update the 'fid' in header with your actual Farcaster ID");
}

main().catch(console.error);
