import { CommunityPartner } from "../models/CommunityPartner.js";
import { CommunityEvent } from "../models/CommunityEvent.js";
import { COMMUNITY_PARTNER_SEED, COMMUNITY_EVENT_SEED } from "../data/communitySeed.js";

export async function ensureCommunityContent(): Promise<void> {
  const [partnerCount, eventCount] = await Promise.all([
    CommunityPartner.estimatedDocumentCount(),
    CommunityEvent.estimatedDocumentCount(),
  ]);

  if (partnerCount === 0) {
    await CommunityPartner.insertMany(
      COMMUNITY_PARTNER_SEED.map((p) => ({ ...p, active: true })),
      { ordered: false }
    ).catch(() => {});
  }

  if (eventCount === 0) {
    await CommunityEvent.insertMany(
      COMMUNITY_EVENT_SEED.map((e) => ({ ...e, active: true })),
      { ordered: false }
    ).catch(() => {});
  }
}
