import { Link } from "react-router-dom";
import { siteImageUrl } from "../api";
import type { ContentGroup } from "./content/types";
import { useSiteText } from "./content/SiteContentContext";

/**
 * Shared building blocks for the public homepage layout options.
 * Heroes and top-of-page ordering vary per layout; these sections are reused.
 */

/** Editable copy for the public Home page (both PublicHomePage and homeSections). */
export const HOME_CONTENT: ContentGroup = {
  page: "home",
  title: "Home Page",
  fields: [
    // Hero (PublicHomePage.tsx)
    { key: "home.heroPhone", label: "Hero phone number", value: "860-561-6011" },
    { key: "home.heroPriceUnit", label: "Hero price unit", value: "/gal" },
    { key: "home.heroPriceWeekPrefix", label: "Hero price week prefix", value: "Average heating oil price week of " },
    { key: "home.heroHeadline", label: "Hero headline", value: "Stop overpaying for heating oil & propane." },
    {
      key: "home.heroLead",
      label: "Hero intro paragraph",
      multiline: true,
      value:
        "Group-negotiated rates from local, full-service companies — with someone in your corner if something goes wrong.",
    },
    { key: "home.heroJoinCta", label: "Hero Join button", value: "Join Now" },
    { key: "home.heroPricingLink", label: "Hero pricing link", value: "See full pricing →" },
    {
      key: "home.heroCheckLine",
      label: "Hero check line",
      multiline: true,
      value: "Over 5,000 families across CT, RI, NY & MA are already saving.",
    },

    // Price card
    { key: "home.priceCardLabel", label: "Price card label", value: "Average heating oil price" },
    { key: "home.priceCardValue", label: "Price card value", value: "See homepage" },
    { key: "home.priceCardPeriod", label: "Price card period", value: "Managed in Admin → Oil Prices" },
    { key: "home.priceCardCompareLink", label: "Price card compare link", value: "See price comparison" },

    // Steps section
    { key: "home.stepsHeading", label: "Steps heading", value: "Saving starts in three simple steps" },
    { key: "home.step1", label: "Step 1", value: "Join Citizen's Oil Co-op" },
    { key: "home.step2", label: "Step 2", value: "We connect you with a participating company" },
    { key: "home.step3", label: "Step 3", value: "They call you to set up service under Co-op pricing" },
    { key: "home.stepsJoinCta", label: "Steps Join button", value: "Join Now" },

    // Towns section
    { key: "home.townsTitle", label: "Towns section title", value: "Towns we serve" },
    {
      key: "home.townsSub",
      label: "Towns section subtitle",
      multiline: true,
      value: "Members across four states. Not sure if we cover your town? Call and we'll confirm.",
    },
    { key: "home.townsCt", label: "Coverage: Connecticut", value: "Connecticut" },
    { key: "home.townsCtDesc", label: "Coverage: Connecticut detail", value: "Every town, statewide" },
    { key: "home.townsRi", label: "Coverage: Rhode Island", value: "Rhode Island" },
    { key: "home.townsRiDesc", label: "Coverage: Rhode Island detail", value: "Every town, statewide" },
    { key: "home.townsMa", label: "Coverage: Massachusetts", value: "Massachusetts" },
    { key: "home.townsMaDesc", label: "Coverage: Massachusetts detail", value: "Worcester, Norfolk & Bristol counties" },
    { key: "home.townsNy", label: "Coverage: New York", value: "New York" },
    { key: "home.townsNyDesc", label: "Coverage: New York detail", value: "Westchester County" },
    {
      key: "home.townsNote",
      label: "Towns coverage note",
      multiline: true,
      value: "Coverage shown is approximate — final town/region list to be confirmed by the office.",
    },

    // Fuel cards
    { key: "home.fuelsTitle", label: "Fuels section title", value: "What we offer" },
    { key: "home.fuelsSub", label: "Fuels section subtitle", value: "One membership, savings across your home energy." },
    { key: "home.fuelOilName", label: "Fuel: Heating oil name", value: "Heating oil" },
    { key: "home.fuelOilDesc", label: "Fuel: Heating oil detail", value: "Full-service delivery at negotiated Co-op rates." },
    { key: "home.fuelPropaneName", label: "Fuel: Propane name", value: "Propane" },
    { key: "home.fuelPropaneDesc", label: "Fuel: Propane detail", value: "Discounted propane — often with free tank rental." },
    { key: "home.fuelBioheatName", label: "Fuel: Bioheat name", value: "Bioheat (B20)" },
    { key: "home.fuelBioheatDesc", label: "Fuel: Bioheat detail", value: "Cleaner oil blend for your existing equipment." },
    { key: "home.fuelSolarName", label: "Fuel: Solar name", value: "Solar" },
    { key: "home.fuelSolarDesc", label: "Fuel: Solar detail", value: "On-site clean generation at a fixed energy rate." },

    // HomeBody — About
    { key: "home.aboutTitle", label: "About title", value: "Oil Co-op members pay less" },
    {
      key: "home.aboutSub",
      label: "About subtitle",
      multiline: true,
      value:
        "Citizen's Oil Co-op is a buyers' club: strength in numbers for lower prices and someone in your corner if something goes wrong.",
    },
    { key: "home.aboutPara1a", label: "About paragraph 1 (part a)", multiline: true, value: "Through group purchasing, members typically save " },
    { key: "home.aboutPara1SavingsRange", label: "About savings range", value: "$450–$600 a heating season" },
    { key: "home.aboutPara1b", label: "About paragraph 1 (part b)", multiline: true, value: " (based on 900 gallons) — consistently below average posted prices. And membership is " },
    { key: "home.aboutPara1LockIn", label: "About lock-in phrase", value: "not a fixed-price lock-in" },
    { key: "home.aboutPara1c", label: "About paragraph 1 (part c)", value: ": you keep full control of your service." },
    { key: "home.aboutPara2a", label: "About paragraph 2 (part a)", multiline: true, value: "Join the Co-op, we match you with a participating full-service company in your town, and they set you up at the negotiated rate. " },
    { key: "home.aboutPara2Easy", label: "About paragraph 2 emphasis", value: "It's that easy." },
    { key: "home.aboutJoinCta", label: "About Join button", value: "Join Now" },
    { key: "home.aboutStat1Num", label: "About stat 1 number", value: "3,000+" },
    { key: "home.aboutStat1Label", label: "About stat 1 label", value: "Members (approx.)" },
    { key: "home.aboutStat2Num", label: "About stat 2 number", value: "30+" },
    { key: "home.aboutStat2Label", label: "About stat 2 label", value: "Years negotiating for households" },
    { key: "home.aboutStat3Num", label: "About stat 3 number", value: "900" },
    { key: "home.aboutStat3Label", label: "About stat 3 label", value: "Example gallons / season for savings math" },

    // HomeBody — Story
    { key: "home.storyTitle", label: "Story title", value: "Our story" },
    { key: "home.storyPara_a", label: "Story paragraph (part a)", multiline: true, value: "Founded in " },
    { key: "home.storyYear1", label: "Story founded year", value: "1981" },
    { key: "home.storyPara_b", label: "Story paragraph (part b)", value: " and incorporated in " },
    { key: "home.storyYear2", label: "Story incorporated year", value: "1992" },
    { key: "home.storyPara_c", label: "Story paragraph (part c)", multiline: true, value: ", Citizen's Oil Co-op is family-owned and has grown to " },
    { key: "home.storyMembers", label: "Story members phrase", value: "over 3,000 members" },
    { key: "home.storyPara_d", label: "Story paragraph (part d)", multiline: true, value: " across every town in Connecticut and Rhode Island, plus parts of New York and Massachusetts. Same mission throughout: " },
    { key: "home.storyMission", label: "Story mission phrase", value: "affordable, quality full-service energy" },
    { key: "home.storyPara_e", label: "Story paragraph (part e)", value: " and a real advocate for members." },

    // HomeBody — Membership
    { key: "home.membershipTitle", label: "Membership title", value: "Membership" },
    { key: "home.membershipSub", label: "Membership subtitle", value: "Fees, delivery, and referrals." },
    { key: "home.membershipCostsHead", label: "Membership costs heading", value: "Costs & fees" },
    { key: "home.membershipFee1Amt", label: "Membership fee 1 amount", value: "$10" },
    { key: "home.membershipFee1", label: "Membership fee 1 text", value: " non-refundable application fee." },
    { key: "home.membershipFee2Amt", label: "Membership fee 2 amount", value: "$35" },
    { key: "home.membershipFee2", label: "Membership fee 2 text", value: " annual membership dues, renewing each year." },
    { key: "home.membershipFee3Amt", label: "Membership fee 3 amount", value: "$25" },
    { key: "home.membershipFee3a", label: "Membership fee 3 text (part a)", value: " annual rate for seniors " },
    { key: "home.membershipFee3Age", label: "Membership fee 3 age", value: "55+" },
    { key: "home.membershipFee3b", label: "Membership fee 3 text (part b)", multiline: true, value: " (also applies to some low-volume propane accounts per Co-op policy)." },
    { key: "home.membershipFeeNoteLabel", label: "Membership fee note label", value: "Online signup note:" },
    { key: "home.membershipFeeNote", label: "Membership fee note", value: " confirm current published fees with the office." },
    { key: "home.membershipDeliveryHead", label: "Membership delivery heading", value: "Delivery" },
    { key: "home.membershipDelivery_a", label: "Membership delivery (part a)", value: "Most suppliers use " },
    { key: "home.membershipDeliveryAuto", label: "Membership delivery auto", value: "automatic delivery" },
    { key: "home.membershipDelivery_b", label: "Membership delivery (part b)", value: "; some areas offer " },
    { key: "home.membershipDeliveryWillCall", label: "Membership delivery will-call", value: "will-call" },
    { key: "home.membershipDelivery_c", label: "Membership delivery (part c)", multiline: true, value: ". If you leave the Co-op, cancel delivery with your supplier and membership with the Co-op directly — we can't cancel for you." },
    { key: "home.membershipReferralHead", label: "Membership referral heading", value: "Referral program" },
    { key: "home.membershipReferral_a", label: "Membership referral (part a)", value: "Refer " },
    { key: "home.membershipReferralCount", label: "Membership referral count", value: "five new active members" },
    { key: "home.membershipReferral_b", label: "Membership referral (part b)", value: " and become a " },
    { key: "home.membershipReferralLifetime", label: "Membership referral lifetime", value: "lifetime member" },
    { key: "home.membershipReferral_c", label: "Membership referral (part c)", value: " with no annual dues." },
    { key: "home.membershipNextStepTitle", label: "Next Step program title", value: "The Next Step program" },
    { key: "home.membershipNextStep_a", label: "Next Step text (part a)", multiline: true, value: "Community groups can introduce the Co-op to their members — the Co-op donates " },
    { key: "home.membershipNextStepAmt", label: "Next Step donation amount", value: "$10" },
    { key: "home.membershipNextStep_b", label: "Next Step text (part b)", multiline: true, value: " per new member back to the organization. (Can't be combined with the member referral program.)" },
    { key: "home.membershipSideTitle", label: "Membership side callout title", value: "We're on your side" },
    { key: "home.membershipSideBody", label: "Membership side callout body", multiline: true, value: "Large membership means better contracts — and a voice when you need help with pricing or your supplier." },
    { key: "home.membershipPill1", label: "Membership pill 1", value: "Not a fixed-price lock-in" },
    { key: "home.membershipPill2", label: "Membership pill 2", value: "Full-service suppliers" },
    { key: "home.membershipPill3", label: "Membership pill 3", value: "Advocacy" },

    // HomeBody — Services
    { key: "home.servicesTitle", label: "Services title", value: "Services" },
    { key: "home.servicesSub", label: "Services subtitle", value: "From heat to insurance — tap any program for details." },
    { key: "home.servicesLinkHeatingOil", label: "Services link: Heating oil", value: "Heating oil" },
    { key: "home.servicesLinkHeatingPrices", label: "Services link: Heating oil prices", value: "Heating oil prices" },
    { key: "home.servicesLinkBioheat", label: "Services link: Bioheat", value: "Bioheat" },
    { key: "home.servicesLinkPropane", label: "Services link: Propane", value: "Propane" },
    { key: "home.servicesLinkElectricity", label: "Services link: Electricity", value: "Electricity" },
    { key: "home.servicesLinkCompost", label: "Services link: Blue Earth Compost", value: "Blue Earth Compost" },
    { key: "home.servicesLinkAudits", label: "Services link: Energy audits", value: "Energy audits" },
    { key: "home.servicesLinkInsurance", label: "Services link: Insurance", value: "Insurance" },
    { key: "home.servicesLinkSolar", label: "Services link: Solar energy", value: "Solar energy" },
    { key: "home.servicesLinkJoin", label: "Services link: Join / renewal", value: "Join / renewal" },

    // Services accordion — Heating oil
    { key: "home.svcOilTitle", label: "Service: Heating oil title", value: "Heating oil" },
    { key: "home.svcOilP1_a", label: "Service: Heating oil p1 (part a)", value: "All Co-op heating oil suppliers are " },
    { key: "home.svcOilFullService", label: "Service: Heating oil full-service", value: "full-service" },
    { key: "home.svcOilP1_b", label: "Service: Heating oil p1 (part b)", value: ". Members typically see pricing roughly " },
    { key: "home.svcOilBelow", label: "Service: Heating oil below phrase", value: "40–50¢ below" },
    { key: "home.svcOilP1_c", label: "Service: Heating oil p1 (part c)", value: " average state posted prices, with competitive " },
    { key: "home.svcOilContracts", label: "Service: Heating oil contracts", value: "service contracts" },
    { key: "home.svcOilP1_d", label: "Service: Heating oil p1 (part d)", value: " and access to " },
    { key: "home.svcOilBudget", label: "Service: Heating oil budget", value: "budget billing" },
    { key: "home.svcOilP1_e", label: "Service: Heating oil p1 (part e)", value: " programs (often arranged before September 1)." },
    { key: "home.svcOilP2", label: "Service: Heating oil p2", multiline: true, value: "You're billed by your company with time to pay — and the Co-op can help advocate if you have service or pricing questions." },

    // Services accordion — Propane
    { key: "home.svcPropaneTitle", label: "Service: Propane title", value: "Propane" },
    { key: "home.svcPropaneP1_a", label: "Service: Propane p1 (part a)", value: "Discounted propane pricing; many members receive added benefits such as " },
    { key: "home.svcPropaneTankRental", label: "Service: Propane tank rental", value: "free tank rental" },
    { key: "home.svcPropaneP1_b", label: "Service: Propane p1 (part b)", multiline: true, value: ". The Co-op forwards your information to a participating supplier, who contacts you, performs a safety check, switches equipment as needed, and coordinates removal of the old tank." },
    { key: "home.svcPropaneP2_a", label: "Service: Propane p2 (part a)", value: "Existing Co-op members can often " },
    { key: "home.svcPropaneAddNoFee", label: "Service: Propane no fee phrase", value: "add propane without a second membership fee" },
    { key: "home.svcPropaneP2_b", label: "Service: Propane p2 (part b)", value: ". Many oil suppliers also deliver propane for stacked savings." },

    // Services accordion — Bioheat
    { key: "home.svcBioheatTitle", label: "Service: Bioheat title", value: "Bioheat (B20)" },
    { key: "home.svcBioheatB20", label: "Service: Bioheat B20", value: "B20" },
    { key: "home.svcBioheatP1_a", label: "Service: Bioheat p1 (part a)", value: " is 80% low-sulfur No. 2 oil and 20% biodiesel — usable in existing oil equipment. Biodiesel in the blend is sourced to meet " },
    { key: "home.svcBioheatAstm", label: "Service: Bioheat ASTM", value: "ASTM" },
    { key: "home.svcBioheatP1_b", label: "Service: Bioheat p1 (part b)", value: " standards (e.g. Greenleaf Biofuels)." },
    { key: "home.svcBioheatP2", label: "Service: Bioheat p2", value: "Environmental highlights often cited for B20 include:" },
    { key: "home.svcBioheatLi1", label: "Service: Bioheat list item 1", multiline: true, value: "Meaningful reductions in CO₂, particulates, and other emissions vs. conventional oil." },
    { key: "home.svcBioheatLi2", label: "Service: Bioheat list item 2", value: "Supports domestic fuel production and reduced reliance on imported oil." },
    { key: "home.svcBioheatP3", label: "Service: Bioheat p3", multiline: true, value: "Bioheat is available in many Connecticut towns; where it isn't, rallying interest (e.g. ~10 neighbors) can help the Co-op open a route." },

    // Services accordion — Solar
    { key: "home.svcSolarTitle", label: "Service: Solar title", value: "Solar energy" },
    { key: "home.svcSolarP1", label: "Service: Solar p1", multiline: true, value: "Solar can reduce purchased electricity with a fixed energy rate. Many households save a significant share vs. utility supply costs; federal (and sometimes state) incentives apply — ask for current programs." },
    { key: "home.svcSolarP2_a", label: "Service: Solar p2 (part a)", value: "A Co-op representative can review your home and usage. Members who enroll through the Co-op have at times qualified for a " },
    { key: "home.svcSolarIncentive", label: "Service: Solar incentive", value: "$500" },
    { key: "home.svcSolarP2_b", label: "Service: Solar p2 (part b)", value: " incentive upon project completion and activation (verify current offer)." },

    // Services accordion — Home energy audits
    { key: "home.svcAuditsTitle", label: "Service: Audits title", value: "Home energy audits (NESE)" },
    { key: "home.svcAuditsP1_a", label: "Service: Audits p1 (part a)", value: "Partner " },
    { key: "home.svcAuditsNese", label: "Service: Audits NESE", value: "New England Smart Energy (NESE)" },
    { key: "home.svcAuditsP1_b", label: "Service: Audits p1 (part b)", value: " offers audits across Connecticut with a modest " },
    { key: "home.svcAuditsCopay", label: "Service: Audits copay", value: "copay" },
    { key: "home.svcAuditsP1_c", label: "Service: Audits p1 (part c)", value: " (often around " },
    { key: "home.svcAuditsCopayAmt", label: "Service: Audits copay amount", value: "$50" },
    { key: "home.svcAuditsP1_d", label: "Service: Audits p1 (part d)", multiline: true, value: "), including substantial in-home measures (historically up to ~$600 of work) and access to rebates on follow-up improvements." },
    { key: "home.svcAuditsP2", label: "Service: Audits p2", value: "Pairing audits with cleaner fuels like bioheat can cut both bills and carbon footprint." },

    // Services accordion — Insurance
    { key: "home.svcInsuranceTitle", label: "Service: Insurance title", value: "Insurance (Bearingstar)" },
    { key: "home.svcInsuranceP1_a", label: "Service: Insurance p1 (part a)", value: "Partner " },
    { key: "home.svcInsuranceBearingstar", label: "Service: Insurance Bearingstar", value: "Bearingstar Insurance" },
    { key: "home.svcInsuranceP1_b", label: "Service: Insurance p1 (part b)", value: " offers member pricing on auto and homeowners coverage. Testimonials cite " },
    { key: "home.svcInsuranceSavings", label: "Service: Insurance savings phrase", value: "hundreds of dollars" },
    { key: "home.svcInsuranceP1_c", label: "Service: Insurance p1 (part c)", value: " in annual savings vs. prior carriers." },

    // Services accordion — Electricity
    { key: "home.svcElectricTitle", label: "Service: Electricity title", value: "Electricity" },
    { key: "home.svcElectricStatusLabel", label: "Service: Electricity status label", value: "Status:" },
    { key: "home.svcElectricP1_a", label: "Service: Electricity p1 (part a)", value: " The Co-op has previously offered electricity programs; as of recent updates, " },
    { key: "home.svcElectricNoLive", label: "Service: Electricity no live offer", value: "there may not be a live electric supply offer" },
    { key: "home.svcElectricP1_b", label: "Service: Electricity p1 (part b)", value: " while a new supplier relationship is pursued. " },
    { key: "home.svcElectricCall", label: "Service: Electricity call to action", value: "Call or email" },
    { key: "home.svcElectricP1_c", label: "Service: Electricity p1 (part c)", value: " for the latest." },

    // Services accordion — Blue Earth Compost
    { key: "home.svcCompostTitle", label: "Service: Compost title", value: "Blue Earth Compost & more" },
    { key: "home.svcCompostP1_a", label: "Service: Compost p1 (part a)", value: "The Co-op highlights additional member programs on " },
    { key: "home.svcCompostLink", label: "Service: Compost link text", value: "oilco-op.com" },
    { key: "home.svcCompostP1_b", label: "Service: Compost p1 (part b)", multiline: true, value: " — including organics/compost and other seasonal offers. This site focuses on core energy programs; visit the main site for the full menu." },

    // HomeBody — Going green
    { key: "home.greenTitle", label: "Going green title", value: "Going green" },
    { key: "home.greenP_a", label: "Going green (part a)", value: "Bioheat" },
    { key: "home.greenP_b", label: "Going green (part b)", value: " lowers emissions from oil heat, " },
    { key: "home.greenP_c", label: "Going green (part c)", value: "energy audits" },
    { key: "home.greenP_d", label: "Going green (part d)", value: " pinpoint upgrades that pay back over time, and " },
    { key: "home.greenP_e", label: "Going green (part e)", value: "solar" },
    { key: "home.greenP_f", label: "Going green (part f)", multiline: true, value: " adds clean on-site generation. Ask the Co-op how current incentives fit your home." },
    { key: "home.greenCalloutTitle", label: "Going green callout title", value: "Simple. Affordable. Efficient." },
    { key: "home.greenCalloutBody", label: "Going green callout body", multiline: true, value: "That's how the Co-op describes its mission: low prices for quality full-service energy, with a path toward cleaner options." },

    // HomeBody — Quote band
    { key: "home.quoteText", label: "Quote band text", multiline: true, value: "What do members think? Watch stories and updates on the Co-op's site." },
    { key: "home.quoteCta", label: "Quote band CTA", value: "▶ Member video & news on oilco-op.com" },

    // HomeBody — Community
    { key: "home.communityTitle", label: "Community title", value: "Community & partnerships" },
    { key: "home.communitySub", label: "Community subtitle", value: "The Co-op gives back to local organizations, including:" },
    { key: "home.communityP1Name", label: "Community partner 1 name", value: "Roxbury Fuel Bank" },
    { key: "home.communityP1Desc", label: "Community partner 1 detail", value: "Give-back per new member for neighbors in need." },
    { key: "home.communityP2Name", label: "Community partner 2 name", value: "West Hartford Youth Basketball (WHYBL)" },
    { key: "home.communityP2Desc", label: "Community partner 2 detail", value: "Team sponsorship and Next Step partner." },
    { key: "home.communityP3Name", label: "Community partner 3 name", value: "Buena Vista Property Owners Assn." },
    { key: "home.communityP3Desc", label: "Community partner 3 detail", value: "Neighborhood savings and fundraising." },
    { key: "home.communityP4Name", label: "Community partner 4 name", value: "Connecticut Citizen Action Group" },
    { key: "home.communityP4Desc", label: "Community partner 4 detail", value: "Helped launch the Co-op; consumer-rights work." },
    { key: "home.communityP5Name", label: "Community partner 5 name", value: "Friends of Fernridge Park" },
    { key: "home.communityP5Desc", label: "Community partner 5 detail", value: "Events and preservation in West Hartford." },
    { key: "home.communityP6Name", label: "Community partner 6 name", value: "Our Lady of Calvary Retreat Center" },
    { key: "home.communityP6Desc", label: "Community partner 6 detail", value: "Multi-year golf fundraiser support." },

    // HomeBody — News
    { key: "home.newsTitle", label: "News title", value: "What's new" },
    { key: "home.newsBody", label: "News body", multiline: true, value: "Expansion updates, seasonal referral promotions, lifetime-member campaigns, and event sponsorships are posted on the Co-op's blog and news pages." },
    { key: "home.newsCta", label: "News CTA", value: "Read news on oilco-op.com" },

    // HomeBody — Contact
    { key: "home.contactTitle", label: "Contact title", value: "Contact us" },
    { key: "home.contactSub", label: "Contact subtitle", value: "West Hartford, CT — we're here to help." },
    { key: "home.contactPhoneLabel", label: "Contact phone label", value: "Phone" },
    { key: "home.contactPhoneValue", label: "Contact phone value", value: "860-561-6011" },
    { key: "home.contactEmailLabel", label: "Contact email label", value: "Email" },
    { key: "home.contactEmailValue", label: "Contact email value", value: "hutson@oilco-op.com" },
    { key: "home.contactFaxLabel", label: "Contact fax label", value: "Fax" },
    { key: "home.contactFaxValue", label: "Contact fax value", value: "860-561-9588" },
    { key: "home.contactOfficeLabel", label: "Contact office label", value: "Office" },
    { key: "home.contactOfficeValue", label: "Contact office value", value: "West Hartford, Connecticut" },

    // HomeBody — Get started
    { key: "home.getStartedTitle", label: "Get started title", value: "Get started" },
    { key: "home.getStartedCallLabel", label: "Get started call label", value: "CALL TODAY" },
    { key: "home.getStartedPhone", label: "Get started phone", value: "860-561-6011" },
    { key: "home.getStartedFuels", label: "Get started fuels line", value: "Heating oil · Bioheat · Propane · Electric programs · Insurance · Audits · Solar" },
    { key: "home.getStartedJoinCta", label: "Get started Join button", value: "Join Now" },
    { key: "home.getStartedNote", label: "Get started note", value: "Confirm current rates, fees, and offers with the office." },

    // ValueBand
    { key: "home.value1Title", label: "Value band 1 title", value: "Competitive pricing" },
    { key: "home.value1Body", label: "Value band 1 body", multiline: true, value: "We use the power of group buying to negotiate lower prices on your fuel." },
    { key: "home.value2Title", label: "Value band 2 title", value: "Consumer education" },
    { key: "home.value2Body", label: "Value band 2 body", multiline: true, value: "We share the knowledge and tools to help you make informed energy decisions." },
    { key: "home.value3Title", label: "Value band 3 title", value: "Consumer advocacy" },
    { key: "home.value3Body", label: "Value band 3 body", multiline: true, value: "We work for you, not the fuel companies — always have, always will." },

    // SavingsSection
    { key: "home.savingsEyebrow", label: "Savings eyebrow", value: "Saving More. Together." },
    { key: "home.savingsHeading", label: "Savings heading", value: "The average member saves" },
    { key: "home.savingsFigure", label: "Savings figure", value: "$450–$600" },
    { key: "home.savingsSubA", label: "Savings sub (part a)", value: "per heating season, based on " },
    { key: "home.savingsGallons", label: "Savings gallons phrase", value: "900 gallons" },
    { key: "home.savingsSubB", label: "Savings sub (part b)", value: "." },
    { key: "home.savingsJoinCta", label: "Savings Join button", value: "Join Now" },
    { key: "home.savingsQuote", label: "Savings quote", multiline: true, value: "“The reduced per-gallon cost helps our household budget — we keep telling friends about the program.”" },
    { key: "home.savingsQuoteName", label: "Savings quote name", value: "Mark & Alison Laucella" },
    { key: "home.savingsQuoteMeta", label: "Savings quote meta", value: "Middletown · members since 2007" },

    // WhyChooseSection
    { key: "home.whyEyebrow", label: "Why choose eyebrow", value: "Why members stay" },
    { key: "home.whyTitle", label: "Why choose title", value: "Why thousands choose Citizen's Oil Co-op" },
    { key: "home.whyFeature1Title", label: "Why feature 1 title", value: "40+ years" },
    { key: "home.whyFeature1Body", label: "Why feature 1 body", value: "Serving the region since the early 1980s." },
    { key: "home.whyFeature2Title", label: "Why feature 2 title", value: "Local & trusted" },
    { key: "home.whyFeature2Body", label: "Why feature 2 body", value: "We partner with reputable full-service companies." },
    { key: "home.whyFeature3Title", label: "Why feature 3 title", value: "Full-service" },
    { key: "home.whyFeature3Body", label: "Why feature 3 body", value: "Automatic delivery and expert service from local companies." },
    { key: "home.whyFeature4Title", label: "Why feature 4 title", value: "Budget plans" },
    { key: "home.whyFeature4Body", label: "Why feature 4 body", value: "Affordable monthly payment options." },
    { key: "home.whyFeature5Title", label: "Why feature 5 title", value: "Service contracts" },
    { key: "home.whyFeature5Body", label: "Why feature 5 body", value: "Protection for your heating system." },
    { key: "home.whyFeature6Title", label: "Why feature 6 title", value: "Local business" },
    { key: "home.whyFeature6Body", label: "Why feature 6 body", value: "Participating companies near you!" },

    // TestimonialsBand
    { key: "home.testimonialsEyebrow", label: "Testimonials eyebrow", value: "In their words" },
    { key: "home.testimonialsTitle", label: "Testimonials title", value: "What our members are saying" },
    { key: "home.testimonial1Text", label: "Testimonial 1 text", multiline: true, value: "We saved several hundred dollars last winter and didn't have to sacrifice service. Joining was the best decision." },
    { key: "home.testimonial1Name", label: "Testimonial 1 name", value: "Karen R." },
    { key: "home.testimonial1Meta", label: "Testimonial 1 meta", value: "Glastonbury, CT · Heating oil" },
    { key: "home.testimonial2Text", label: "Testimonial 2 text", multiline: true, value: "The pricing is consistently better than what I was paying before, and the customer service is always excellent." },
    { key: "home.testimonial2Name", label: "Testimonial 2 name", value: "Mike D." },
    { key: "home.testimonial2Meta", label: "Testimonial 2 meta", value: "Southington, CT · Propane" },
    { key: "home.testimonial3Text", label: "Testimonial 3 text", multiline: true, value: "I love that they look out for consumers. It's more than just fuel savings — it's peace of mind." },
    { key: "home.testimonial3Name", label: "Testimonial 3 name", value: "Lisa M." },
    { key: "home.testimonial3Meta", label: "Testimonial 3 meta", value: "Madison, CT · Heating oil" },
    { key: "home.testimonialsNote", label: "Testimonials note", multiline: true, value: "Representative member sentiment — see more stories on oilco-op.com." },

    // FinalCtaBand
    { key: "home.finalCtaTitle", label: "Final CTA title", value: "Ready to start saving?" },
    { key: "home.finalCtaBody", label: "Final CTA body", value: "Join the region's trusted home-heating buyers' club today." },
    { key: "home.finalCtaJoinCta", label: "Final CTA Join button", value: "Join Now" },
    { key: "home.finalCtaPhone", label: "Final CTA phone", value: "860-561-6011" },
    { key: "home.finalCtaCheck", label: "Final CTA check line", value: "Join in minutes. Start saving all season long." },
  ],
};

