const fs = require("fs");
const path = require("path");
const solc = require("solc");
const { createWalletClient, createPublicClient, http, parseEther, encodeAbiParameters } = require("viem");
const { privateKeyToAccount } = require("viem/accounts");
const { baseSepolia } = require("viem/chains");

const PRIVATE_KEY = process.env.PRIVATE_KEY;

if (!PRIVATE_KEY) {
  console.error("PRIVATE_KEY not set");
  process.exit(1);
}

const SOURCE = fs.readFileSync(
  path.join(__dirname, "../contracts/src/ShadowAchievements.sol"),
  "utf8"
);

async function main() {
  console.log("Compiling ShadowAchievements...");

  const input = {
    language: "Solidity",
    sources: {
      "ShadowAchievements.sol": { content: SOURCE }
    },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: {
        "*": { "*": ["abi", "evm.bytecode.object"] }
      }
    }
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  
  if (output.errors) {
    const errors = output.errors.filter(e => e.severity === "error");
    if (errors.length > 0) {
      console.error("Compilation errors:", errors);
      process.exit(1);
    }
  }

  const contract = output.contracts["ShadowAchievements.sol"]["ShadowAchievements"];
  const abi = contract.abi;
  const bytecode = "0x" + contract.evm.bytecode.object;

  console.log("Compilation successful!");
  console.log("Bytecode size:", bytecode.length / 2, "bytes");

  // Deploy
  console.log("\nDeploying to Base Sepolia...");

  const account = privateKeyToAccount(PRIVATE_KEY);
  console.log("Deployer:", account.address);

  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http("https://sepolia.base.org"),
  });

  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http("https://sepolia.base.org"),
  });

  const balance = await publicClient.getBalance({ address: account.address });
  console.log("Balance:", (Number(balance) / 1e18).toFixed(6), "ETH");

  if (balance < parseEther("0.001")) {
    console.error("Insufficient balance. Fund at https://www.alchemy.com/faucets/base-sepolia");
    console.log("Address:", account.address);
    process.exit(1);
  }

  // Encode constructor args (signer = deployer)
  const constructorArgs = encodeAbiParameters(
    [{ type: "address" }],
    [account.address]
  );
  
  const deployData = bytecode + constructorArgs.slice(2);

  console.log("Sending deployment transaction...");
  const hash = await walletClient.sendTransaction({
    data: deployData,
  });

  console.log("Tx hash:", hash);
  console.log("Waiting for confirmation...");

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  
  if (!receipt.contractAddress) {
    console.error("Deployment failed");
    process.exit(1);
  }
  
  console.log("\n=== Deployment Successful ===");
  console.log("Contract:", receipt.contractAddress);
  console.log("Block:", receipt.blockNumber.toString());

  // Save files
  const deploymentInfo = {
    address: receipt.contractAddress,
    deployer: account.address,
    signer: account.address,
    txHash: hash,
    blockNumber: receipt.blockNumber.toString(),
    timestamp: new Date().toISOString(),
    chainId: 84532,
  };

  fs.writeFileSync(
    path.join(__dirname, "../achievements-deployment.json"),
    JSON.stringify(deploymentInfo, null, 2)
  );

  fs.writeFileSync(
    path.join(__dirname, "../src/lib/achievements-abi.json"),
    JSON.stringify(abi, null, 2)
  );

  console.log("\nAdd to .env:");
  console.log(`NEXT_PUBLIC_ACHIEVEMENTS_ADDRESS=${receipt.contractAddress}`);
}

main().catch(console.error);
