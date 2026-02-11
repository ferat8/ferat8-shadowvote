import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { privateKeyToAccount } from "viem/accounts";
import { encodePacked, keccak256, toBytes } from "viem";

export const dynamic = "force-dynamic";

const ACHIEVEMENTS_ADDRESS = process.env.NEXT_PUBLIC_ACHIEVEMENTS_ADDRESS || "";
const SIGNER_KEY = process.env.SIGNER_PRIVATE_KEY || "";

// POST - Generate achievement claim signature
export async function POST(req: NextRequest) {
  try {
    const { wallet, achievementId } = await req.json();

    if (!wallet || !achievementId) {
      return NextResponse.json({ error: "Wallet and achievementId required" }, { status: 400 });
    }

    const normalizedWallet = wallet.toLowerCase();

    // Check player stats to verify achievement eligibility
    const stats = await prisma.playerStats.findUnique({
      where: { wallet: normalizedWallet },
    });

    if (!stats) {
      return NextResponse.json({ error: "No stats found" }, { status: 400 });
    }

    // Check eligibility based on achievement
    let eligible = false;
    switch (achievementId) {
      case 1: // FIRST_BLOOD
        eligible = stats.killsAsImpostor >= 1;
        break;
      case 2: // SHERLOCK
        eligible = stats.correctDetects >= 3;
        break;
      case 3: // SURVIVOR
        eligible = stats.maxSurviveStreak >= 5;
        break;
      case 4: // SAVIOR
        eligible = stats.savesAsDoctor >= 3;
        break;
      case 5: // TRICKSTER
        eligible = stats.jesterWins >= 1;
        break;
      case 6: // LEADER
        eligible = stats.mayorWins >= 3;
        break;
      case 7: // PERFECT_GAME
        eligible = stats.gamesWon >= 10; // Simplified check
        break;
      case 8: // TOURNAMENT_WINNER
        // Check tournament wins
        const tournamentWins = await prisma.tournament.count({
          where: {
            status: "completed",
            matches: {
              some: {
                round: 1,
                winnerWallet: normalizedWallet,
              },
            },
          },
        });
        eligible = tournamentWins >= 1;
        break;
      default:
        return NextResponse.json({ error: "Invalid achievement" }, { status: 400 });
    }

    if (!eligible) {
      return NextResponse.json({ error: "Not eligible for this achievement" }, { status: 400 });
    }

    // Generate signature
    const expiry = Math.floor(Date.now() / 1000) + 3600; // 1 hour
    const chainId = 84532; // Base Sepolia

    const account = privateKeyToAccount(SIGNER_KEY as `0x${string}`);

    // EIP-712 domain
    const domainSeparator = keccak256(
      encodePacked(
        ["bytes32", "bytes32", "bytes32", "uint256", "address"],
        [
          keccak256(toBytes("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)")),
          keccak256(toBytes("ShadowVote Achievements")),
          keccak256(toBytes("1")),
          BigInt(chainId),
          ACHIEVEMENTS_ADDRESS as `0x${string}`,
        ]
      )
    );

    const MINT_TYPEHASH = keccak256(
      toBytes("MintAchievement(address player,uint256 achievementId,uint256 expiry)")
    );

    const structHash = keccak256(
      encodePacked(
        ["bytes32", "address", "uint256", "uint256"],
        [MINT_TYPEHASH, wallet as `0x${string}`, BigInt(achievementId), BigInt(expiry)]
      )
    );

    const digest = keccak256(
      encodePacked(["string", "bytes32", "bytes32"], ["\x19\x01", domainSeparator, structHash])
    );

    const signature = await account.signMessage({ message: { raw: toBytes(digest) } });

    return NextResponse.json({
      achievementId,
      expiry,
      signature,
      contractAddress: ACHIEVEMENTS_ADDRESS,
    });
  } catch (error) {
    console.error("Achievement claim error:", error);
    return NextResponse.json({ error: "Failed to generate claim" }, { status: 500 });
  }
}
