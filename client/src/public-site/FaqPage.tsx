import { Link } from "react-router-dom";
import type { ReactNode } from "react";

type FaqItem = {
  question: string;
  answer: ReactNode;
};

type FaqCategory = {
  id: string;
  title: string;
  items: FaqItem[];
};

const CATEGORIES: FaqCategory[] = [
  {
    id: "general",
    title: "General Information",
    items: [
      {
        question: "What is Citizen's Oil Co-op?",
        answer: (
          <p>
            Citizen&apos;s Oil Co-op is a membership-based buyers club that helps homeowners save money on heating oil,
            propane, and other home energy services. We negotiate competitive pricing with trusted local full-service
            companies and help members find the best fit for their home.
          </p>
        ),
      },
      {
        question: "How long has Citizen's Oil Co-op been in business?",
        answer: (
          <p>
            We&apos;ve been helping homeowners save on home energy for over 30 years and proudly serve more than 5,000
            members throughout Connecticut, Rhode Island, Westchester County NY, and select communities in Massachusetts.
          </p>
        ),
      },
      {
        question: "Do you deliver heating oil or propane?",
        answer: (
          <p>
            No. We don&apos;t deliver fuel or service heating equipment. Instead, we partner with trusted local
            full-service heating oil and propane companies that handle deliveries, equipment service, and customer
            support at a discounted price for members.
          </p>
        ),
      },
      {
        question: "What is your service area?",
        answer: (
          <>
            <p>We proudly serve homeowners throughout:</p>
            <ul>
              <li>Connecticut – All towns</li>
              <li>Rhode Island – All towns</li>
              <li>New York – Westchester County only</li>
              <li>Select communities in Massachusetts</li>
            </ul>
            <p>If you&apos;re unsure whether your town is covered, just contact us—we&apos;re happy to help.</p>
          </>
        ),
      },
    ],
  },
  {
    id: "membership",
    title: "Membership",
    items: [
      {
        question: "How much does membership cost?",
        answer: (
          <p>
            Membership is $35 per year ($25 for seniors) with a one-time $10 application fee for new accounts and
            provides access to Co-op pricing along with additional member benefits. You can join at any time. Canceling
            your Co-op membership does not terminate your oil or propane account. You must contact the company directly
            to do this.
          </p>
        ),
      },
      {
        question: "What does membership include?",
        answer: (
          <>
            <p>Membership includes:</p>
            <ul>
              <li>Access to Co-op negotiated heating oil or propane pricing</li>
              <li>Electricity supply rate options</li>
              <li>Free solar consultation through Trinity Solar</li>
              <li>Discounted Home Energy Audit through New England Smart Energy</li>
              <li>Free home and auto insurance quote from Bearingstar Insurance</li>
              <li>Additional seasonal offers and member discounts</li>
            </ul>
          </>
        ),
      },
      {
        question: "Who should join the Co-op?",
        answer: (
          <p>
            Our members are homeowners who want competitive pricing, dependable service, and the peace of mind that comes
            from working with a trusted local company—without spending hours shopping around every year.
          </p>
        ),
      },
    ],
  },
  {
    id: "pricing",
    title: "Pricing",
    items: [
      {
        question: "How does Co-op pricing work?",
        answer: (
          <>
            <p>
              Co-op pricing is a discounted variable price that changes with the energy market. Through our long-term
              agreements with participating heating oil and propane companies, members receive competitive pricing that
              reflects current market conditions.
            </p>
            <p>
              If market prices go down, your Co-op price goes down. If market prices increase, your Co-op price will
              adjust accordingly.
            </p>
            <p>
              Each morning, we provide our participating companies with that day&apos;s Co-op price, and members are
              billed the Co-op price in effect on the date of their delivery.
            </p>
          </>
        ),
      },
      {
        question: "Is the Co-op price fixed?",
        answer: (
          <>
            <p>
              No. Heating oil and propane prices change with the energy market. Your Co-op pricing changes as market
              prices change, but it&apos;s based on pricing we&apos;ve negotiated with our participating companies.
            </p>
            <p>
              We do work with one oil company that offers a fixed rate for members. Please call us or request more
              information to see if this company covers your town.
            </p>
          </>
        ),
      },
      {
        question: "How much can I save?",
        answer: (
          <p>
            Savings vary depending on market conditions and your location, but the average Co-op member can save up to
            $600 a year. (Based on usage of 900 gallons.)
          </p>
        ),
      },
    ],
  },
  {
    id: "choosing-company",
    title: "Choosing Your Heating Company",
    items: [
      {
        question: "How do you decide which company I'll use?",
        answer: (
          <p>
            We recommend the participating company from our network that&apos;s the best overall fit based on your
            location, pricing, service options, and personal preferences.
          </p>
        ),
      },
      {
        question: "Can I keep my current heating company?",
        answer: (
          <p>
            If you&apos;re already using one of our participating companies, we&apos;ll usually keep you with that
            company while applying Co-op pricing to your account. Nothing will change with your service other than a
            better price on your oil or propane.
          </p>
        ),
      },
      {
        question: "Can I choose a specific company?",
        answer: (
          <p>
            Yes. If you have a preferred company, we&apos;ll do our best to accommodate your request whenever possible.
          </p>
        ),
      },
      {
        question: "What if my current company isn't part of the Co-op?",
        answer: (
          <p>
            To take advantage of Co-op pricing you do have to work with one of the companies in our network. We&apos;ll
            recommend one of our participating companies that serves your area and is the best fit for you. We&apos;ll
            guide you through the transition and answer any questions you may have.
          </p>
        ),
      },
      {
        question: "Will I still receive full service?",
        answer: (
          <p>
            Yes. You&apos;ll continue to receive the same full-service benefits offered by your participating company,
            including fuel delivery, equipment service, emergency support, and other available programs.
          </p>
        ),
      },
      {
        question: "Do I have to sign up for automatic delivery?",
        answer: (
          <p>
            Not always. Some participating companies offer both automatic delivery and will-call options, while others
            require automatic delivery. We&apos;ll help you find the option that best fits your needs.
          </p>
        ),
      },
      {
        question: "Do I have to purchase a service contract?",
        answer: (
          <p>
            No. Service contracts are optional, although many members choose one for added peace of mind and equipment
            protection. We&apos;ll explain your options so you can decide what&apos;s right for you.
          </p>
        ),
      },
    ],
  },
  {
    id: "propane",
    title: "Propane and Propane Tanks",
    items: [
      {
        question: "Do I own my propane tank?",
        answer: (
          <p>
            It depends. Some homeowners own their propane tank, while others rent one from their propane provider.
          </p>
        ),
      },
      {
        question: "What's the difference between owning and renting a propane tank?",
        answer: (
          <>
            <p>
              If you own your tank, you&apos;re free to choose the propane company that fills it. This gives you greater
              flexibility if you ever decide to switch providers.
            </p>
            <p>
              If you rent your tank, the tank belongs to your propane company. Because of safety and liability
              requirements, only that company can fill or service its own tank.
            </p>
          </>
        ),
      },
      {
        question: "Is it better to own or rent a propane tank?",
        answer: (
          <>
            <p>Both options have advantages.</p>
            <p>
              <strong>Owning your tank:</strong>
            </p>
            <ul>
              <li>Freedom to choose your propane supplier</li>
              <li>More flexibility if you decide to switch companies</li>
              <li>No annual tank rental fee</li>
              <li>Higher upfront investment</li>
            </ul>
            <p>
              <strong>Renting your tank:</strong>
            </p>
            <ul>
              <li>Little or no upfront cost</li>
              <li>The propane company maintains the tank</li>
              <li>Annual rental fee may apply</li>
              <li>You&apos;ll typically purchase propane from that company while using their tank</li>
            </ul>
            <p>
              We&apos;ll gladly explain the differences and help you understand which option best fits your situation.
            </p>
          </>
        ),
      },
      {
        question: "Can I switch propane companies if I rent my tank?",
        answer: (
          <>
            <p>Yes.</p>
            <p>If you decide to switch propane companies, the new company will typically:</p>
            <ul>
              <li>Perform a safety inspection</li>
              <li>Remove the existing rental tank</li>
              <li>Install their own rental tank</li>
              <li>Transfer your account and service</li>
            </ul>
            <p>
              If there&apos;s propane remaining in the old tank, the previous company is required to reimburse you for
              the unused fuel. The exact process may vary slightly by company.
            </p>
          </>
        ),
      },
    ],
  },
  {
    id: "whats-next",
    title: "Sign me up! What happens next?",
    items: [
      {
        question: "What happens after I join?",
        answer: (
          <p>
            After you become a member, we&apos;ll review your location and preferences, recommend the participating
            company that&apos;s the best fit, and forward your information so they can contact you to set up your oil or
            propane account at Co-op pricing.
          </p>
        ),
      },
      {
        question: "How long does it take to get started?",
        answer: (
          <p>
            Most new members hear from their assigned participating company within a day or two after joining to complete
            their account setup. To schedule a first delivery for a new account we typically recommend 7–10 days.
          </p>
        ),
      },
      {
        question: "Why should I join Citizen's Oil Co-op instead of calling companies myself?",
        answer: (
          <p>
            We&apos;ve spent more than 30 years building relationships with trusted heating companies and negotiating
            competitive pricing on behalf of our members. Instead of spending your time calling multiple companies,
            comparing prices, and trying to determine who&apos;s offering the best value, you can rely on Citizen&apos;s
            Oil Co-op to help connect you with a trusted provider that fits your needs.
          </p>
        ),
      },
      {
        question: "Why do homeowners trust Citizen's Oil Co-op?",
        answer: (
          <p>
            For over three decades, we&apos;ve helped thousands of homeowners find competitive pricing through trusted
            local heating companies. Our goal is simple: make home energy easier by helping our members receive fair
            pricing, dependable service, and honest guidance.
          </p>
        ),
      },
    ],
  },
];

