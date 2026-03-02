import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { getDriver } from "../src/lib/neo4j";

const BOT_NAMES = [
  "RockSolid",
  "PaperThin",
  "ScissorHands",
  "StoneCold",
  "GraniteGrip",
  "BoulderDash",
  "RockSlide",
  "PebbleKick",
  "CrystalFist",
  "QuartzKnuckle",
  "ScrollMaster",
  "PaperCut",
  "OrigamiKing",
  "FoldedFate",
  "InkBlot",
  "ParchmentPro",
  "RolledUp",
  "SheetMetal",
  "BlankPage",
  "NewsFlash",
  "BladeRunner",
  "ClipClap",
  "SharpEdge",
  "SnipSnap",
  "CutThroat",
  "SliceDice",
  "TrimTech",
  "EdgeLord",
  "NickOfTime",
  "SplitSecond",
  "ThrowDown",
  "QuickDraw",
  "IronFist",
  "GlassJaw",
  "SteelTrap",
  "VenomStrike",
  "PhantomFist",
  "CobraClutch",
  "NeonNinja",
  "GhostGrip",
  "FrostBite",
  "ThunderClap",
  "StormBreaker",
  "LightningRod",
  "VortexPunch",
  "ChaosTheory",
  "NullPointer",
  "ByteBrawler",
  "GlitchKing",
  "PixelPuncher",
];

async function seedBots() {
  const driver = getDriver();
  const session = driver.session({ database: "neo4j" });

  for (const name of BOT_NAMES) {
    const uid = `bot_${name.toLowerCase()}`;
    await session.executeWrite((tx) =>
      tx.run(`
        MERGE (p:Player {uid: $uid})
        ON CREATE SET
          p.username = $username,
          p.rating = $rating,
          p.isBot = true,
          p.created = datetime(),
          p.lastSeen = datetime()
      `, {
        uid,
        username: name,
        rating: 800 + Math.floor(Math.random() * 600), // spread 800–1400
      }),
    );
    console.log(`Created bot: ${name}`);
  }

  await session.close();
  driver.close();
}

seedBots();