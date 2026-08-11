import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import type { ContentGroup } from "./content/types";
import { useSiteText } from "./content/SiteContentContext";

type FaqItem = {
  qKey: string;
  render: (t: (key: string) => string) => ReactNode;
};

type FaqCategory = {
  id: string;
  titleKey: string;
  items: FaqItem[];
};

const CATEGORIES: FaqCategory[] = [
  {
    id: "general",
    titleKey: "faq.general.title",
    items: [
      {
        qKey: "faq.general.q1",
        render: (t) => <p>{t("faq.general.a1")}</p>,
      },
      {
        qKey: "faq.general.q2",
        render: (t) => <p>{t("faq.general.a2")}</p>,
      },
      {
        qKey: "faq.general.q3",
        render: (t) => <p>{t("faq.general.a3")}</p>,
      },
      {
        qKey: "faq.general.q4",
        render: (t) => (
          <>
            <p>{t("faq.general.a4.intro")}</p>
            <ul>
              <li>{t("faq.general.a4.li1")}</li>
              <li>{t("faq.general.a4.li2")}</li>
              <li>{t("faq.general.a4.li3")}</li>
              <li>{t("faq.general.a4.li4")}</li>
            </ul>
            <p>{t("faq.general.a4.outro")}</p>
          </>
        ),
      },
    ],
  },
  {
    id: "membership",
    titleKey: "faq.membership.title",
    items: [
      {
        qKey: "faq.membership.q1",
        render: (t) => <p>{t("faq.membership.a1")}</p>,
      },
      {
        qKey: "faq.membership.q2",
        render: (t) => (
          <>
            <p>{t("faq.membership.a2.intro")}</p>
            <ul>
              <li>{t("faq.membership.a2.li1")}</li>
              <li>{t("faq.membership.a2.li2")}</li>
              <li>{t("faq.membership.a2.li3")}</li>
              <li>{t("faq.membership.a2.li4")}</li>
              <li>{t("faq.membership.a2.li5")}</li>
              <li>{t("faq.membership.a2.li6")}</li>
            </ul>
          </>
        ),
      },
      {
        qKey: "faq.membership.q3",
        render: (t) => <p>{t("faq.membership.a3")}</p>,
      },
    ],
  },
  {
    id: "pricing",
    titleKey: "faq.pricing.title",
    items: [
      {
        qKey: "faq.pricing.q1",
        render: (t) => (
          <>
            <p>{t("faq.pricing.a1.p1")}</p>
            <p>{t("faq.pricing.a1.p2")}</p>
            <p>{t("faq.pricing.a1.p3")}</p>
          </>
        ),
      },
      {
        qKey: "faq.pricing.q2",
        render: (t) => (
          <>
            <p>{t("faq.pricing.a2.p1")}</p>
            <p>{t("faq.pricing.a2.p2")}</p>
          </>
        ),
      },
      {
        qKey: "faq.pricing.q3",
        render: (t) => <p>{t("faq.pricing.a3")}</p>,
      },
    ],
  },
  {
    id: "choosing-company",
    titleKey: "faq.choosing.title",
    items: [
      {
        qKey: "faq.choosing.q1",
        render: (t) => <p>{t("faq.choosing.a1")}</p>,
      },
      {
        qKey: "faq.choosing.q2",
        render: (t) => <p>{t("faq.choosing.a2")}</p>,
      },
      {
        qKey: "faq.choosing.q3",
        render: (t) => <p>{t("faq.choosing.a3")}</p>,
      },
      {
        qKey: "faq.choosing.q4",
        render: (t) => <p>{t("faq.choosing.a4")}</p>,
      },
      {
        qKey: "faq.choosing.q5",
        render: (t) => <p>{t("faq.choosing.a5")}</p>,
      },
      {
        qKey: "faq.choosing.q6",
        render: (t) => <p>{t("faq.choosing.a6")}</p>,
      },
      {
        qKey: "faq.choosing.q7",
        render: (t) => <p>{t("faq.choosing.a7")}</p>,
      },
    ],
  },
  {
    id: "propane",
    titleKey: "faq.propane.title",
    items: [
      {
        qKey: "faq.propane.q1",
        render: (t) => <p>{t("faq.propane.a1")}</p>,
      },
      {
        qKey: "faq.propane.q2",
        render: (t) => (
          <>
            <p>{t("faq.propane.a2.p1")}</p>
            <p>{t("faq.propane.a2.p2")}</p>
          </>
        ),
      },
      {
        qKey: "faq.propane.q3",
        render: (t) => (
          <>
            <p>{t("faq.propane.a3.intro")}</p>
            <p>
              <strong>{t("faq.propane.a3.ownLabel")}</strong>
            </p>
            <ul>
              <li>{t("faq.propane.a3.own1")}</li>
              <li>{t("faq.propane.a3.own2")}</li>
              <li>{t("faq.propane.a3.own3")}</li>
              <li>{t("faq.propane.a3.own4")}</li>
            </ul>
            <p>
              <strong>{t("faq.propane.a3.rentLabel")}</strong>
            </p>
            <ul>
              <li>{t("faq.propane.a3.rent1")}</li>
              <li>{t("faq.propane.a3.rent2")}</li>
              <li>{t("faq.propane.a3.rent3")}</li>
              <li>{t("faq.propane.a3.rent4")}</li>
            </ul>
            <p>{t("faq.propane.a3.outro")}</p>
          </>
        ),
      },
      {
        qKey: "faq.propane.q4",
        render: (t) => (
          <>
            <p>{t("faq.propane.a4.p1")}</p>
            <p>{t("faq.propane.a4.intro")}</p>
            <ul>
              <li>{t("faq.propane.a4.li1")}</li>
              <li>{t("faq.propane.a4.li2")}</li>
              <li>{t("faq.propane.a4.li3")}</li>
              <li>{t("faq.propane.a4.li4")}</li>
            </ul>
            <p>{t("faq.propane.a4.outro")}</p>
          </>
        ),
      },
    ],
  },
  {
    id: "whats-next",
    titleKey: "faq.whatsNext.title",
    items: [
      {
        qKey: "faq.whatsNext.q1",
        render: (t) => <p>{t("faq.whatsNext.a1")}</p>,
      },
      {
        qKey: "faq.whatsNext.q2",
        render: (t) => <p>{t("faq.whatsNext.a2")}</p>,
      },
      {
        qKey: "faq.whatsNext.q3",
        render: (t) => <p>{t("faq.whatsNext.a3")}</p>,
      },
      {
        qKey: "faq.whatsNext.q4",
        render: (t) => <p>{t("faq.whatsNext.a4")}</p>,
      },
    ],
  },
];

