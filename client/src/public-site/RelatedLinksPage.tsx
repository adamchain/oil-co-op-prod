import type { ContentGroup } from "./content/types";
import { useSiteText } from "./content/SiteContentContext";

/**
 * Related / friends & partners links — copied from oilco-op.com/links/
 * for SEO and transparency. Staff will review accuracy later.
 */
const LINKS: Array<{ nameKey: string; url: string; blurbKey: string }> = [
  {
    nameKey: "links.item1Name",
    url: "https://www.bantamwesson.com/",
    blurbKey: "links.item1Blurb",
  },
  {
    nameKey: "links.item2Name",
    url: "http://www.eia.gov/dnav/pet/pet_pri_wfr_dcus_SCT_w.htm",
    blurbKey: "links.item2Blurb",
  },
  {
    nameKey: "links.item3Name",
    url: "http://www.ctrefining.com/",
    blurbKey: "links.item3Blurb",
  },
  {
    nameKey: "links.item4Name",
    url: "http://www.ddlcenergy.com/",
    blurbKey: "links.item4Blurb",
  },
  {
    nameKey: "links.item5Name",
    url: "http://deitchenergy.com/index.html",
    blurbKey: "links.item5Blurb",
  },
  {
    nameKey: "links.item6Name",
    url: "http://www.halehillfarm.com/",
    blurbKey: "links.item6Blurb",
  },
  {
    nameKey: "links.item7Name",
    url: "https://www.hihopetroleum.com/",
    blurbKey: "links.item7Blurb",
  },
  {
    nameKey: "links.item8Name",
    url: "http://www.hoffmanfuel.com/",
    blurbKey: "links.item8Blurb",
  },
  {
    nameKey: "links.item9Name",
    url: "http://ivesbrosoil.com/",
    blurbKey: "links.item9Blurb",
  },
  {
    nameKey: "links.item10Name",
    url: "http://www.kaufmanfuel.com/",
    blurbKey: "links.item10Blurb",
  },
  {
    nameKey: "links.item11Name",
    url: "https://www.petro.com/",
    blurbKey: "links.item11Blurb",
  },
  {
    nameKey: "links.item12Name",
    url: "http://www.savewaypetro.com/",
    blurbKey: "links.item12Blurb",
  },
  {
    nameKey: "links.item13Name",
    url: "http://www.superiorplusenergy.com/connecticut/index.php",
    blurbKey: "links.item13Blurb",
  },
  {
    nameKey: "links.item14Name",
    url: "http://www.thomastonoil.com/",
    blurbKey: "links.item14Blurb",
  },
  {
    nameKey: "links.item15Name",
    url: "http://www.automatictlc.com/",
    blurbKey: "links.item15Blurb",
  },
  {
    nameKey: "links.item16Name",
    url: "http://www.valleyoilct.com/",
    blurbKey: "links.item16Blurb",
  },
];

