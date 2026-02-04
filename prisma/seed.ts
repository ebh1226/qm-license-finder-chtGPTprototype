import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.upsert({
    where: { email: "beta@local" },
    update: {},
    create: { email: "beta@local" },
    select: { id: true },
  });

  const project = await prisma.project.create({
    data: {
      ownerId: user.id,
      name: "Anchor Scenario — Premium Outdoor → Home Goods",
      brandCategory: "Premium outdoor lifestyle brand (Yeti/Patagonia aesthetic)",
      productTypeSought: "Drinkware, coolers, outdoor entertaining accessories",
      priceRange: "$40–$150",
      distributionPreference: "REI, independent outdoor retailers, upscale home goods boutiques (not mass market)",
      geography: "US + Canada",
      positioningKeywords: "premium, design-led, durable, outdoor entertaining",
      constraints: "Avoid mass-market dominated partners; prioritize quality/reputation",
      excludeList: "Yeti\nPatagonia\nThe North Face\nHydro Flask\nStanley 1913\nColeman\nIgloo",
    },
    select: { id: true },
  });

  const candidates = [
    { name: "MiiR", website: "https://www.miir.com", notes: "Premium drinkware; collaborations." },
    { name: "GSI Outdoors", website: "https://www.gsioutdoors.com", notes: "Camp kitchen + drinkware adjacency." },
    { name: "Snow Peak", website: "https://www.snowpeak.com", notes: "Premium outdoor lifestyle adjacency." },
    { name: "Klean Kanteen", website: "https://www.kleankanteen.com", notes: "Quality reputation; premium positioning." },
    { name: "Sea to Summit", website: "https://seatosummit.com", notes: "Outdoor accessory manufacturing capability." },
    { name: "W&P", website: "https://wandp.com", notes: "Premium home goods; outdoor entertaining adjacency." },
    { name: "Stojo", website: "https://www.stojo.co", notes: "Reusable drinkware; potential licensing openness." },
    { name: "S'well", website: "https://www.swell.com", notes: "Premium drinkware; home channel adjacency." },
    { name: "OXO", website: "https://www.oxo.com", notes: "Quality home goods; scale/channel risk—verify." },
    { name: "Stanley 1913", website: "https://www.stanley1913.com", notes: "Large/obvious—often excluded." },
  ];

  const created = [] as Array<{ id: string; name: string }>;
  for (const c of candidates) {
    const cand = await prisma.candidate.create({
      data: {
        projectId: project.id,
        name: c.name,
        website: c.website,
        notes: c.notes,
        provenance: "generated",
      },
      select: { id: true, name: true },
    });
    created.push(cand);
  }

  // Pre-seed scorecards for a fast demo. Proof points are intentionally labeled as to_verify (no evidence links).
  const aTierNames = new Set(["MiiR", "GSI Outdoors", "Snow Peak", "Klean Kanteen", "Sea to Summit"]);

  for (const c of created) {
    const tier = aTierNames.has(c.name) ? "A" : c.name === "Stanley 1913" ? "C" : "B";

    const base = {
      criterionScores: {
        categoryFit: tier === "C" ? 2 : tier === "A" ? 4 : 3,
        distributionAlignment: tier === "C" ? 2 : tier === "A" ? 4 : 3,
        licensingActivity: 3,
        scaleAppropriateness: tier === "C" ? 2 : 3,
        qualityReputation: tier === "C" ? 2 : tier === "A" ? 4 : 3,
        geoCoverage: 4,
        recentMomentum: 3,
        manufacturingCapability: tier === "A" ? 4 : 3,
      },
      disqualifiers: tier === "C" ? ["Distribution mismatch risk / giant-brand saturation"] : [],
      flags: ["Verify specialty retail mix", "Confirm openness to third-party licensing"],
      rationaleBullets: [
        "Strong adjacency to requested expansion: premium drinkware / outdoor entertaining aligns with home goods",
        "Positioning appears compatible with $40–$150 band (verify SKU-level pricing)",
        "Likely fits specialty-first distribution (verify channel mix; avoid mass-market skew)",
        "Manufacturing capability likely supports hardgoods/accessories with quality expectations",
      ],
      proofPoints: [
        { text: "Check press/news pages for brand collaborations or licensing mentions", supportType: "to_verify", url: null },
        { text: "Confirm presence in REI / specialty outdoor retailers (store locator / wholesale page)", supportType: "to_verify", url: null },
      ],
      confidence: "Medium",
      nextStep: "Warm intro if possible; otherwise targeted cold outreach to Partnerships/Licensing lead",
    };

    // totalScore is computed client-side normally; keep a reasonable seed value.
    const totalScore = tier === "A" ? 82.5 : tier === "B" ? 71.0 : 48.0;

    await prisma.scoreCard.create({
      data: {
        candidateId: c.id,
        weightsJson: JSON.stringify({
          categoryFit: 0.3,
          distributionAlignment: 0.3,
          licensingActivity: 0.2,
          scaleAppropriateness: 0.04,
          qualityReputation: 0.04,
          geoCoverage: 0.04,
          recentMomentum: 0.04,
          manufacturingCapability: 0.04,
        }),
        criteriaJson: JSON.stringify(base.criterionScores),
        totalScore,
        tier: tier as any,
        confidence: base.confidence as any,
        rationaleJson: JSON.stringify(base.rationaleBullets),
        proofPointsJson: JSON.stringify(base.proofPoints),
        flagsJson: JSON.stringify(base.flags),
        disqualifiersJson: JSON.stringify(base.disqualifiers),
        nextStep: base.nextStep,
      },
    });

    if (tier === "A") {
      await prisma.outreachDraft.create({
        data: {
          candidateId: c.id,
          tonePreset: "warm_professional",
          subject: "Exploring a premium outdoor-home goods licensing fit",
          body:
            "Hi [Name],\n\nI run licensing strategy for a premium outdoor lifestyle brand expanding into home goods (drinkware, coolers, outdoor entertaining accessories) in the $40–$150 range, with a specialty-first channel focus (REI, independent outdoor retailers, and upscale home-goods boutiques).\n\nYour team’s product and brand positioning looks like a strong adjacency for a selective licensing partnership. [PLACEHOLDER: insert 1–2 concrete proof points once verified].\n\nWould you be open to a short exploratory call to see if there’s a mutual fit and to understand your preferred partnership model?\n\nBest,\n[Your Name]",
        },
      });
    }
  }

  console.log(`Seeded project ${project.id} with ${created.length} candidates.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