/** Editable copy for the "FAQ" page. */
export const FAQ_CONTENT: ContentGroup = {
  page: "faq",
  title: "FAQ",
  fields: [
    { key: "faq.title", label: "Page title", value: "Frequently asked questions" },
    {
      key: "faq.lead",
      label: "Intro paragraph",
      multiline: true,
      value:
        "Answers about membership, pricing, choosing a heating company, propane tanks, and what happens after you join.",
    },

    // General Information
    { key: "faq.general.title", label: "Category: General Information — title", value: "General Information" },
    { key: "faq.general.q1", label: "Q: What is Citizen's Oil Co-op?", value: "What is Citizen's Oil Co-op?" },
    {
      key: "faq.general.a1",
      label: "A: What is Citizen's Oil Co-op?",
      multiline: true,
      value:
        "Citizen's Oil Co-op is a membership-based buyers club that helps homeowners save money on heating oil, propane, and other home energy services. We negotiate competitive pricing with trusted local full-service companies and help members find the best fit for their home.",
    },
    {
      key: "faq.general.q2",
      label: "Q: How long has Citizen's Oil Co-op been in business?",
      value: "How long has Citizen's Oil Co-op been in business?",
    },
    {
      key: "faq.general.a2",
      label: "A: How long has Citizen's Oil Co-op been in business?",
      multiline: true,
      value:
        "We've been helping homeowners save on home energy for over 30 years and proudly serve more than 5,000 members throughout Connecticut, Rhode Island, Westchester County NY, and select communities in Massachusetts.",
    },
    { key: "faq.general.q3", label: "Q: Do you deliver heating oil or propane?", value: "Do you deliver heating oil or propane?" },
    {
      key: "faq.general.a3",
      label: "A: Do you deliver heating oil or propane?",
      multiline: true,
      value:
        "No. We don't deliver fuel or service heating equipment. Instead, we partner with trusted local full-service heating oil and propane companies that handle deliveries, equipment service, and customer support at a discounted price for members.",
    },
    { key: "faq.general.q4", label: "Q: What is your service area?", value: "What is your service area?" },
    { key: "faq.general.a4.intro", label: "A: Service area — intro", value: "We proudly serve homeowners throughout:" },
    { key: "faq.general.a4.li1", label: "A: Service area — item 1", value: "Connecticut – All towns" },
    { key: "faq.general.a4.li2", label: "A: Service area — item 2", value: "Rhode Island – All towns" },
    { key: "faq.general.a4.li3", label: "A: Service area — item 3", value: "New York – Westchester County only" },
    { key: "faq.general.a4.li4", label: "A: Service area — item 4", value: "Select communities in Massachusetts" },
    {
      key: "faq.general.a4.outro",
      label: "A: Service area — closing",
      multiline: true,
      value: "If you're unsure whether your town is covered, just contact us—we're happy to help.",
    },

    // Membership
    { key: "faq.membership.title", label: "Category: Membership — title", value: "Membership" },
    { key: "faq.membership.q1", label: "Q: How much does membership cost?", value: "How much does membership cost?" },
    {
      key: "faq.membership.a1",
      label: "A: How much does membership cost?",
      multiline: true,
      value:
        "Membership is $35 per year ($25 for seniors) with a one-time $10 application fee for new accounts and provides access to Co-op pricing along with additional member benefits. You can join at any time. Canceling your Co-op membership does not terminate your oil or propane account. You must contact the company directly to do this.",
    },
    { key: "faq.membership.q2", label: "Q: What does membership include?", value: "What does membership include?" },
    { key: "faq.membership.a2.intro", label: "A: Membership include — intro", value: "Membership includes:" },
    {
      key: "faq.membership.a2.li1",
      label: "A: Membership include — item 1",
      value: "Access to Co-op negotiated heating oil or propane pricing",
    },
    { key: "faq.membership.a2.li2", label: "A: Membership include — item 2", value: "Electricity supply rate options" },
    {
      key: "faq.membership.a2.li3",
      label: "A: Membership include — item 3",
      value: "Free solar consultation through Trinity Solar",
    },
    {
      key: "faq.membership.a2.li4",
      label: "A: Membership include — item 4",
      value: "Discounted Home Energy Audit through New England Smart Energy",
    },
    {
      key: "faq.membership.a2.li5",
      label: "A: Membership include — item 5",
      value: "Free home and auto insurance quote from Bearingstar Insurance",
    },
    {
      key: "faq.membership.a2.li6",
      label: "A: Membership include — item 6",
      value: "Additional seasonal offers and member discounts",
    },
    { key: "faq.membership.q3", label: "Q: Who should join the Co-op?", value: "Who should join the Co-op?" },
    {
      key: "faq.membership.a3",
      label: "A: Who should join the Co-op?",
      multiline: true,
      value:
        "Our members are homeowners who want competitive pricing, dependable service, and the peace of mind that comes from working with a trusted local company—without spending hours shopping around every year.",
    },

    // Pricing
    { key: "faq.pricing.title", label: "Category: Pricing — title", value: "Pricing" },
    { key: "faq.pricing.q1", label: "Q: How does Co-op pricing work?", value: "How does Co-op pricing work?" },
    {
      key: "faq.pricing.a1.p1",
      label: "A: How does Co-op pricing work? — paragraph 1",
      multiline: true,
      value:
        "Co-op pricing is a discounted variable price that changes with the energy market. Through our long-term agreements with participating heating oil and propane companies, members receive competitive pricing that reflects current market conditions.",
    },
    {
      key: "faq.pricing.a1.p2",
      label: "A: How does Co-op pricing work? — paragraph 2",
      multiline: true,
      value:
        "If market prices go down, your Co-op price goes down. If market prices increase, your Co-op price will adjust accordingly.",
    },
    {
      key: "faq.pricing.a1.p3",
      label: "A: How does Co-op pricing work? — paragraph 3",
      multiline: true,
      value:
        "Each morning, we provide our participating companies with that day's Co-op price, and members are billed the Co-op price in effect on the date of their delivery.",
    },
    { key: "faq.pricing.q2", label: "Q: Is the Co-op price fixed?", value: "Is the Co-op price fixed?" },
    {
      key: "faq.pricing.a2.p1",
      label: "A: Is the Co-op price fixed? — paragraph 1",
      multiline: true,
      value:
        "No. Heating oil and propane prices change with the energy market. Your Co-op pricing changes as market prices change, but it's based on pricing we've negotiated with our participating companies.",
    },
    {
      key: "faq.pricing.a2.p2",
      label: "A: Is the Co-op price fixed? — paragraph 2",
      multiline: true,
      value:
        "We do work with one oil company that offers a fixed rate for members. Please call us or request more information to see if this company covers your town.",
    },
    { key: "faq.pricing.q3", label: "Q: How much can I save?", value: "How much can I save?" },
    {
      key: "faq.pricing.a3",
      label: "A: How much can I save?",
      multiline: true,
      value:
        "Savings vary depending on market conditions and your location, but the average Co-op member can save up to $600 a year. (Based on usage of 900 gallons.)",
    },

    // Choosing Your Heating Company
    {
      key: "faq.choosing.title",
      label: "Category: Choosing Your Heating Company — title",
      value: "Choosing Your Heating Company",
    },
    {
      key: "faq.choosing.q1",
      label: "Q: How do you decide which company I'll use?",
      value: "How do you decide which company I'll use?",
    },
    {
      key: "faq.choosing.a1",
      label: "A: How do you decide which company I'll use?",
      multiline: true,
      value:
        "We recommend the participating company from our network that's the best overall fit based on your location, pricing, service options, and personal preferences.",
    },
    {
      key: "faq.choosing.q2",
      label: "Q: Can I keep my current heating company?",
      value: "Can I keep my current heating company?",
    },
    {
      key: "faq.choosing.a2",
      label: "A: Can I keep my current heating company?",
      multiline: true,
      value:
        "If you're already using one of our participating companies, we'll usually keep you with that company while applying Co-op pricing to your account. Nothing will change with your service other than a better price on your oil or propane.",
    },
    { key: "faq.choosing.q3", label: "Q: Can I choose a specific company?", value: "Can I choose a specific company?" },
    {
      key: "faq.choosing.a3",
      label: "A: Can I choose a specific company?",
      multiline: true,
      value:
        "Yes. If you have a preferred company, we'll do our best to accommodate your request whenever possible.",
    },
    {
      key: "faq.choosing.q4",
      label: "Q: What if my current company isn't part of the Co-op?",
      value: "What if my current company isn't part of the Co-op?",
    },
    {
      key: "faq.choosing.a4",
      label: "A: What if my current company isn't part of the Co-op?",
      multiline: true,
      value:
        "To take advantage of Co-op pricing you do have to work with one of the companies in our network. We'll recommend one of our participating companies that serves your area and is the best fit for you. We'll guide you through the transition and answer any questions you may have.",
    },
    { key: "faq.choosing.q5", label: "Q: Will I still receive full service?", value: "Will I still receive full service?" },
    {
      key: "faq.choosing.a5",
      label: "A: Will I still receive full service?",
      multiline: true,
      value:
        "Yes. You'll continue to receive the same full-service benefits offered by your participating company, including fuel delivery, equipment service, emergency support, and other available programs.",
    },
    {
      key: "faq.choosing.q6",
      label: "Q: Do I have to sign up for automatic delivery?",
      value: "Do I have to sign up for automatic delivery?",
    },
    {
      key: "faq.choosing.a6",
      label: "A: Do I have to sign up for automatic delivery?",
      multiline: true,
      value:
        "Not always. Some participating companies offer both automatic delivery and will-call options, while others require automatic delivery. We'll help you find the option that best fits your needs.",
    },
    {
      key: "faq.choosing.q7",
      label: "Q: Do I have to purchase a service contract?",
      value: "Do I have to purchase a service contract?",
    },
    {
      key: "faq.choosing.a7",
      label: "A: Do I have to purchase a service contract?",
      multiline: true,
      value:
        "No. Service contracts are optional, although many members choose one for added peace of mind and equipment protection. We'll explain your options so you can decide what's right for you.",
    },

    // Propane and Propane Tanks
    {
      key: "faq.propane.title",
      label: "Category: Propane and Propane Tanks — title",
      value: "Propane and Propane Tanks",
    },
    { key: "faq.propane.q1", label: "Q: Do I own my propane tank?", value: "Do I own my propane tank?" },
    {
      key: "faq.propane.a1",
      label: "A: Do I own my propane tank?",
      multiline: true,
      value: "It depends. Some homeowners own their propane tank, while others rent one from their propane provider.",
    },
    {
      key: "faq.propane.q2",
      label: "Q: What's the difference between owning and renting a propane tank?",
      value: "What's the difference between owning and renting a propane tank?",
    },
    {
      key: "faq.propane.a2.p1",
      label: "A: Owning vs renting — paragraph 1",
      multiline: true,
      value:
        "If you own your tank, you're free to choose the propane company that fills it. This gives you greater flexibility if you ever decide to switch providers.",
    },
    {
      key: "faq.propane.a2.p2",
      label: "A: Owning vs renting — paragraph 2",
      multiline: true,
      value:
        "If you rent your tank, the tank belongs to your propane company. Because of safety and liability requirements, only that company can fill or service its own tank.",
    },
    {
      key: "faq.propane.q3",
      label: "Q: Is it better to own or rent a propane tank?",
      value: "Is it better to own or rent a propane tank?",
    },
    { key: "faq.propane.a3.intro", label: "A: Own or rent — intro", value: "Both options have advantages." },
    { key: "faq.propane.a3.ownLabel", label: "A: Own or rent — owning label", value: "Owning your tank:" },
    { key: "faq.propane.a3.own1", label: "A: Own or rent — owning item 1", value: "Freedom to choose your propane supplier" },
    {
      key: "faq.propane.a3.own2",
      label: "A: Own or rent — owning item 2",
      value: "More flexibility if you decide to switch companies",
    },
    { key: "faq.propane.a3.own3", label: "A: Own or rent — owning item 3", value: "No annual tank rental fee" },
    { key: "faq.propane.a3.own4", label: "A: Own or rent — owning item 4", value: "Higher upfront investment" },
    { key: "faq.propane.a3.rentLabel", label: "A: Own or rent — renting label", value: "Renting your tank:" },
    { key: "faq.propane.a3.rent1", label: "A: Own or rent — renting item 1", value: "Little or no upfront cost" },
    {
      key: "faq.propane.a3.rent2",
      label: "A: Own or rent — renting item 2",
      value: "The propane company maintains the tank",
    },
    { key: "faq.propane.a3.rent3", label: "A: Own or rent — renting item 3", value: "Annual rental fee may apply" },
    {
      key: "faq.propane.a3.rent4",
      label: "A: Own or rent — renting item 4",
      value: "You'll typically purchase propane from that company while using their tank",
    },
    {
      key: "faq.propane.a3.outro",
      label: "A: Own or rent — closing",
      multiline: true,
      value:
        "We'll gladly explain the differences and help you understand which option best fits your situation.",
    },
    {
      key: "faq.propane.q4",
      label: "Q: Can I switch propane companies if I rent my tank?",
      value: "Can I switch propane companies if I rent my tank?",
    },
    { key: "faq.propane.a4.p1", label: "A: Switch propane companies — lead", value: "Yes." },
    {
      key: "faq.propane.a4.intro",
      label: "A: Switch propane companies — intro",
      value: "If you decide to switch propane companies, the new company will typically:",
    },
    { key: "faq.propane.a4.li1", label: "A: Switch propane companies — item 1", value: "Perform a safety inspection" },
    { key: "faq.propane.a4.li2", label: "A: Switch propane companies — item 2", value: "Remove the existing rental tank" },
    { key: "faq.propane.a4.li3", label: "A: Switch propane companies — item 3", value: "Install their own rental tank" },
    { key: "faq.propane.a4.li4", label: "A: Switch propane companies — item 4", value: "Transfer your account and service" },
    {
      key: "faq.propane.a4.outro",
      label: "A: Switch propane companies — closing",
      multiline: true,
      value:
        "If there's propane remaining in the old tank, the previous company is required to reimburse you for the unused fuel. The exact process may vary slightly by company.",
    },

    // Sign me up! What happens next?
    {
      key: "faq.whatsNext.title",
      label: "Category: Sign me up — title",
      value: "Sign me up! What happens next?",
    },
    { key: "faq.whatsNext.q1", label: "Q: What happens after I join?", value: "What happens after I join?" },
    {
      key: "faq.whatsNext.a1",
      label: "A: What happens after I join?",
      multiline: true,
      value:
        "After you become a member, we'll review your location and preferences, recommend the participating company that's the best fit, and forward your information so they can contact you to set up your oil or propane account at Co-op pricing.",
    },
    {
      key: "faq.whatsNext.q2",
      label: "Q: How long does it take to get started?",
      value: "How long does it take to get started?",
    },
    {
      key: "faq.whatsNext.a2",
      label: "A: How long does it take to get started?",
      multiline: true,
      value:
        "Most new members hear from their assigned participating company within a day or two after joining to complete their account setup. To schedule a first delivery for a new account we typically recommend 7–10 days.",
    },
    {
      key: "faq.whatsNext.q3",
      label: "Q: Why should I join Citizen's Oil Co-op instead of calling companies myself?",
      value: "Why should I join Citizen's Oil Co-op instead of calling companies myself?",
    },
    {
      key: "faq.whatsNext.a3",
      label: "A: Why should I join instead of calling companies myself?",
      multiline: true,
      value:
        "We've spent more than 30 years building relationships with trusted heating companies and negotiating competitive pricing on behalf of our members. Instead of spending your time calling multiple companies, comparing prices, and trying to determine who's offering the best value, you can rely on Citizen's Oil Co-op to help connect you with a trusted provider that fits your needs.",
    },
    {
      key: "faq.whatsNext.q4",
      label: "Q: Why do homeowners trust Citizen's Oil Co-op?",
      value: "Why do homeowners trust Citizen's Oil Co-op?",
    },
    {
      key: "faq.whatsNext.a4",
      label: "A: Why do homeowners trust Citizen's Oil Co-op?",
      multiline: true,
      value:
        "For over three decades, we've helped thousands of homeowners find competitive pricing through trusted local heating companies. Our goal is simple: make home energy easier by helping our members receive fair pricing, dependable service, and honest guidance.",
    },

    // Contact CTA
    { key: "faq.cta.lead", label: "CTA heading", value: "Ready to save on home energy?" },
    { key: "faq.cta.button", label: "CTA button", value: "Join Now" },
  ],
};

