/**
 * Related / friends & partners links — copied from oilco-op.com/links/
 * for SEO and transparency. Staff will review accuracy later.
 */
const LINKS: Array<{ name: string; url: string; blurb: string }> = [
  {
    name: "BantamWesson Energy",
    url: "https://www.bantamwesson.com/",
    blurb:
      "With over 80 years of innovative thinking and a focus on customer needs, BantamWesson Energy has grown with the times to advance energy products and services for homes and businesses in Connecticut communities like yours. BantamWesson has three offices in Connecticut – Canton, Waterbury, and Bantam.",
  },
  {
    name: "EIA US Energy Information Administration",
    url: "http://www.eia.gov/dnav/pet/pet_pri_wfr_dcus_SCT_w.htm",
    blurb: "This is an interesting site that gives useful information regarding pricing and other topics related to energy.",
  },
  {
    name: "CRC Energy",
    url: "http://www.ctrefining.com/",
    blurb:
      "The people of New Haven County have relied on CRC Energy for over 90 years. We’re your local branch of HOP Energy, a trusted source for home heating oil, service, and reliable 24-hour emergency service.",
  },
  {
    name: "DDLC",
    url: "http://www.ddlcenergy.com/",
    blurb:
      "For over 90 years, the people of Eastern Connecticut have relied on DDLC Energy. We’re your local branch of HOP Energy, a trusted source for home heating oil, service, and reliable 24-hour emergency service.",
  },
  {
    name: "Deitch Energy",
    url: "http://deitchenergy.com/index.html",
    blurb:
      "Deitch Energy is a retail fuel oil heating and cooling company. They are located in Hartford and bring to the community over 60 years of experience in the industry.",
  },
  {
    name: "Hale Hill Biofuels",
    url: "http://www.halehillfarm.com/",
    blurb:
      "Hale Hill Biofuel’s B20 biodiesel customers have collectively reduced the carbon foot print of Connecticut residents over 2,550 tons to date.",
  },
  {
    name: "Hi-Ho Petroleum",
    url: "https://www.hihopetroleum.com/",
    blurb:
      "Hi-Ho Petroleum works hard to gain your trust and keep you comfortable–as they have done for thousands of customers for over 100 years serving most of Fairfield County.",
  },
  {
    name: "Hoffman Fuel",
    url: "http://www.hoffmanfuel.com/",
    blurb:
      "Hoffman Fuel, based in Trumbull, is one of the area’s largest energy suppliers and has been part of the community for years, offering a full range of heating, cooling and other home services.",
  },
  {
    name: "Ives Brothers",
    url: "http://ivesbrosoil.com/",
    blurb:
      "Ives Bros. Inc. is a full-service company that began delivering oil back in 1917. For 87 years, Ives Bros. Inc. delivered home heating oil from Willimantic to an area stretching two towns away in each direction. Then, in 2004, Ives Bros. Inc. added Woodstock, Putnam, Danielson, Pomfret and Plainfield to our service area. In 2008, they added Colchester, East Hampton and East Haddam areas.",
  },
  {
    name: "The Kaufman Fuel Company",
    url: "http://www.kaufmanfuel.com/",
    blurb:
      "Kaufman Fuel, a branch of HOP Energy, is one of the largest and oldest heating oil companies in Fairfield County, and has been providing dependable automatic fuel oil delivery, reliable 24-hour emergency service and high-efficiency heating & cooling equipment sales and installations to our friends in Connecticut for over 90 years.",
  },
  {
    name: "PETRO Fuel",
    url: "https://www.petro.com/",
    blurb:
      "One of the largest local home heating oil and total home comfort services providers in America, with over 100 years of experience. PETRO Fuel services all of Rhode Island and a large portion of Connecticut.",
  },
  {
    name: "Saveway Petroleum, Inc.",
    url: "http://www.savewaypetro.com/",
    blurb:
      "Saveway Petroleum is a family owned and operated company and has been for 37 years. Saveway Petroleum has been working with Citizen Oil Co-op for a number of years and serves the eastern part of Connecticut.",
  },
  {
    name: "Superior Plus Energy Services",
    url: "http://www.superiorplusenergy.com/connecticut/index.php",
    blurb:
      "With experienced, knowledgeable and local staff, Superior Plus Energy Services (formerly Scasco) has the ability and expertise to fulfill all your heating and cooling needs with quality products and services.",
  },
  {
    name: "Thomaston Oil",
    url: "http://www.thomastonoil.com/",
    blurb:
      "Family-owned and operated since 1986, Thomaston Oil has been built upon the strong values of People, Protection, and Peace of Mind. When you choose to work with us, you can expect first-class HVAC technicians and oil specialists who have an unwavering commitment to first-class customer care.",
  },
  {
    name: "Automatic TLC",
    url: "http://www.automatictlc.com/",
    blurb:
      "Hartford and Tolland Counties have relied on Automatic TLC for over 90 years. We’re your local branch of HOP Energy, a trusted source for home heating oil, service, and reliable 24-hour emergency service.",
  },
  {
    name: "Valley Oil",
    url: "http://www.valleyoilct.com/",
    blurb:
      "For over 90 years, the people of Middlesex County have relied on Valley Oil. We’re your local branch of HOP Energy, a trusted source for home heating oil, service, and reliable 24-hour emergency service.",
  },
];

/** Related links page — participating companies & energy resources (from oilco-op.com/links/). */
export default function RelatedLinksPage() {
  return (
    <div className="mkt-panel mkt-faq-panel">
      <h1 className="mkt-page-title">Links to Oil Co-op Friends and Partners</h1>
      <p className="mkt-lead">
        In this section you will find various links to companies working with us to benefit consumers through our group
        purchase program.
      </p>

      <div className="mkt-links-list">
        {LINKS.map((item) => (
          <article key={item.name} className="mkt-links-item">
            <h2>
              <a href={item.url} target="_blank" rel="noopener noreferrer">
                {item.name}
              </a>
            </h2>
            <p>{item.blurb}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
