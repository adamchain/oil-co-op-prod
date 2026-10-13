import type { ContentGroup } from "./content/types";
import { useSiteText } from "./content/SiteContentContext";

/**
 * Related / friends & partners links — copied from oilco-op.com/links/
 * for SEO and transparency.
 */
/** Alphabetical, per Adrian's Aug 14 list (renames, new companies, updated URLs). */
const LINKS: Array<{ nameKey: string; url: string; blurbKey: string }> = [
  { nameKey: "links.aaupName", url: "https://www.aaup.org/", blurbKey: "links.aaupBlurb" },
  { nameKey: "links.automaticTlcName", url: "http://www.automatictlc.com/", blurbKey: "links.automaticTlcBlurb" },
  { nameKey: "links.crcName", url: "http://www.ctrefining.com/", blurbKey: "links.crcBlurb" },
  { nameKey: "links.ddlcName", url: "http://www.ddlcenergy.com/", blurbKey: "links.ddlcBlurb" },
  { nameKey: "links.deitchName", url: "https://www.deitchenergy.com/", blurbKey: "links.deitchBlurb" },
  { nameKey: "links.haleHillName", url: "http://www.halehillfarm.com/", blurbKey: "links.haleHillBlurb" },
  { nameKey: "links.hoffmanName", url: "http://www.hoffmanfuel.com/", blurbKey: "links.hoffmanBlurb" },
  { nameKey: "links.ivesName", url: "http://ivesbrosoil.com/", blurbKey: "links.ivesBlurb" },
  { nameKey: "links.kaufmanName", url: "http://www.kaufmanfuel.com/", blurbKey: "links.kaufmanBlurb" },
  { nameKey: "links.mirabitoName", url: "https://www.mirabito.com/", blurbKey: "links.mirabitoBlurb" },
  { nameKey: "links.northeastName", url: "https://nepropane.com/", blurbKey: "links.northeastBlurb" },
  { nameKey: "links.petroName", url: "https://www.petro.com/", blurbKey: "links.petroBlurb" },
  { nameKey: "links.powerFuelsName", url: "https://power-fuels.com/", blurbKey: "links.powerFuelsBlurb" },
  { nameKey: "links.superiorPlusName", url: "https://www.superiorpluspropane.com/", blurbKey: "links.superiorPlusBlurb" },
  { nameKey: "links.thomastonName", url: "http://www.thomastonoil.com/", blurbKey: "links.thomastonBlurb" },
  { nameKey: "links.ucpeaName", url: "https://ucpea.ct.aft.org/", blurbKey: "links.ucpeaBlurb" },
  { nameKey: "links.valiantName", url: "https://www.valiantenergy.com/", blurbKey: "links.valiantBlurb" },
  { nameKey: "links.valleyName", url: "http://www.valleyoilct.com/", blurbKey: "links.valleyBlurb" },
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
    { key: "links.aaupName", label: "AAUP — name", value: "AAUP" },
    { key: "links.aaupBlurb", label: "AAUP — blurb", multiline: true, value: "Founded in 1915, the AAUP has helped to shape American higher education by developing the standards and principles that maintain quality in education and academic freedom in US colleges and universities." },
    { key: "links.automaticTlcName", label: "Automatic TLC — name", value: "Automatic TLC" },
    { key: "links.automaticTlcBlurb", label: "Automatic TLC — blurb", multiline: true, value: "Hartford and Tolland Counties have relied on Automatic TLC for over 90 years. We’re your local branch of HOP Energy, a trusted source for home heating oil, service, and reliable 24-hour emergency service." },
    { key: "links.crcName", label: "CRC Energy — name", value: "CRC Energy" },
    { key: "links.crcBlurb", label: "CRC Energy — blurb", multiline: true, value: "The people of New Haven County have relied on CRC Energy for over 90 years. We’re your local branch of HOP Energy, a trusted source for home heating oil, service, and reliable 24-hour emergency service." },
    { key: "links.ddlcName", label: "DDLC — name", value: "DDLC" },
    { key: "links.ddlcBlurb", label: "DDLC — blurb", multiline: true, value: "For over 90 years, the people of Eastern Connecticut have relied on DDLC Energy. We’re your local branch of HOP Energy, a trusted source for home heating oil, service, and reliable 24-hour emergency service." },
    { key: "links.deitchName", label: "Deitch Energy — name", value: "Deitch Energy" },
    { key: "links.deitchBlurb", label: "Deitch Energy — blurb", multiline: true, value: "Deitch Energy is a retail fuel oil heating and cooling company. They are located in Hartford and bring to the community over 60 years of experience in the industry." },
    { key: "links.haleHillName", label: "Hale Hill Biofuels — name", value: "Hale Hill Biofuels" },
    { key: "links.haleHillBlurb", label: "Hale Hill Biofuels — blurb", multiline: true, value: "Hale Hill Biofuel’s B20 biodiesel customers have collectively reduced the carbon foot print of Connecticut residents over 2,550 tons to date." },
    { key: "links.hoffmanName", label: "Hoffman Energy — name", value: "Hoffman Energy" },
    { key: "links.hoffmanBlurb", label: "Hoffman Energy — blurb", multiline: true, value: "Hoffman Fuel, based in Trumbull, is one of the area’s largest energy suppliers and has been part of the community for years, offering a full range of heating, cooling and other home services." },
    { key: "links.ivesName", label: "Ives Brothers — name", value: "Ives Brothers" },
    { key: "links.ivesBlurb", label: "Ives Brothers — blurb", multiline: true, value: "Ives Bros. Inc. is a full-service company that began delivering oil back in 1917. For 87 years, Ives Bros. Inc. delivered home heating oil from Willimantic to an area stretching two towns away in each direction. Then, in 2004, Ives Bros. Inc. added Woodstock, Putnam, Danielson, Pomfret and Plainfield to our service area. In 2008, they added Colchester, East Hampton and East Haddam areas." },
    { key: "links.kaufmanName", label: "Kaufman Fuel Company — name", value: "Kaufman Fuel Company" },
    { key: "links.kaufmanBlurb", label: "Kaufman Fuel Company — blurb", multiline: true, value: "Kaufman Fuel, a branch of HOP Energy, is one of the largest and oldest heating oil companies in Fairfield County, and has been providing dependable automatic fuel oil delivery, reliable 24-hour emergency service and high-efficiency heating & cooling equipment sales and installations to our friends in Connecticut for over 90 years." },
    { key: "links.mirabitoName", label: "Mirabito Energy Products — name", value: "Mirabito Energy Products" },
    { key: "links.mirabitoBlurb", label: "Mirabito Energy Products — blurb", multiline: true, value: "In New York, Pennsylvania, Connecticut, Massachusetts, Rhode Island and Vermont, Mirabito Energy Products is singularly committed to honoring the legacy of this family-owned and -operated institution by focusing on our core values: integrity, reliability, safety and community service." },
    { key: "links.northeastName", label: "Northeast Oil and Propane — name", value: "Northeast Oil and Propane" },
    { key: "links.northeastBlurb", label: "Northeast Oil and Propane — blurb", multiline: true, value: "From propane and heating oil delivery to residential and commercial HVAC services, we’re here to provide the reliable energy solutions and local support you need to stay comfortable in every season." },
    { key: "links.petroName", label: "Petro Home Services — name", value: "Petro Home Services" },
    { key: "links.petroBlurb", label: "Petro Home Services — blurb", multiline: true, value: "One of the largest local home heating oil and total home comfort services providers in America, with over 100 years of experience. PETRO Fuel services all of Rhode Island and a large portion of Connecticut." },
    { key: "links.powerFuelsName", label: "Power Fuels Propane — name", value: "Power Fuels Propane" },
    { key: "links.powerFuelsBlurb", label: "Power Fuels Propane — blurb", multiline: true, value: "Trust the family at Power Fuels Propane for your comfort and safety. Whether it's premium heating oil or quality propane, repair or installation, we have you covered. Our company can fulfill your needs the right way each and every time." },
    { key: "links.superiorPlusName", label: "Superior Plus Propane — name", value: "Superior Plus Propane" },
    { key: "links.superiorPlusBlurb", label: "Superior Plus Propane — blurb", multiline: true, value: "With experienced, knowledgeable and local staff, Superior Plus Energy Services (formerly Scasco) has the ability and expertise to fulfill all your heating and cooling needs with quality products and services." },
    { key: "links.thomastonName", label: "Thomaston Oil — name", value: "Thomaston Oil" },
    { key: "links.thomastonBlurb", label: "Thomaston Oil — blurb", multiline: true, value: "Family-owned and operated since 1986, Thomaston Oil has been built upon the strong values of People, Protection, and Peace of Mind. When you choose to work with us, you can expect first-class HVAC technicians and oil specialists who have an unwavering commitment to first-class customer care." },
    { key: "links.ucpeaName", label: "UCPEA — name", value: "UCPEA" },
    { key: "links.ucpeaBlurb", label: "UCPEA — blurb", multiline: true, value: "The University of Connecticut Professional Employees Association (UCPEA) is the exclusive bargaining agent for more than 1,900 professional staff at the University of Connecticut. We are the non-teaching professionals on campus working in academic and non-academic units. We are nurses, doctors, librarians, advisors, provide program support, and much more. Our motto says it all, “we don't run the place, we just keep it running.”" },
    { key: "links.valiantName", label: "Valiant Energy — name", value: "Valiant Energy" },
    { key: "links.valiantBlurb", label: "Valiant Energy — blurb", multiline: true, value: "With over 80 years of innovative thinking and a focus on customer needs, BantamWesson Energy has grown with the times to advance energy products and services for homes and businesses in Connecticut communities like yours. BantamWesson has three offices in Connecticut – Canton, Waterbury, and Bantam." },
    { key: "links.valleyName", label: "Valley Oil — name", value: "Valley Oil" },
    { key: "links.valleyBlurb", label: "Valley Oil — blurb", multiline: true, value: "For over 90 years, the people of Middlesex County have relied on Valley Oil. We’re your local branch of HOP Energy, a trusted source for home heating oil, service, and reliable 24-hour emergency service." },
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