function ServiceDetails({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details>
      <summary>{title}</summary>
      <div className="mkt-acc-body mkt-prose">{children}</div>
    </details>
  );
}

/** Price card — used in the hero on some layouts. */
export function PriceCard() {
  const t = useSiteText();
  return (
    <aside className="mkt-price-card" aria-live="polite">
      <span className="mkt-price-label">{t("home.priceCardLabel")}</span>
      <span className="mkt-price-value">{t("home.priceCardValue")}</span>
      <span className="mkt-price-period">{t("home.priceCardPeriod")}</span>
      <Link to="/heating-prices" className="mkt-btn mkt-btn-ghost" style={{ marginTop: "1rem", width: "100%" }}>
        {t("home.priceCardCompareLink")}
      </Link>
    </aside>
  );
}

/** Three sign-up steps + Join Now CTA. */
export function StepsSection() {
  const t = useSiteText();
  return (
    <section className="mkt-steps" id="how">
      <div className="mkt-steps-banner">
        <h2>{t("home.stepsHeading")}</h2>
      </div>
      <div className="mkt-container mkt-steps-body">
        <ul className="mkt-steps-list">
          <li className="mkt-step">
            <span className="mkt-step-num">1</span>
            <h3>{t("home.step1")}</h3>
          </li>
          <li className="mkt-step">
            <span className="mkt-step-num">2</span>
            <h3>{t("home.step2")}</h3>
          </li>
          <li className="mkt-step">
            <span className="mkt-step-num">3</span>
            <h3>{t("home.step3")}</h3>
          </li>
        </ul>
        <div className="mkt-hero-actions" style={{ justifyContent: "center", marginTop: "1.5rem" }}>
          <Link to="/signup" className="mkt-btn mkt-btn-primary mkt-btn-lg">
            {t("home.stepsJoinCta")}
          </Link>
        </div>
      </div>
    </section>
  );
}

