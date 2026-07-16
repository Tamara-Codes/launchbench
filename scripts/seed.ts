import { eq } from "drizzle-orm";
import { createConnection } from "../src/db/connect";
import {
  agents,
  agentPromptVersions,
  appSettings,
  emailTemplates,
  followUpRules,
  gmailConnection,
  products,
  productSocialStrategies,
  territories,
} from "../src/db/schema";
import {
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_TASK_TEMPLATE,
} from "../src/agents/lead-finder/prompts";
import {
  DEFAULT_SOCIAL_SYSTEM_PROMPT,
  DEFAULT_SOCIAL_TASK_TEMPLATE,
} from "../src/agents/social-content/prompts";

const { db, sqlite } = createConnection();

function log(msg: string) {
  console.log(`  ${msg}`);
}

async function seedAgent() {
  const existing = db.select().from(agents).where(eq(agents.slug, "accommodation-lead-finder")).all();
  if (existing.length) {
    db.update(agents).set({ name: "Sales Agent" }).where(eq(agents.id, existing[0]!.id)).run();
    log("Sales Agent already present — renamed");
    return;
  }
  const [agent] = db
    .insert(agents)
    .values({
      name: "Sales Agent",
      slug: "accommodation-lead-finder",
      description:
        "Finds new, qualified, contactable tourist-accommodation leads in a selected town.",
      agentType: "lead_finder",
      enabled: true,
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
      taskPromptTemplate: DEFAULT_TASK_TEMPLATE,
      model: "gemini-3.5-flash",
      temperature: 0.2,
      maxOutputTokens: 2048,
      configuration: {},
    })
    .returning()
    .all();
  db.insert(agentPromptVersions)
    .values({
      agentId: agent!.id,
      version: 1,
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
      taskPromptTemplate: DEFAULT_TASK_TEMPLATE,
      model: "gemini-3.5-flash",
      temperature: 0.2,
      maxOutputTokens: 2048,
      note: "Seed default prompt",
    })
    .run();
  log("agent + prompt v1 seeded");
}

async function seedSocialContentAgent() {
  const existing = db.select().from(agents).where(eq(agents.slug, "social-content-agent")).all();
  if (existing.length) {
    db.update(agents).set({ name: "Content Agent" }).where(eq(agents.id, existing[0]!.id)).run();
    log("Content Agent already present — renamed");
    return;
  }
  const [agent] = db.insert(agents).values({
    name: "Content Agent",
    slug: "social-content-agent",
    description: "Creates truthful, product-aware social content and visual directions for manual publishing.",
    agentType: "content_creator",
    enabled: true,
    systemPrompt: DEFAULT_SOCIAL_SYSTEM_PROMPT,
    taskPromptTemplate: DEFAULT_SOCIAL_TASK_TEMPLATE,
    model: "gemini-3.5-flash",
    temperature: 0.7,
    maxOutputTokens: 2400,
    configuration: { provider: "gemini", imageProvider: "gemini", defaultPlatform: "instagram", cadenceDays: 2 },
  }).returning().all();
  db.insert(agentPromptVersions).values({
    agentId: agent!.id,
    version: 1,
    systemPrompt: DEFAULT_SOCIAL_SYSTEM_PROMPT,
    taskPromptTemplate: DEFAULT_SOCIAL_TASK_TEMPLATE,
      model: "gemini-3.5-flash",
    temperature: 0.7,
    maxOutputTokens: 2400,
    note: "Seed default prompt",
  }).run();
  log("Content Agent + prompt v1 seeded");
}

