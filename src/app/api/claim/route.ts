import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createWalletClient, http, encodePacked, keccak256 } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

export const dynamic = "force-dynamic";

const SIGNER_PRIVATE_KEY = process.env.SIGNER_PRIVATE_KEY as `0x${string}`;
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`;

// EIP-712 domain
const domain = {
  name: "ShadowReputation",
  version: "1",
  chainId: 84532, // Base Sepolia
  verifyingContract: CONTRACT_ADDRESS,
};

const types = {
  ClaimResult: [
    { name: "user", type: "address" },
    { name: "gameId", type: "bytes32" },
    { name: "outcome", type: "uint8" },
    { name: "repDelta", type: "int16" },
    { name: "expiry", type: "uint256" },
  ],
};

export async function POST(req: NextRequest) {
  try {
    const { wallet, gameId } = await req.json();

    if (!wallet || !gameId) {
      return NextResponse.json({ error: "Missing wallet or gameId" }, { status: 400 });
    }

    if (!SIGNER_PRIVATE_KEY) {
      return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    const normalizedWallet = wallet.toLowerCase() as `0x${string}`;

    // Check if already claimed
    const existingClaim = await prisma.claimLog.findUnique({
      where: {
        gameId_wallet: {
          gameId,
          wallet: normalizedWallet,
        },
      },
    });

    if (existingClaim) {
      return NextResponse.json({ error: "Already claimed" }, { status: 400 });
    }

    // Find game result
    const gameResult = await prisma.gameResult.findUnique({
      where: { gameId },
    });

    if (!gameResult) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    // Find player result
    const playerResults = JSON.parse(gameResult.playerResults) as Array<{
      wallet: string;
      role: string;
      won: boolean;
      repDelta: number;
    }>;

    const playerResult = playerResults.find(
      (p) => p.wallet.toLowerCase() === normalizedWallet
    );

    if (!playerResult) {
      return NextResponse.json({ error: "Player not in game" }, { status: 404 });
    }

    // Prepare claim data
    const outcome = playerResult.won ? 1 : 0; // 1=win, 0=loss
    const repDelta = playerResult.repDelta;
    const expiry = BigInt(Math.floor(Date.now() / 1000) + 86400); // 24 hours

    // Sign the claim
    const account = privateKeyToAccount(SIGNER_PRIVATE_KEY);
    const walletClient = createWalletClient({
      account,
      chain: baseSepolia,
      transport: http(),
    });

    const signature = await walletClient.signTypedData({
      domain,
      types,
      primaryType: "ClaimResult",
      message: {
        user: normalizedWallet,
        gameId: gameId as `0x${string}`,
        outcome,
        repDelta,
        expiry,
      },
    });

    // Log the claim request (not yet confirmed onchain)
    await prisma.claimLog.create({
      data: {
        gameId,
        wallet: normalizedWallet,
      },
    });

    return NextResponse.json({
      gameId,
      outcome,
      repDelta,
      expiry: expiry.toString(),
      signature,
      playerResult: {
        role: playerResult.role,
        won: playerResult.won,
      },
    });
  } catch (error) {
    console.error("Claim error:", error);
    return NextResponse.json({ error: "Failed to generate claim" }, { status: 500 });
  }
}