/** Coverage by state. */
export function TownsSection() {
  const t = useSiteText();
  return (
    <section className="mkt-section" id="towns" style={{ background: "var(--color-bg-alt)" }}>
      <div className="mkt-container">
        <h2 className="mkt-section-title">{t("home.townsTitle")}</h2>
        <p className="mkt-section-sub">{t("home.townsSub")}</p>
        <div className="mkt-coverage">
          <div className="mkt-coverage-card">
            <h3>{t("home.townsCt")}</h3>
            <p>{t("home.townsCtDesc")}</p>
          </div>
          <div className="mkt-coverage-card">
            <h3>{t("home.townsRi")}</h3>
            <p>{t("home.townsRiDesc")}</p>
          </div>
          <div className="mkt-coverage-card">
            <h3>{t("home.townsMa")}</h3>
            <p>{t("home.townsMaDesc")}</p>
          </div>
          <div className="mkt-coverage-card">
            <h3>{t("home.townsNy")}</h3>
            <p>{t("home.townsNyDesc")}</p>
          </div>
        </div>
        <p className="mkt-sync-note" style={{ textAlign: "center", marginTop: "1.5rem" }}>
          {t("home.townsNote")}
        </p>
      </div>
    </section>
  );
}

/** Fuel-type cards (Our Town–style) — used on the banner layout. */
export function FuelCards() {
  const t = useSiteText();
  const fuels = [
    { nameKey: "home.fuelOilName", descKey: "home.fuelOilDesc" },
    { nameKey: "home.fuelPropaneName", descKey: "home.fuelPropaneDesc" },
    { nameKey: "home.fuelBioheatName", descKey: "home.fuelBioheatDesc" },
    { nameKey: "home.fuelSolarName", descKey: "home.fuelSolarDesc" },
  ];
  return (
    <section className="mkt-section" id="fuels">
      <div className="mkt-container">
        <h2 className="mkt-section-title">{t("home.fuelsTitle")}</h2>
        <p className="mkt-section-sub">{t("home.fuelsSub")}</p>
        <div className="mkt-fuel-grid">
          {fuels.map((f) => (
            <div className="mkt-fuel-card" key={f.nameKey}>
              <h3>{t(f.nameKey)}</h3>
              <p>{t(f.descKey)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Everything below the top of the page — shared by every layout. */
export function HomeBody() {
  const t = useSiteText();
  return (
    <>
      <section className="mkt-section mkt-about" id="about">
        <div className="mkt-container">
          <h2 className="mkt-section-title">{t("home.aboutTitle")}</h2>
          <p className="mkt-section-sub">{t("home.aboutSub")}</p>
          <div className="mkt-split">
            <div className="mkt-prose">
              <p>
                {t("home.aboutPara1a")}
                <strong>{t("home.aboutPara1SavingsRange")}</strong>
                {t("home.aboutPara1b")}
                <strong>{t("home.aboutPara1LockIn")}</strong>
                {t("home.aboutPara1c")}
              </p>
              <p>
                {t("home.aboutPara2a")}
                <strong>{t("home.aboutPara2Easy")}</strong>
              </p>
              <Link to="/signup" className="mkt-btn mkt-btn-primary">
                {t("home.aboutJoinCta")}
              </Link>
            </div>
            <div className="mkt-stats">
              <div className="mkt-stat">
                <strong>{t("home.aboutStat1Num")}</strong>
                <span>{t("home.aboutStat1Label")}</span>
              </div>
              <div className="mkt-stat">
                <strong>{t("home.aboutStat2Num")}</strong>
                <span>{t("home.aboutStat2Label")}</span>
              </div>
              <div className="mkt-stat">
                <strong>{t("home.aboutStat3Num")}</strong>
                <span>{t("home.aboutStat3Label")}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mkt-section" style={{ background: "var(--color-bg-alt)" }} id="story">
        <div className="mkt-container mkt-prose" style={{ maxWidth: "720px", margin: "0 auto", textAlign: "center" }}>
          <h2 className="mkt-section-title">{t("home.storyTitle")}</h2>
          <p>
            {t("home.storyPara_a")}
            <strong>{t("home.storyYear1")}</strong>
            {t("home.storyPara_b")}
            <strong>{t("home.storyYear2")}</strong>
            {t("home.storyPara_c")}
            <strong>{t("home.storyMembers")}</strong>
            {t("home.storyPara_d")}
            <strong>{t("home.storyMission")}</strong>
            {t("home.storyPara_e")}
          </p>
        </div>
      </section>

      <section className="mkt-section mkt-about" id="membership">
        <div className="mkt-container">
          <h2 className="mkt-section-title">{t("home.membershipTitle")}</h2>
          <p className="mkt-section-sub">{t("home.membershipSub")}</p>
          <div className="mkt-split">
            <div className="mkt-prose">
              <h3 className="mkt-subhead">{t("home.membershipCostsHead")}</h3>
              <ul>
                <li>
                  <strong>{t("home.membershipFee1Amt")}</strong>
                  {t("home.membershipFee1")}
                </li>
                <li>
                  <strong>{t("home.membershipFee2Amt")}</strong>
                  {t("home.membershipFee2")}
                </li>
                <li>
                  <strong>{t("home.membershipFee3Amt")}</strong>
                  {t("home.membershipFee3a")}
                  <strong>{t("home.membershipFee3Age")}</strong>
                  {t("home.membershipFee3b")}
                </li>
              </ul>
              <p className="mkt-callout mkt-callout--muted" style={{ marginTop: "1rem" }}>
                <strong>{t("home.membershipFeeNoteLabel")}</strong>
                {t("home.membershipFeeNote")}
              </p>
              <h3 className="mkt-subhead">{t("home.membershipDeliveryHead")}</h3>
              <p>
                {t("home.membershipDelivery_a")}
                <strong>{t("home.membershipDeliveryAuto")}</strong>
                {t("home.membershipDelivery_b")}
                <strong>{t("home.membershipDeliveryWillCall")}</strong>
                {t("home.membershipDelivery_c")}
              </p>
              <h3 className="mkt-subhead">{t("home.membershipReferralHead")}</h3>
              <p>
                {t("home.membershipReferral_a")}
                <strong>{t("home.membershipReferralCount")}</strong>
                {t("home.membershipReferral_b")}
                <strong>{t("home.membershipReferralLifetime")}</strong>
                {t("home.membershipReferral_c")}
              </p>
              <div className="mkt-callout" style={{ marginTop: "1rem" }}>
                <h3>{t("home.membershipNextStepTitle")}</h3>
                <p>
                  {t("home.membershipNextStep_a")}
                  <strong>{t("home.membershipNextStepAmt")}</strong>
                  {t("home.membershipNextStep_b")}
                </p>
              </div>
            </div>
            <div>
              <div className="mkt-callout">
                <h3>{t("home.membershipSideTitle")}</h3>
                <p className="mkt-prose" style={{ margin: 0 }}>
                  {t("home.membershipSideBody")}
                </p>
              </div>
              <div className="mkt-pill-row">
                <span className="mkt-pill">{t("home.membershipPill1")}</span>
                <span className="mkt-pill">{t("home.membershipPill2")}</span>
                <span className="mkt-pill">{t("home.membershipPill3")}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mkt-section" id="services">
        <div className="mkt-container">
          <h2 className="mkt-section-title">{t("home.servicesTitle")}</h2>
          <p className="mkt-section-sub">{t("home.servicesSub")}</p>
          <ul className="mkt-services-grid" style={{ marginBottom: "2rem" }}>
            <a href="#services">{t("home.servicesLinkHeatingOil")}</a>
            <a href="#services">{t("home.servicesLinkHeatingPrices")}</a>
            <a href="#services">{t("home.servicesLinkBioheat")}</a>
            <a href="#services">{t("home.servicesLinkPropane")}</a>
            <a href="#services">{t("home.servicesLinkElectricity")}</a>
            <span>{t("home.servicesLinkCompost")}</span>
            <a href="#services">{t("home.servicesLinkAudits")}</a>
            <a href="#services">{t("home.servicesLinkInsurance")}</a>
            <a href="#services">{t("home.servicesLinkSolar")}</a>
            <Link to="/signup">{t("home.servicesLinkJoin")}</Link>
          </ul>
          <div className="mkt-service-acc">
            <ServiceDetails title={t("home.svcOilTitle")}>
              <p>
                {t("home.svcOilP1_a")}
                <strong>{t("home.svcOilFullService")}</strong>
                {t("home.svcOilP1_b")}
                <strong>{t("home.svcOilBelow")}</strong>
                {t("home.svcOilP1_c")}
                <strong>{t("home.svcOilContracts")}</strong>
                {t("home.svcOilP1_d")}
                <strong>{t("home.svcOilBudget")}</strong>
                {t("home.svcOilP1_e")}
              </p>
              <p>{t("home.svcOilP2")}</p>
            </ServiceDetails>
            <ServiceDetails title={t("home.svcPropaneTitle")}>
              <p>
                {t("home.svcPropaneP1_a")}
                <strong>{t("home.svcPropaneTankRental")}</strong>
                {t("home.svcPropaneP1_b")}
              </p>
              <p>
                {t("home.svcPropaneP2_a")}
                <strong>{t("home.svcPropaneAddNoFee")}</strong>
                {t("home.svcPropaneP2_b")}
              </p>
            </ServiceDetails>
            <ServiceDetails title={t("home.svcBioheatTitle")}>
              <p>
                <strong>{t("home.svcBioheatB20")}</strong>
                {t("home.svcBioheatP1_a")}
                <strong>{t("home.svcBioheatAstm")}</strong>
                {t("home.svcBioheatP1_b")}
              </p>
              <p>{t("home.svcBioheatP2")}</p>
              <ul>
                <li>{t("home.svcBioheatLi1")}</li>
                <li>{t("home.svcBioheatLi2")}</li>
              </ul>
              <p>{t("home.svcBioheatP3")}</p>
            </ServiceDetails>
            <ServiceDetails title={t("home.svcSolarTitle")}>
              <p>{t("home.svcSolarP1")}</p>
              <p>
                {t("home.svcSolarP2_a")}
                <strong>{t("home.svcSolarIncentive")}</strong>
                {t("home.svcSolarP2_b")}
              </p>
            </ServiceDetails>
            <ServiceDetails title={t("home.svcAuditsTitle")}>
              <p>
                {t("home.svcAuditsP1_a")}
                <strong>{t("home.svcAuditsNese")}</strong>
                {t("home.svcAuditsP1_b")}
                <strong>{t("home.svcAuditsCopay")}</strong>
                {t("home.svcAuditsP1_c")}
                <strong>{t("home.svcAuditsCopayAmt")}</strong>
                {t("home.svcAuditsP1_d")}
              </p>
              <p>{t("home.svcAuditsP2")}</p>
            </ServiceDetails>
            <ServiceDetails title={t("home.svcInsuranceTitle")}>
              <p>
                {t("home.svcInsuranceP1_a")}
                <strong>{t("home.svcInsuranceBearingstar")}</strong>
                {t("home.svcInsuranceP1_b")}
                <strong>{t("home.svcInsuranceSavings")}</strong>
                {t("home.svcInsuranceP1_c")}
              </p>
            </ServiceDetails>
            <ServiceDetails title={t("home.svcElectricTitle")}>
              <p>
                <strong>{t("home.svcElectricStatusLabel")}</strong>
                {t("home.svcElectricP1_a")}
                <strong>{t("home.svcElectricNoLive")}</strong>
                {t("home.svcElectricP1_b")}
                <strong>{t("home.svcElectricCall")}</strong>
                {t("home.svcElectricP1_c")}
              </p>
            </ServiceDetails>
            <ServiceDetails title={t("home.svcCompostTitle")}>
              <p>
                {t("home.svcCompostP1_a")}
                <a href="https://oilco-op.com/" target="_blank" rel="noopener noreferrer">
                  {t("home.svcCompostLink")}
                </a>
                {t("home.svcCompostP1_b")}
              </p>
            </ServiceDetails>
          </div>
        </div>
      </section>

      <section className="mkt-section" id="green" style={{ background: "var(--color-surface)" }}>
        <div className="mkt-container mkt-split">
          <div>
            <h2 className="mkt-section-title" style={{ textAlign: "left" }}>
              {t("home.greenTitle")}
            </h2>
            <p className="mkt-prose">
              <strong>{t("home.greenP_a")}</strong>
              {t("home.greenP_b")}
              <strong>{t("home.greenP_c")}</strong>
              {t("home.greenP_d")}
              <strong>{t("home.greenP_e")}</strong>
              {t("home.greenP_f")}
            </p>
          </div>
          <div className="mkt-callout mkt-callout--muted">
            <h3>{t("home.greenCalloutTitle")}</h3>
            <p className="mkt-prose" style={{ margin: 0 }}>
              {t("home.greenCalloutBody")}
            </p>
          </div>
        </div>
      </section>

      <section className="mkt-quote">
        <div className="mkt-container">
          <p>
            <em>{t("home.quoteText")}</em>
          </p>
          <a href="https://oilco-op.com/" className="mkt-video-cta" target="_blank" rel="noopener noreferrer">
            {t("home.quoteCta")}
          </a>
        </div>
      </section>

      <section className="mkt-section" id="community">
        <div className="mkt-container">
          <h2 className="mkt-section-title">{t("home.communityTitle")}</h2>
          <p className="mkt-section-sub">{t("home.communitySub")}</p>
          <ul className="mkt-partners">
            <li>
              <strong>{t("home.communityP1Name")}</strong>
              {t("home.communityP1Desc")}
            </li>
            <li>
              <strong>{t("home.communityP2Name")}</strong>
              {t("home.communityP2Desc")}
            </li>
            <li>
              <strong>{t("home.communityP3Name")}</strong>
              {t("home.communityP3Desc")}
            </li>
            <li>
              <strong>{t("home.communityP4Name")}</strong>
              {t("home.communityP4Desc")}
            </li>
            <li>
              <strong>{t("home.communityP5Name")}</strong>
              {t("home.communityP5Desc")}
            </li>
            <li>
              <strong>{t("home.communityP6Name")}</strong>
              {t("home.communityP6Desc")}
            </li>
          </ul>
        </div>
      </section>

      <section className="mkt-section" style={{ background: "var(--color-bg-alt)" }} id="news">
        <div className="mkt-container mkt-prose" style={{ maxWidth: "640px", margin: "0 auto", textAlign: "center" }}>
          <h2 className="mkt-section-title">{t("home.newsTitle")}</h2>
          <p>{t("home.newsBody")}</p>
          <a href="https://oilco-op.com/" className="mkt-btn mkt-btn-primary" target="_blank" rel="noopener noreferrer">
            {t("home.newsCta")}
          </a>
        </div>
      </section>

      <section className="mkt-section mkt-about" id="contact">
        <div className="mkt-container">
          <h2 className="mkt-section-title">{t("home.contactTitle")}</h2>
          <p className="mkt-section-sub">{t("home.contactSub")}</p>
          <div className="mkt-contact-grid">
            <div className="mkt-contact-item">
              <strong>{t("home.contactPhoneLabel")}</strong>
              <br />
              <a href="tel:8605616011">{t("home.contactPhoneValue")}</a>
            </div>
            <div className="mkt-contact-item">
              <strong>{t("home.contactEmailLabel")}</strong>
              <br />
              <a href="mailto:hutson@oilco-op.com">{t("home.contactEmailValue")}</a>
            </div>
            <div className="mkt-contact-item">
              <strong>{t("home.contactFaxLabel")}</strong>
              <br />
              {t("home.contactFaxValue")}
            </div>
            <div className="mkt-contact-item">
              <strong>{t("home.contactOfficeLabel")}</strong>
              <br />
              {t("home.contactOfficeValue")}
            </div>
          </div>
        </div>
      </section>

      <section className="mkt-join" id="get-started">
        <div className="mkt-join-box">
          <h2>{t("home.getStartedTitle")}</h2>
          <p>
            <strong>{t("home.getStartedCallLabel")}</strong>{" "}
            <a href="tel:8605616011" className="mkt-phone">
              {t("home.getStartedPhone")}
            </a>
          </p>
          <p>{t("home.getStartedFuels")}</p>
          <div className="mkt-hero-actions" style={{ justifyContent: "center" }}>
            <Link to="/signup" className="mkt-btn mkt-btn-primary mkt-btn-lg">
              {t("home.getStartedJoinCta")}
            </Link>
          </div>
          <p className="mkt-sync-note">{t("home.getStartedNote")}</p>
        </div>
      </section>
    </>
  );
}

/* ------------------------------------------------------------------
   Reference-aligned professional sections
   ------------------------------------------------------------------ */

/**
 * Image placeholder slot, wired for real photography.
 * Pass `src` to render the real photo; otherwise a styled, labelled
 * placeholder shows so staff can see exactly where art goes.
 */
export function ImageSlot({
  src,
  alt,
  label,
  className = "",
}: {
  src?: string;
  alt: string;
  label: string;
  className?: string;
}) {
  if (src) {
    return <img src={src} alt={alt} className={`mkt-img ${className}`.trim()} />;
  }
  return (
    <div className={`mkt-img-slot ${className}`.trim()} role="img" aria-label={alt}>
      <span className="mkt-img-slot-icon" aria-hidden>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <circle cx="8.5" cy="9.5" r="1.6" />
          <path d="M21 16l-5-5-6 6-3-3-4 4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className="mkt-img-slot-label">{label}</span>
    </div>
  );
}

/** Dark-green value-proposition band under the hero. */
export function ValueBand() {
  const t = useSiteText();
  const values = [
    {
      titleKey: "home.value1Title",
      bodyKey: "home.value1Body",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      titleKey: "home.value2Title",
      bodyKey: "home.value2Body",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M3 6.5A2 2 0 0 1 5 5h5a2 2 0 0 1 2 2v12a1.5 1.5 0 0 0-1.5-1.5H3zM21 6.5A2 2 0 0 0 19 5h-5a2 2 0 0 0-2 2v12a1.5 1.5 0 0 1 1.5-1.5H21z" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      titleKey: "home.value3Title",
      bodyKey: "home.value3Body",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="9" cy="8" r="3" />
          <path d="M2.5 20a6.5 6.5 0 0 1 13 0" strokeLinecap="round" />
          <path d="M16 6.2a3 3 0 0 1 0 5.6M18 3.6a6.5 6.5 0 0 1 3.5 8.4" strokeLinecap="round" />
        </svg>
      ),
    },
  ];
  return (
    <section className="mkt-valueband" aria-label="Why members join">
      <div className="mkt-valueband-inner">
        {values.map((v) => (
          <div className="mkt-value" key={v.titleKey}>
            <span className="mkt-value-icon" aria-hidden>
              {v.icon}
            </span>
            <div>
              <h3>{t(v.titleKey)}</h3>
              <p>{t(v.bodyKey)}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Real savings — figure + member testimonial placeholder + photo slot. */
export function SavingsSection() {
  const t = useSiteText();
  return (
    <section className="mkt-section mkt-savings" id="savings">
      <div className="mkt-container">
        <div className="mkt-savings-grid">
          <div className="mkt-savings-lead">
            <p className="mkt-eyebrow" style={{ textAlign: "left" }}>
              {t("home.savingsEyebrow")}
            </p>
            <h2>{t("home.savingsHeading")}</h2>
            <span className="mkt-savings-figure">{t("home.savingsFigure")}</span>
            <p>
              {t("home.savingsSubA")}
              <strong>{t("home.savingsGallons")}</strong>
              {t("home.savingsSubB")}
            </p>
            <Link to="/signup" className="mkt-btn mkt-btn-primary">
              {t("home.savingsJoinCta")}
            </Link>
          </div>

          <figure className="mkt-savings-quote">
            <Stars />
            <blockquote>{t("home.savingsQuote")}</blockquote>
            <cite>
              <strong>{t("home.savingsQuoteName")}</strong>
              {t("home.savingsQuoteMeta")}
            </cite>
          </figure>

          <ImageSlot
            src={siteImageUrl("/site/family.jpg")}
            alt="A local family outside their home in winter"
            label="Photo: a member family at home in winter"
            className="mkt-img-slot--tall"
          />
        </div>
      </div>
    </section>
  );
}

/** Feature row — "Why thousands choose Citizen's Oil Co-op". */
export function WhyChooseSection() {
  const t = useSiteText();
  const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.7 } as const;
  const features = [
    {
      titleKey: "home.whyFeature1Title",
      bodyKey: "home.whyFeature1Body",
      icon: (
        <svg width="26" height="26" viewBox="0 0 24 24" {...stroke}>
          <path d="M12 3l7 3v5c0 4.4-2.9 8-7 9-4.1-1-7-4.6-7-9V6z" strokeLinejoin="round" />
          <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      titleKey: "home.whyFeature2Title",
      bodyKey: "home.whyFeature2Body",
      icon: (
        <svg width="26" height="26" viewBox="0 0 24 24" {...stroke}>
          <path d="M4 11l8-6 8 6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M6 10v9h12v-9" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      titleKey: "home.whyFeature3Title",
      bodyKey: "home.whyFeature3Body",
      icon: (
        <svg width="26" height="26" viewBox="0 0 24 24" {...stroke}>
          <path d="M2 7h11v8H2zM13 10h4l3 3v2h-7z" strokeLinejoin="round" />
          <circle cx="6" cy="17" r="1.6" />
          <circle cx="17" cy="17" r="1.6" />
        </svg>
      ),
    },
    {
      titleKey: "home.whyFeature4Title",
      bodyKey: "home.whyFeature4Body",
      icon: (
        <svg width="26" height="26" viewBox="0 0 24 24" {...stroke}>
          <rect x="3" y="6" width="18" height="12" rx="2" />
          <circle cx="12" cy="12" r="2.4" />
        </svg>
      ),
    },
    {
      titleKey: "home.whyFeature5Title",
      bodyKey: "home.whyFeature5Body",
      icon: (
        <svg width="26" height="26" viewBox="0 0 24 24" {...stroke}>
          <path d="M6 3h9l3 3v15H6z" strokeLinejoin="round" />
          <path d="M9 11h6M9 15h6" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      titleKey: "home.whyFeature6Title",
      bodyKey: "home.whyFeature6Body",
      icon: (
        <svg width="26" height="26" viewBox="0 0 24 24" {...stroke}>
          <path d="M12 21c5-3.5 7.5-7 7.5-10.5A7.5 7.5 0 0 0 12 3a7.5 7.5 0 0 0-7.5 7.5C4.5 14 7 17.5 12 21z" strokeLinejoin="round" />
          <circle cx="12" cy="10.5" r="2.2" />
        </svg>
      ),
    },
  ];
  return (
    <section className="mkt-section mkt-why" id="why">
      <div className="mkt-container">
        <p className="mkt-eyebrow">{t("home.whyEyebrow")}</p>
        <h2 className="mkt-section-title">{t("home.whyTitle")}</h2>
        <div className="mkt-rule" aria-hidden />
        <div className="mkt-why-grid">
          {features.map((f) => (
            <div className="mkt-why-item" key={f.titleKey}>
              <span className="mkt-why-icon" aria-hidden>
                {f.icon}
              </span>
              <h3>{t(f.titleKey)}</h3>
              <p>{t(f.bodyKey)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Star rating (five filled). */
function Stars() {
  return (
    <span className="mkt-stars" aria-label="Five out of five stars">
      {[0, 1, 2, 3, 4].map((i) => (
        <svg key={i} width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M12 2l2.9 6 6.6.6-5 4.3 1.5 6.5L12 16.9 5.9 19.4 7.4 12.9l-5-4.3 6.6-.6z" />
        </svg>
      ))}
    </span>
  );
}

/** Three member testimonials with star ratings. */
export function TestimonialsBand() {
  const t = useSiteText();
  const quotes = [
    {
      textKey: "home.testimonial1Text",
      nameKey: "home.testimonial1Name",
      metaKey: "home.testimonial1Meta",
    },
    {
      textKey: "home.testimonial2Text",
      nameKey: "home.testimonial2Name",
      metaKey: "home.testimonial2Meta",
    },
    {
      textKey: "home.testimonial3Text",
      nameKey: "home.testimonial3Name",
      metaKey: "home.testimonial3Meta",
    },
  ];
  return (
    <section className="mkt-section" id="testimonials">
      <div className="mkt-container">
        <p className="mkt-eyebrow">{t("home.testimonialsEyebrow")}</p>
        <h2 className="mkt-section-title">{t("home.testimonialsTitle")}</h2>
        <div className="mkt-rule" aria-hidden />
        <div className="mkt-testimonials">
          {quotes.map((q) => (
            <figure className="mkt-quote-card" key={q.nameKey}>
              <Stars />
              <blockquote>&ldquo;{t(q.textKey)}&rdquo;</blockquote>
              <cite>
                <strong>{t(q.nameKey)}</strong>
                {t(q.metaKey)}
              </cite>
            </figure>
          ))}
        </div>
        <p className="mkt-sync-note" style={{ textAlign: "center", marginTop: "1.5rem" }}>
          {t("home.testimonialsNote")}
        </p>
      </div>
    </section>
  );
}

/** Closing call-to-action band over a photo slot. */
export function FinalCtaBand() {
  const t = useSiteText();
  return (
    <section className="mkt-finalcta" id="join">
      <div className="mkt-finalcta-bg" aria-hidden>
        <ImageSlot src={siteImageUrl("/site/house.jpg")} alt="" label="Photo: a warm, lit home on a winter evening" />
      </div>
      <div className="mkt-finalcta-inner">
        <h2>{t("home.finalCtaTitle")}</h2>
        <p>{t("home.finalCtaBody")}</p>
        <div className="mkt-finalcta-actions">
          <Link to="/signup" className="mkt-btn mkt-btn-lg mkt-btn-on-accent">
            {t("home.finalCtaJoinCta")}
          </Link>
          <a href="tel:8605616011" className="mkt-finalcta-phone">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <path d="M5 4h3l1.5 4-2 1.5a11 11 0 0 0 5 5l1.5-2 4 1.5V19a2 2 0 0 1-2.2 2A16 16 0 0 1 4 6.2 2 2 0 0 1 6 4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {t("home.finalCtaPhone")}
          </a>
        </div>
        <p className="mkt-finalcta-check">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {t("home.finalCtaCheck")}
        </p>
      </div>
    </section>
  );
}
