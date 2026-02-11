const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { createWalletClient, createPublicClient, http, parseEther } = require("viem");
const { privateKeyToAccount } = require("viem/accounts");
const { baseSepolia } = require("viem/chains");

const PRIVATE_KEY = process.env.PRIVATE_KEY;
const BASESCAN_API_KEY = process.env.BASESCAN_API_KEY;

if (!PRIVATE_KEY) {
  console.error("PRIVATE_KEY not set");
  process.exit(1);
}

async function main() {
  console.log("Compiling ShadowReputation contract...");

  // Read contract source
  const contractPath = path.join(__dirname, "../contracts/src/ShadowReputation.sol");
  const contractSource = fs.readFileSync(contractPath, "utf8");

  // Read OpenZeppelin contracts
  const ozPath = path.join(__dirname, "../node_modules/@openzeppelin/contracts");

  // Create flattened contract
  const flattenedSource = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// OpenZeppelin Contracts
abstract contract Context {
    function _msgSender() internal view virtual returns (address) {
        return msg.sender;
    }
    function _msgData() internal view virtual returns (bytes calldata) {
        return msg.data;
    }
    function _contextSuffixLength() internal view virtual returns (uint256) {
        return 0;
    }
}

abstract contract Ownable is Context {
    address private _owner;
    error OwnableUnauthorizedAccount(address account);
    error OwnableInvalidOwner(address owner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    
    constructor(address initialOwner) {
        if (initialOwner == address(0)) revert OwnableInvalidOwner(address(0));
        _transferOwnership(initialOwner);
    }
    
    modifier onlyOwner() {
        _checkOwner();
        _;
    }
    
    function owner() public view virtual returns (address) {
        return _owner;
    }
    
    function _checkOwner() internal view virtual {
        if (owner() != _msgSender()) revert OwnableUnauthorizedAccount(_msgSender());
    }
    
    function renounceOwnership() public virtual onlyOwner {
        _transferOwnership(address(0));
    }
    
    function transferOwnership(address newOwner) public virtual onlyOwner {
        if (newOwner == address(0)) revert OwnableInvalidOwner(address(0));
        _transferOwnership(newOwner);
    }
    
    function _transferOwnership(address newOwner) internal virtual {
        address oldOwner = _owner;
        _owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
}

library ECDSA {
    error ECDSAInvalidSignature();
    error ECDSAInvalidSignatureLength(uint256 length);
    error ECDSAInvalidSignatureS(bytes32 s);
    
    function tryRecover(bytes32 hash, bytes memory signature) internal pure returns (address, bytes32, bytes32) {
        if (signature.length == 65) {
            bytes32 r;
            bytes32 s;
            uint8 v;
            assembly { r := mload(add(signature, 0x20)) s := mload(add(signature, 0x40)) v := byte(0, mload(add(signature, 0x60))) }
            return (ecrecover(hash, v, r, s), r, s);
        }
        return (address(0), 0, 0);
    }
    
    function recover(bytes32 hash, bytes memory signature) internal pure returns (address) {
        (address recovered,,) = tryRecover(hash, signature);
        if (recovered == address(0)) revert ECDSAInvalidSignature();
        return recovered;
    }
}

library MessageHashUtils {
    function toTypedDataHash(bytes32 domainSeparator, bytes32 structHash) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked("\\x19\\x01", domainSeparator, structHash));
    }
}

abstract contract EIP712 {
    bytes32 private constant TYPE_HASH = keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 private immutable _cachedDomainSeparator;
    uint256 private immutable _cachedChainId;
    address private immutable _cachedThis;
    bytes32 private immutable _hashedName;
    bytes32 private immutable _hashedVersion;
    string private _name;
    string private _version;
    
    constructor(string memory name_, string memory version_) {
        _name = name_;
        _version = version_;
        _hashedName = keccak256(bytes(name_));
        _hashedVersion = keccak256(bytes(version_));
        _cachedChainId = block.chainid;
        _cachedDomainSeparator = _buildDomainSeparator();
        _cachedThis = address(this);
    }
    
    function _domainSeparatorV4() internal view returns (bytes32) {
        if (address(this) == _cachedThis && block.chainid == _cachedChainId) {
            return _cachedDomainSeparator;
        }
        return _buildDomainSeparator();
    }
    
    function _buildDomainSeparator() private view returns (bytes32) {
        return keccak256(abi.encode(TYPE_HASH, _hashedName, _hashedVersion, block.chainid, address(this)));
    }
    
    function _hashTypedDataV4(bytes32 structHash) internal view virtual returns (bytes32) {
        return MessageHashUtils.toTypedDataHash(_domainSeparatorV4(), structHash);
    }
}

contract ShadowReputation is Ownable, EIP712 {
    using ECDSA for bytes32;
    
    event ResultClaimed(address indexed user, bytes32 indexed gameId, int16 repDelta, uint8 outcome);
    event SignerUpdated(address indexed oldSigner, address indexed newSigner);
    
    bytes32 public constant CLAIM_TYPEHASH = keccak256("ClaimResult(address user,bytes32 gameId,uint8 outcome,int16 repDelta,uint256 expiry)");
    
    address public signer;
    mapping(address => int256) public reputation;
    mapping(address => uint256) public gamesPlayed;
    mapping(address => uint256) public wins;
    mapping(bytes32 => mapping(address => bool)) public claimed;
    
    constructor(address _signer) Ownable(msg.sender) EIP712("ShadowReputation", "1") {
        signer = _signer;
    }
    
    function claimResult(bytes32 gameId, uint8 outcome, int16 repDelta, uint256 expiry, bytes calldata signature) external {
        require(block.timestamp <= expiry, "Claim expired");
        require(!claimed[gameId][msg.sender], "Already claimed");
        
        bytes32 structHash = keccak256(abi.encode(CLAIM_TYPEHASH, msg.sender, gameId, outcome, repDelta, expiry));
        bytes32 digest = _hashTypedDataV4(structHash);
        address recoveredSigner = ECDSA.recover(digest, signature);
        require(recoveredSigner == signer, "Invalid signature");
        
        claimed[gameId][msg.sender] = true;
        reputation[msg.sender] += repDelta;
        gamesPlayed[msg.sender]++;
        if (outcome == 1) wins[msg.sender]++;
        
        emit ResultClaimed(msg.sender, gameId, repDelta, outcome);
    }
    
    function getStats(address player) external view returns (int256 rep, uint256 games, uint256 winCount) {
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
        return _domainSeparatorV4();
    }
}
`;

  // Write flattened source
  const flatPath = path.join(__dirname, "../contracts/ShadowReputation.flat.sol");
  fs.writeFileSync(flatPath, flattenedSource);

  // Compile with solc
  const solcInput = {
    language: "Solidity",
    sources: {
      "ShadowReputation.sol": { content: flattenedSource },
    },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
    },
  };

  const inputPath = path.join(__dirname, "../contracts/solc-input.json");
  fs.writeFileSync(inputPath, JSON.stringify(solcInput));

  console.log("Running solc...");
  const output = execSync(`npx solc --standard-json < "${inputPath}"`, { encoding: "utf8" });
  const compiled = JSON.parse(output);

  if (compiled.errors?.some((e) => e.severity === "error")) {
    console.error("Compilation errors:", compiled.errors);
    process.exit(1);
  }

  const contract = compiled.contracts["ShadowReputation.sol"]["ShadowReputation"];
  const bytecode = "0x" + contract.evm.bytecode.object;
  const abi = contract.abi;

  console.log("Deploying to Base Sepolia...");

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

  // Check balance
  const balance = await publicClient.getBalance({ address: account.address });
  console.log("Balance:", balance.toString(), "wei");

  if (balance < parseEther("0.001")) {
    console.error("Insufficient balance. Fund your wallet at https://www.alchemy.com/faucets/base-sepolia");
    process.exit(1);
  }

  // Encode constructor args (signer = deployer)
  const { encodeAbiParameters } = require("viem");
  const constructorArgs = encodeAbiParameters(
    [{ type: "address" }],
    [account.address]
  );

  // Deploy
  const hash = await walletClient.deployContract({
    abi,
    bytecode,
    args: [account.address],
  });

  console.log("Deploy tx:", hash);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log("Contract deployed at:", receipt.contractAddress);

  // Save deployment info
  const deploymentInfo = {
    address: receipt.contractAddress,
    deployer: account.address,
    signer: account.address,
    txHash: hash,
    blockNumber: receipt.blockNumber.toString(),
    timestamp: new Date().toISOString(),
  };

  fs.writeFileSync(
    path.join(__dirname, "../deployment.json"),
    JSON.stringify(deploymentInfo, null, 2)
  );

  // Save ABI
  fs.writeFileSync(
    path.join(__dirname, "../src/lib/reputation-abi.json"),
    JSON.stringify(abi, null, 2)
  );

  console.log("\\nDeployment complete!");
  console.log("Contract:", receipt.contractAddress);
  console.log("\\nAdd to .env:");
  console.log(`NEXT_PUBLIC_CONTRACT_ADDRESS=${receipt.contractAddress}`);
  console.log(`SIGNER_PRIVATE_KEY=${PRIVATE_KEY}`);
}

main().catch(console.error);