function FaqDetails({ question, children }: { question: string; children: ReactNode }) {
  return (
    <details>
      <summary>{question}</summary>
      <div className="mkt-acc-body mkt-prose">{children}</div>
    </details>
  );
}

/** FAQ page — six categories with accordion answers. Content editable in Admin → Site Content. */
export default function FaqPage() {
  const t = useSiteText();
  return (
    <div className="mkt-panel mkt-faq-panel">
      <h1 className="mkt-page-title">{t("faq.title")}</h1>
      <p className="mkt-lead">{t("faq.lead")}</p>

      <nav className="mkt-faq-toc" aria-label="FAQ categories">
        {CATEGORIES.map((cat) => (
          <a key={cat.id} href={`#${cat.id}`}>
            {t(cat.titleKey)}
          </a>
        ))}
      </nav>

      <div className="mkt-faq-categories">
        {CATEGORIES.map((cat) => (
          <section key={cat.id} id={cat.id} className="mkt-faq-category">
            <h2 className="mkt-faq-category-title">{t(cat.titleKey)}</h2>
            <div className="mkt-service-acc">
              {cat.items.map((item) => (
                <FaqDetails key={item.qKey} question={t(item.qKey)}>
                  {item.render(t)}
                </FaqDetails>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="mkt-faq-cta">
        <p className="mkt-lead" style={{ marginBottom: "1rem" }}>
          {t("faq.cta.lead")}
        </p>
        <Link to="/signup" className="mkt-btn mkt-btn-primary mkt-btn-lg">
          {t("faq.cta.button")}
        </Link>
      </div>
    </div>
  );
}
