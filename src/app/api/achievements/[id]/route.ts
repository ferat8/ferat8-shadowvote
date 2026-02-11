import { NextRequest, NextResponse } from "next/server";
import { ACHIEVEMENTS } from "@/lib/game/types";

export const dynamic = "force-dynamic";

// GET - Achievement metadata (for NFT)
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const achievementId = parseInt(params.id);
  
  const achievementMap: Record<number, { name: string; description: string; image: string }> = {
    1: { 
      name: ACHIEVEMENTS.FIRST_BLOOD.name, 
      description: ACHIEVEMENTS.FIRST_BLOOD.description,
      image: "https://shadowvote-beta.vercel.app/achievements/first-blood.png"
    },
    2: { 
      name: ACHIEVEMENTS.SHERLOCK.name, 
      description: ACHIEVEMENTS.SHERLOCK.description,
      image: "https://shadowvote-beta.vercel.app/achievements/sherlock.png"
    },
    3: { 
      name: ACHIEVEMENTS.SURVIVOR.name, 
      description: ACHIEVEMENTS.SURVIVOR.description,
      image: "https://shadowvote-beta.vercel.app/achievements/survivor.png"
    },
    4: { 
      name: ACHIEVEMENTS.SAVIOR.name, 
      description: ACHIEVEMENTS.SAVIOR.description,
      image: "https://shadowvote-beta.vercel.app/achievements/savior.png"
    },
    5: { 
      name: ACHIEVEMENTS.TRICKSTER.name, 
      description: ACHIEVEMENTS.TRICKSTER.description,
      image: "https://shadowvote-beta.vercel.app/achievements/trickster.png"
    },
    6: { 
      name: ACHIEVEMENTS.LEADER.name, 
      description: ACHIEVEMENTS.LEADER.description,
      image: "https://shadowvote-beta.vercel.app/achievements/leader.png"
    },
    7: { 
      name: ACHIEVEMENTS.PERFECT_GAME.name, 
      description: ACHIEVEMENTS.PERFECT_GAME.description,
      image: "https://shadowvote-beta.vercel.app/achievements/perfect-game.png"
    },
    8: { 
      name: ACHIEVEMENTS.TOURNAMENT_WINNER.name, 
      description: ACHIEVEMENTS.TOURNAMENT_WINNER.description,
      image: "https://shadowvote-beta.vercel.app/achievements/champion.png"
    },
  };

  const achievement = achievementMap[achievementId];
  if (!achievement) {
    return NextResponse.json({ error: "Achievement not found" }, { status: 404 });
  }

  // Return NFT metadata format
  return NextResponse.json({
    name: achievement.name,
    description: achievement.description,
    image: achievement.image,
    attributes: [
      { trait_type: "Rarity", value: achievementId <= 4 ? "Common" : "Rare" },
      { trait_type: "Category", value: "Achievement" },
    ],
  });
}