async function seedProduct() {
  const existing = db.select().from(products).where(eq(products.name, "Digital Guest Welcome Book")).all();
  if (!existing.length) {
    db.insert(products).values({
      name: "Digital Guest Welcome Book",
      shortDescription:
        "A digital guest guide apartment owners share via QR code or link.",
      fullDescription:
        "A digital guest guide for apartment owners. Guests open it through a QR code or link and can see Wi-Fi information, house rules, check-in instructions, local recommendations, beaches, restaurants, pharmacies and other practical information.",
      targetCustomer:
        "Private apartment owners, villas, holiday homes, guest houses, small accommodation businesses and local accommodation agencies.",
      coreBenefit:
        "The host avoids repeatedly answering the same guest questions and gives guests a more professional experience.",
      priceText: "",
      demoUrl: "",
      websiteUrl: "",
      emailGenerationContext:
        "Offer a digital welcome book that reduces repetitive guest questions and improves the guest experience. Keep the tone professional and concrete. Never claim to have visited or stayed at the property.",
      active: true,
    }).run();
    log("Digital Guest Welcome Book seeded");
  }
  const mastograd = db.select().from(products).where(eq(products.name, "Maštograd")).all();
  if (!mastograd.length) {
    db.insert(products).values({
      name: "Maštograd",
      shortDescription: "Personalized educational gifts and activity products for children.",
      fullDescription: "Maštograd creates physical, personalized activity products for children, including Moja prva abeceda, Moji prvi brojevi, and a bundle containing both. Product details must be verified from the editable product record and approved reference media.",
      targetCustomer: "Parents of young children, grandparents, aunts and uncles, godparents, family friends, and people looking for personalized birthday or holiday gifts.",
      coreBenefit: "Personalization makes a thoughtful physical gift feel made especially for one child, while letters, numbers, coloring and simple activities support playful time together.",
      preferredLanguage: "hr",
      active: true,
    }).run();
    log("Maštograd seeded");
  }
}