export const RELATED_LINKS_CONTENT: ContentGroup = {
  page: "links",
  title: "Related Links",
  fields: [
    { key: "links.title", label: "Page title", value: "Links to Oil Co-op Friends and Partners" },
    {
      key: "links.lead",
      label: "Intro paragraph",
      multiline: true,
      value:
        "In this section you will find various links to companies working with us to benefit consumers through our group purchase program.",
    },
    { key: "links.item1Name", label: "Link 1 name", value: "BantamWesson Energy" },
    {
      key: "links.item1Blurb",
      label: "Link 1 blurb",
      multiline: true,
      value:
        "With over 80 years of innovative thinking and a focus on customer needs, BantamWesson Energy has grown with the times to advance energy products and services for homes and businesses in Connecticut communities like yours. BantamWesson has three offices in Connecticut – Canton, Waterbury, and Bantam.",
    },
    { key: "links.item2Name", label: "Link 2 name", value: "EIA US Energy Information Administration" },
    {
      key: "links.item2Blurb",
      label: "Link 2 blurb",
      multiline: true,
      value: "This is an interesting site that gives useful information regarding pricing and other topics related to energy.",
    },
    { key: "links.item3Name", label: "Link 3 name", value: "CRC Energy" },
    {
      key: "links.item3Blurb",
      label: "Link 3 blurb",
      multiline: true,
      value:
        "The people of New Haven County have relied on CRC Energy for over 90 years. We’re your local branch of HOP Energy, a trusted source for home heating oil, service, and reliable 24-hour emergency service.",
    },
    { key: "links.item4Name", label: "Link 4 name", value: "DDLC" },
    {
      key: "links.item4Blurb",
      label: "Link 4 blurb",
      multiline: true,
      value:
        "For over 90 years, the people of Eastern Connecticut have relied on DDLC Energy. We’re your local branch of HOP Energy, a trusted source for home heating oil, service, and reliable 24-hour emergency service.",
    },
    { key: "links.item5Name", label: "Link 5 name", value: "Deitch Energy" },
    {
      key: "links.item5Blurb",
      label: "Link 5 blurb",
      multiline: true,
      value:
        "Deitch Energy is a retail fuel oil heating and cooling company. They are located in Hartford and bring to the community over 60 years of experience in the industry.",
    },
    { key: "links.item6Name", label: "Link 6 name", value: "Hale Hill Biofuels" },
    {
      key: "links.item6Blurb",
      label: "Link 6 blurb",
      multiline: true,
      value:
        "Hale Hill Biofuel’s B20 biodiesel customers have collectively reduced the carbon foot print of Connecticut residents over 2,550 tons to date.",
    },
    { key: "links.item7Name", label: "Link 7 name", value: "Hi-Ho Petroleum" },
    {
      key: "links.item7Blurb",
      label: "Link 7 blurb",
      multiline: true,
      value:
        "Hi-Ho Petroleum works hard to gain your trust and keep you comfortable–as they have done for thousands of customers for over 100 years serving most of Fairfield County.",
    },
    { key: "links.item8Name", label: "Link 8 name", value: "Hoffman Fuel" },
    {
      key: "links.item8Blurb",
      label: "Link 8 blurb",
      multiline: true,
      value:
        "Hoffman Fuel, based in Trumbull, is one of the area’s largest energy suppliers and has been part of the community for years, offering a full range of heating, cooling and other home services.",
    },
    { key: "links.item9Name", label: "Link 9 name", value: "Ives Brothers" },
    {
      key: "links.item9Blurb",
      label: "Link 9 blurb",
      multiline: true,
      value:
        "Ives Bros. Inc. is a full-service company that began delivering oil back in 1917. For 87 years, Ives Bros. Inc. delivered home heating oil from Willimantic to an area stretching two towns away in each direction. Then, in 2004, Ives Bros. Inc. added Woodstock, Putnam, Danielson, Pomfret and Plainfield to our service area. In 2008, they added Colchester, East Hampton and East Haddam areas.",
    },
    { key: "links.item10Name", label: "Link 10 name", value: "The Kaufman Fuel Company" },
    {
      key: "links.item10Blurb",
      label: "Link 10 blurb",
      multiline: true,
      value:
        "Kaufman Fuel, a branch of HOP Energy, is one of the largest and oldest heating oil companies in Fairfield County, and has been providing dependable automatic fuel oil delivery, reliable 24-hour emergency service and high-efficiency heating & cooling equipment sales and installations to our friends in Connecticut for over 90 years.",
    },
    { key: "links.item11Name", label: "Link 11 name", value: "PETRO Fuel" },
    {
      key: "links.item11Blurb",
      label: "Link 11 blurb",
      multiline: true,
      value:
        "One of the largest local home heating oil and total home comfort services providers in America, with over 100 years of experience. PETRO Fuel services all of Rhode Island and a large portion of Connecticut.",
    },
    { key: "links.item12Name", label: "Link 12 name", value: "Saveway Petroleum, Inc." },
    {
      key: "links.item12Blurb",
      label: "Link 12 blurb",
      multiline: true,
      value:
        "Saveway Petroleum is a family owned and operated company and has been for 37 years. Saveway Petroleum has been working with Citizen Oil Co-op for a number of years and serves the eastern part of Connecticut.",
    },
    { key: "links.item13Name", label: "Link 13 name", value: "Superior Plus Energy Services" },
    {
      key: "links.item13Blurb",
      label: "Link 13 blurb",
      multiline: true,
      value:
        "With experienced, knowledgeable and local staff, Superior Plus Energy Services (formerly Scasco) has the ability and expertise to fulfill all your heating and cooling needs with quality products and services.",
    },
    { key: "links.item14Name", label: "Link 14 name", value: "Thomaston Oil" },
    {
      key: "links.item14Blurb",
      label: "Link 14 blurb",
      multiline: true,
      value:
        "Family-owned and operated since 1986, Thomaston Oil has been built upon the strong values of People, Protection, and Peace of Mind. When you choose to work with us, you can expect first-class HVAC technicians and oil specialists who have an unwavering commitment to first-class customer care.",
    },
    { key: "links.item15Name", label: "Link 15 name", value: "Automatic TLC" },
    {
      key: "links.item15Blurb",
      label: "Link 15 blurb",
      multiline: true,
      value:
        "Hartford and Tolland Counties have relied on Automatic TLC for over 90 years. We’re your local branch of HOP Energy, a trusted source for home heating oil, service, and reliable 24-hour emergency service.",
    },
    { key: "links.item16Name", label: "Link 16 name", value: "Valley Oil" },
    {
      key: "links.item16Blurb",
      label: "Link 16 blurb",
      multiline: true,
      value:
        "For over 90 years, the people of Middlesex County have relied on Valley Oil. We’re your local branch of HOP Energy, a trusted source for home heating oil, service, and reliable 24-hour emergency service.",
    },
  ],
};

/** Related links page — participating companies & energy resources (from oilco-op.com/links/). */
export default function RelatedLinksPage() {
  const t = useSiteText();
  return (
    <div className="mkt-panel mkt-faq-panel">
      <h1 className="mkt-page-title">{t("links.title")}</h1>
      <p className="mkt-lead">{t("links.lead")}</p>

      <div className="mkt-links-list">
        {LINKS.map((item) => (
          <article key={item.nameKey} className="mkt-links-item">
            <h2>
              <a href={item.url} target="_blank" rel="noopener noreferrer">
                {t(item.nameKey)}
              </a>
            </h2>
            <p>{t(item.blurbKey)}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