function FaqDetails({ question, children }: { question: string; children: ReactNode }) {
  return (
    <details>
      <summary>{question}</summary>
      <div className="mkt-acc-body mkt-prose">{children}</div>
    </details>
  );
}

/** FAQ page — six categories with accordion answers. */
export default function FaqPage() {
  return (
    <div className="mkt-panel mkt-faq-panel">
      <h1 className="mkt-page-title">Frequently asked questions</h1>
      <p className="mkt-lead">
        Answers about membership, pricing, choosing a heating company, propane tanks, and what happens after you join.
      </p>

      <nav className="mkt-faq-toc" aria-label="FAQ categories">
        {CATEGORIES.map((cat) => (
          <a key={cat.id} href={`#${cat.id}`}>
            {cat.title}
          </a>
        ))}
      </nav>

      <div className="mkt-faq-categories">
        {CATEGORIES.map((cat) => (
          <section key={cat.id} id={cat.id} className="mkt-faq-category">
            <h2 className="mkt-faq-category-title">{cat.title}</h2>
            <div className="mkt-service-acc">
              {cat.items.map((item) => (
                <FaqDetails key={item.question} question={item.question}>
                  {item.answer}
                </FaqDetails>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="mkt-faq-cta">
        <p className="mkt-lead" style={{ marginBottom: "1rem" }}>
          Ready to save on home energy?
        </p>
        <Link to="/signup" className="mkt-btn mkt-btn-primary mkt-btn-lg">
          Join Now
        </Link>
      </div>
    </div>
  );
}