async function seedSocialStrategies() {
  const rows = db.select().from(products).all();
  const byName = new Map(rows.map((product) => [product.name, product]));
  const strategies = [
    {
      product: byName.get("Maštograd"),
      value: {
        primaryPlatform: "instagram", preferredLanguage: "hr",
        primaryAudience: "Parents of young children, grandparents, aunts and uncles, godparents, family friends, and buyers looking for a personalized child gift.",
        brandVoice: "Warm, imaginative, playful, cheerful, personal, reassuring, simple, and natural. Written for adults buying for children. Avoid corporate language, exaggerated educational claims, guilt-based parenting, excessive baby talk, and aggressive sales pressure.",
        coreMessages: ["Children enjoy seeing their own name.", "Personalization makes the gift feel made for one child.", "Learning can feel like play.", "A quiet shared activity for children and parents.", "A thoughtful physical gift.", "Alphabet and number products are available separately or together."],
        contentPillars: [
          { name: "Product discovery", purpose: "Show what the products are and what someone receives.", examples: ["Moja prva abeceda", "Moji prvi brojevi", "bundle", "personalization details"] },
          { name: "Personalization", purpose: "Show why a personalized product feels special.", examples: ["child name on first page", "preparing a product for a child", "name-focused visual"] },
          { name: "Learning through play", purpose: "Present letters, numbers, coloring and activities as playful experiences.", examples: ["coloring", "letter games", "screen-free activity"] },
          { name: "Gift inspiration", purpose: "Help buyers imagine a real gifting occasion.", examples: ["birthday", "Christmas", "gift from grandparents"] },
          { name: "Behind the scenes", purpose: "Show honest human care behind the product.", examples: ["checking a name", "arranging pages", "preparing an order"] },
          { name: "Useful ideas for parents", purpose: "Offer easy activity ideas beyond direct sales.", examples: ["quiet activity moment", "let a child choose colors", "store completed pages"] },
          { name: "Product detail spotlight", purpose: "Focus on one verified feature at a time.", examples: ["personalization", "activity type", "bundle contents"] },
          { name: "Founder and brand story", purpose: "Explain honestly why Maštograd exists.", examples: ["small Croatian business", "designing activities", "first orders"] },
          { name: "Direct sales", purpose: "Clearly invite an order when details are real.", examples: ["availability", "bundle option", "how to order"] },
        ],
        visualDirections: ["Real product on a tidy child-friendly desk", "close-up of personalization", "product beside crayons", "gift-ready packaging only when real", "flat-lay with a few playful objects", "hand arranging the real product", "carousel mixing overview and close-up details"],
        prohibitedClaims: ["Do not guarantee reading or counting outcomes.", "Do not invent packaging, page counts, activities, box contents, awards, or certifications.", "Do not use identifiable fake children or real children’s full names without approval."],
        bannedPhrases: ["unlock your child’s full potential", "the perfect gift", "guaranteed learning results"],
        preferredCtas: ["Pogledaj kako izgleda personalizirana verzija.", "Odaberi ime koje će biti na proizvodu.", "Abeceda i brojevi dostupni su zasebno ili zajedno.", "Kome bi ti poklonila ovakav personalizirani poklon?", "Spremi ideju za sljedeći dječji rođendan."],
        hashtagGuidance: "Use a small relevant Croatian set around personalized gifts, children, learning through play, activities, alphabet, numbers, birthdays, and Croatian small business. Include brand tags where appropriate. Never promise reach.",
        directSalesFrequency: 1, postingPriority: 60,
        exampleIdeas: ["Kako izgleda proizvod kada na njemu piše baš ime djeteta?", "Tri jednostavna načina kako koristiti stranice s abecedom kod kuće.", "Pogled iza kulisa: priprema personaliziranog poklona.", "Abeceda ili brojevi - što bi tvoje dijete prvo odabralo?", "Ideja za osoban rođendanski poklon."],
        advancedContext: "Flexible six-post rotation: product showcase, useful parent activity, personalization detail, behind the scenes, gift inspiration, direct sales or bundle. Avoid the same active product in every consecutive post.",
      },
    },
    {
      product: byName.get("Digital Guest Welcome Book"),
      value: {
        primaryPlatform: "instagram", preferredLanguage: "hr",
        primaryAudience: "Private apartment owners, owners of several apartments, villa and holiday-home owners, small guest houses, local property managers, accommodation agencies, and hosts who repeatedly answer guest questions.",
        brandVoice: "Practical, professional, approachable, clear, modern, and helpful. Grounded in real hosting problems and understandable to non-technical hosts. Do not shame hosts or claim the guide replaces personal hospitality.",
        coreMessages: ["Guests can find important information in one place.", "The guide can reduce repeated questions.", "Guests open it through a QR code or link.", "Local recommendations can be easy to access.", "Information remains available throughout a stay.", "Good guest communication does not require repeatedly sending the same messages."],
        contentPillars: [
          { name: "Common host problems", purpose: "Show familiar hosting situations without mocking anyone.", examples: ["Wi-Fi password", "parking", "repeated check-in messages", "late-night questions"] },
          { name: "Product demonstration", purpose: "Show verified ways the welcome book works.", examples: ["scan QR code", "open guide", "browse information"] },
          { name: "Feature spotlight", purpose: "Explain one verified capability simply.", examples: ["Wi-Fi", "check-in", "house rules", "recommendations"] },
          { name: "Better guest experience", purpose: "Show the guest perspective without guarantees.", examples: ["arrival information", "beach day", "nearby pharmacy"] },
          { name: "Host time and organization", purpose: "Show how central information can support hosting.", examples: ["less copying and pasting", "several apartments", "consistent information"] },
          { name: "Local destination content", purpose: "Demonstrate useful information a host may choose to include.", examples: ["beaches", "restaurants", "parking", "rainy-day ideas"] },
          { name: "Before and after", purpose: "Contrast fragmented communication with one organized guide fairly.", examples: ["WhatsApp and paper", "QR code to structured guide"] },
          { name: "Host education", purpose: "Provide useful guest-communication advice.", examples: ["clear check-in", "house rules", "local recommendations"] },
          { name: "Customer example or case study", purpose: "Show real use only when actual customer information exists.", examples: ["one guide across apartments"] },
          { name: "Direct sales and demo", purpose: "Invite hosts to request a real example or setup.", examples: ["request demo", "contact for setup"] },
        ],
        visualDirections: ["Phone displaying a real product screenshot", "QR code card in an apartment", "phone beside keys or welcome note", "clean apartment-entry scene", "real screenshot in a device frame", "host desk with phone, keys and notes", "carousel explaining a host problem and solution"],
        prohibitedClaims: ["Do not invent integrations, analytics, translations, dashboards, or automation features.", "Do not claim guests will never ask questions again.", "Do not guarantee ratings, reviews, satisfaction, or revenue.", "Do not fabricate customer names, quotes, metrics, or results."],
        bannedPhrases: ["fully automated hosting", "guaranteed five-star reviews", "AI-powered hospitality"],
        preferredCtas: ["Pogledaj kako digitalna knjiga dobrodošlice izgleda u praksi.", "Zatraži primjer za svoj apartman.", "Koliko puta tjedno gostima šalješ iste informacije?", "Spremi popis informacija koje bi svaki gost trebao lako pronaći.", "Javi se za kratku demonstraciju."],
        hashtagGuidance: "Use a small relevant set around apartment owners, private accommodation, tourism, hosting, guest experience, Croatian tourism, digital guest guides, and property management. Avoid hashtag spam.",
        directSalesFrequency: 1, postingPriority: 40,
        exampleIdeas: ["Koliko puta si ovog ljeta poslao istu Wi-Fi lozinku?", "Pet informacija koje bi svaki gost trebao lako pronaći.", "Kako izgleda dolazak gosta uz QR kod u apartmanu?", "Što staviti u digitalnu knjigu dobrodošlice?", "Informacije za goste ne moraju biti rasute kroz deset WhatsApp poruka."],
        advancedContext: "Flexible six-post rotation: common host problem, product demonstration, useful hosting tip, feature spotlight, local guest-experience example, direct demo or sales post.",
      },
    },
  ];
  for (const entry of strategies) {
    if (!entry.product) continue;
    const existing = db.select().from(productSocialStrategies).where(eq(productSocialStrategies.productId, entry.product.id)).all();
    if (!existing.length) {
      db.insert(productSocialStrategies).values({ productId: entry.product.id, ...entry.value }).run();
      log(`social strategy seeded for ${entry.product.name}`);
    }
  }
}

