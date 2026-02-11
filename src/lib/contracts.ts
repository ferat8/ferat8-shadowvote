export const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ||
  "0x0000000000000000000000000000000000000000") as `0x${string}`;

export const REPUTATION_ABI = [
  {
    type: "function",
    name: "claimResult",
    inputs: [
      { name: "gameId", type: "bytes32" },
      { name: "outcome", type: "uint8" },
      { name: "repDelta", type: "int16" },
      { name: "expiry", type: "uint256" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getStats",
    inputs: [{ name: "player", type: "address" }],
    outputs: [
      { name: "rep", type: "int256" },
      { name: "games", type: "uint256" },
      { name: "winCount", type: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "hasClaimed",
    inputs: [
      { name: "gameId", type: "bytes32" },
      { name: "player", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "reputation",
    inputs: [{ name: "player", type: "address" }],
    outputs: [{ name: "", type: "int256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "gamesPlayed",
    inputs: [{ name: "player", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "wins",
    inputs: [{ name: "player", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "ResultClaimed",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "gameId", type: "bytes32", indexed: true },
      { name: "repDelta", type: "int16", indexed: false },
      { name: "outcome", type: "uint8", indexed: false },
    ],
  },
] as const;

export function getContractConfig() {
  return {
    address: CONTRACT_ADDRESS,
    abi: REPUTATION_ABI,
  } as const;
}
