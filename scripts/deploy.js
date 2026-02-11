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

// Flattened contract source
const SOURCE = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract ShadowReputation {
    event ResultClaimed(address indexed user, bytes32 indexed gameId, int16 repDelta, uint8 outcome);
    event SignerUpdated(address indexed oldSigner, address indexed newSigner);
    
    bytes32 public constant CLAIM_TYPEHASH = keccak256("ClaimResult(address user,bytes32 gameId,uint8 outcome,int16 repDelta,uint256 expiry)");
    
    address public owner;
    address public signer;
    string public name = "ShadowReputation";
    string public version = "1";
    
    mapping(address => int256) public reputation;
    mapping(address => uint256) public gamesPlayed;
    mapping(address => uint256) public wins;
    mapping(bytes32 => mapping(address => bool)) public claimed;
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
    
    constructor(address _signer) {
        owner = msg.sender;
        signer = _signer;
    }
    
    function claimResult(
        bytes32 gameId,
        uint8 outcome,
        int16 repDelta,
        uint256 expiry,
        bytes calldata signature
    ) external {
        require(block.timestamp <= expiry, "Claim expired");
        require(!claimed[gameId][msg.sender], "Already claimed");
        
        bytes32 domainSeparator = keccak256(abi.encode(
            keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
            keccak256(bytes(name)),
            keccak256(bytes(version)),
            block.chainid,
            address(this)
        ));
        
        bytes32 structHash = keccak256(abi.encode(
            CLAIM_TYPEHASH,
            msg.sender,
            gameId,
            outcome,
            repDelta,
            expiry
        ));
        
        bytes32 digest = keccak256(abi.encodePacked("\\x19\\x01", domainSeparator, structHash));
        
        require(signature.length == 65, "Invalid sig length");
        bytes32 r; bytes32 s; uint8 v;
        assembly {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 32))
            v := byte(0, calldataload(add(signature.offset, 64)))
        }
        
        address recovered = ecrecover(digest, v, r, s);
        require(recovered == signer, "Invalid signature");
        
        claimed[gameId][msg.sender] = true;
        reputation[msg.sender] += repDelta;
        gamesPlayed[msg.sender]++;
        if (outcome == 1) wins[msg.sender]++;
        
        emit ResultClaimed(msg.sender, gameId, repDelta, outcome);
    }
    
    function getStats(address player) external view returns (int256, uint256, uint256) {
        return (reputation[player], gamesPlayed[player], wins[player]);
    }
    
    function hasClaimed(bytes32 gameId, address player) external view returns (bool) {
        return claimed[gameId][player];
    }
    
    function setSigner(address _signer) external onlyOwner {
        emit SignerUpdated(signer, _signer);
        signer = _signer;
    }
    
    function DOMAIN_SEPARATOR() external view returns (bytes32) {
        return keccak256(abi.encode(
            keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
            keccak256(bytes(name)),
            keccak256(bytes(version)),
            block.chainid,
            address(this)
        ));
    }
}`;

async function main() {
  console.log("Compiling ShadowReputation...");

  const input = {
    language: "Solidity",
    sources: {
      "ShadowReputation.sol": { content: SOURCE }
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

  const contract = output.contracts["ShadowReputation.sol"]["ShadowReputation"];
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

  // Encode constructor args
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
    path.join(__dirname, "../deployment.json"),
    JSON.stringify(deploymentInfo, null, 2)
  );

  fs.writeFileSync(
    path.join(__dirname, "../src/lib/reputation-abi.json"),
    JSON.stringify(abi, null, 2)
  );

  fs.writeFileSync(
    path.join(__dirname, "../contracts/ShadowReputation.verified.sol"),
    SOURCE
  );

  console.log("\nAdd to .env:");
  console.log(`NEXT_PUBLIC_CONTRACT_ADDRESS=${receipt.contractAddress}`);
  console.log(`SIGNER_PRIVATE_KEY=${PRIVATE_KEY}`);
}

main().catch(console.error);