const HR_INITIAL = {
  subject: "Digitalni vodič za goste — {{business_name}}",
  body: `Poštovani,

pišem vam iz tvrtke {{sender_company}} u vezi s digitalnim vodičem za goste namijenjenim smještajnim objektima u mjestu {{town}}.

{{product_name}} omogućuje vašim gostima da putem QR koda ili poveznice pronađu sve praktične informacije — Wi-Fi, upute za prijavu, kućni red te preporuke za plaže, restorane i ljekarne. Time domaćini izbjegavaju stalno odgovaranje na ista pitanja, a gosti dobivaju profesionalniji doživljaj boravka.

Ako vas zanima, rado ću vam poslati kratki demo primjer: {{demo_url}}

Srdačan pozdrav,
{{sender_name}}`,
};

const HR_FU1 = {
  subject: "Nadovezujem se — digitalni vodič za goste ({{business_name}})",
  body: `Poštovani,

samo se kratko nadovezujem na prethodnu poruku o digitalnom vodiču za goste za {{business_name}}.

Ako biste željeli vidjeti kako to izgleda u praksi, ovdje je demo: {{demo_url}}

Srdačan pozdrav,
{{sender_name}}`,
};

const HR_FUF = {
  subject: "Posljednja poruka — digitalni vodič za goste",
  body: `Poštovani,

ovo je moja posljednja poruka na ovu temu kako vas ne bih dodatno opterećivao. Ako digitalni vodič za goste bude aktualan u budućnosti, slobodno mi se javite.

Demo je i dalje dostupan: {{demo_url}}

Srdačan pozdrav,
{{sender_name}}`,
};

const EN_INITIAL = {
  subject: "Digital guest welcome book — {{business_name}}",
  body: `Hello,

I'm reaching out from {{sender_company}} about a digital guest welcome book for accommodation in {{town}}.

{{product_name}} lets your guests open a QR code or link to find all the practical information they need — Wi-Fi, check-in instructions, house rules, and local recommendations for beaches, restaurants and pharmacies. It saves hosts from answering the same questions repeatedly and gives guests a more professional experience.

If it's useful, I'd be glad to send a short demo: {{demo_url}}

Best regards,
{{sender_name}}`,
};

