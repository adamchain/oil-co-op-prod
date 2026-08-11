import type { ContentGroup } from "./types";
import { LAYOUT_CONTENT } from "../../layouts/MarketingLayout";
import { HOME_CONTENT } from "../homeSections";
import { SERVICES_CONTENT } from "../ServicesPage";
import { HEATING_PRICES_CONTENT } from "../HeatingPricesPage";
import { OUR_STORY_CONTENT } from "../OurStoryPage";
import { MEET_TEAM_CONTENT } from "../MeetTeamPage";
import { TESTIMONIALS_CONTENT } from "../TestimonialsPage";
import { FAQ_CONTENT } from "../FaqPage";
import { COMMUNITY_CONTENT } from "../CommunityPage";
import { REFERRAL_CONTENT } from "../ReferralPage";
import { RELATED_LINKS_CONTENT } from "../RelatedLinksPage";

/**
 * Every editable content group, in the order they appear in the admin Site
 * Content editor. Each page module owns and exports its own group so the
 * defaults live next to the JSX that renders them.
 */
export const SITE_CONTENT_GROUPS: ContentGroup[] = [
  LAYOUT_CONTENT,
  HOME_CONTENT,
  SERVICES_CONTENT,
  HEATING_PRICES_CONTENT,
  OUR_STORY_CONTENT,
  MEET_TEAM_CONTENT,
  TESTIMONIALS_CONTENT,
  FAQ_CONTENT,
  COMMUNITY_CONTENT,
  REFERRAL_CONTENT,
  RELATED_LINKS_CONTENT,
];