const EN_FU1 = {
  subject: "Following up — digital guest welcome book ({{business_name}})",
  body: `Hello,

Just following up on my earlier note about a digital guest welcome book for {{business_name}}.

If you'd like to see how it works, here is a demo: {{demo_url}}

Best regards,
{{sender_name}}`,
};

const EN_FUF = {
  subject: "Last note — digital guest welcome book",
  body: `Hello,

This is my final note on this so I don't crowd your inbox. If a digital guest welcome book becomes relevant later, feel free to get in touch.

The demo remains available: {{demo_url}}

Best regards,
{{sender_name}}`,
};

async function seedTemplates() {
  const existing = db.select().from(emailTemplates).all();
  if (existing.length) {
    log("templates already present — skipped");
    return;
  }
  const rows = [
    { name: "Croatian initial", language: "hr", emailType: "initial" as const, ...HR_INITIAL },
    { name: "Croatian first follow-up", language: "hr", emailType: "follow_up_1" as const, ...HR_FU1 },
    { name: "Croatian final follow-up", language: "hr", emailType: "follow_up_final" as const, ...HR_FUF },
    { name: "English initial", language: "en", emailType: "initial" as const, ...EN_INITIAL },
    { name: "English first follow-up", language: "en", emailType: "follow_up_1" as const, ...EN_FU1 },
    { name: "English final follow-up", language: "en", emailType: "follow_up_final" as const, ...EN_FUF },
  ];
  for (const r of rows) {
    db.insert(emailTemplates).values({ ...r, version: 1, active: true }).run();
  }
  log(`${rows.length} email templates seeded`);
}

async function seedRules() {
  if (db.select().from(followUpRules).all().length === 0) {
    db.insert(followUpRules).values({}).run();
    log("follow-up rules seeded");
  } else log("follow-up rules already present — skipped");
}

async function seedTerritory() {
  const existing = db.select().from(territories).where(eq(territories.town, "Malinska")).all();
  if (existing.length) return existing[0]!.id;
  const [t] = db
    .insert(territories)
    .values({
      town: "Malinska",
      country: "Croatia",
      includedSettlements: ["Bogovići", "Sveti Vid", "Milovčići"],
      excludedSettlements: ["Krk", "Punat", "Rijeka", "Njivice"],
      active: true,
      notes: "Default seeded territory on the island of Krk.",
    })
    .returning()
    .all();
  log("default territory 'Malinska' seeded");
  return t!.id;
}

async function seedSettings(territoryId: string) {
  const existing = db.select().from(appSettings).all();
  const [product] = db.select().from(products).all();
  if (existing.length) {
    log("app settings already present — skipped");
    return;
  }
  db.insert(appSettings)
    .values({
      activeTerritoryId: territoryId,
      activeProductId: product?.id ?? null,
      senderName: "",
      senderCompany: "",
      senderEmail: "",
      senderSignature: "",
      dailyLeadTarget: 10,
      qualificationSettings: {
        requirePublicEmail: true,
        requireWithinTerritory: true,
        requireWebsite: true,
        requireIndependent: false,
        minConfidence: 0.5,
        rejectExistingDigitalGuide: false,
      },
      exhaustionSettings: {
        minRunsBeforeExhaustion: 3,
        duplicateRateThreshold: 0.7,
        consecutiveEmptyRuns: 2,
      },
    })
    .run();
  log("app settings seeded");
}

async function seedGmail() {
  if (db.select().from(gmailConnection).all().length === 0) {
    db.insert(gmailConnection).values({ composioUserId: "local-user" }).run();
    log("gmail connection row seeded (disconnected)");
  } else log("gmail connection already present — skipped");
}

async function main() {
  console.log("Seeding nos-astra database…");
  await seedAgent();
  await seedSocialContentAgent();
  await seedProduct();
  await seedSocialStrategies();
  await seedTemplates();
  await seedRules();
  const territoryId = await seedTerritory();
  await seedSettings(territoryId);
  await seedGmail();
  sqlite.close();
  console.log("✓ Seed complete.");
}

main();
