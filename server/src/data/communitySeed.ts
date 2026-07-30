/** Seed content for Community Partnerships page (Adrian mockup — Jul 2026). */

export const COMMUNITY_PARTNER_SEED = [
  {
    name: "Connecticut Citizens Action Group (CCAG)",
    shortName: "CCAG",
    blurb:
      "Established in 1970, CCAG fights for justice on environmental awareness, healthcare, democracy, and consumer protection. Citizen's Oil Co-op was created at CCAG — our roots remain there, and we keep a strong partnership fighting for individual consumers.",
    websiteUrl: "https://www.ctcitizenaction.org/",
    imageUrl: "/site/house.jpg",
    logoUrl: "",
    sortOrder: 1,
  },
  {
    name: "Connecticut Symphony Orchestra (CSO)",
    shortName: "CSO",
    blurb:
      "A community arts partner bringing live orchestral music to Connecticut audiences. The Co-op is proud to support cultural organizations that strengthen local life.",
    websiteUrl: "https://www.ctsymphony.org/",
    imageUrl: "/site/family.jpg",
    logoUrl: "",
    sortOrder: 2,
  },
  {
    name: "University of Connecticut Professional Employees Association (UCPEA)",
    shortName: "UCPEA",
    blurb:
      "Representing professional employees at UConn. Members can join the Co-op for discounted home energy while supporting their association through Next Step.",
    websiteUrl: "https://ucpea.uconn.edu/",
    imageUrl: "/site/truck.jpg",
    logoUrl: "",
    sortOrder: 3,
  },
  {
    name: "American Association of University Professors (AAUP)",
    shortName: "AAUP",
    blurb:
      "Advancing academic freedom and shared governance. Faculty and staff members can save on heating oil and propane while directing Next Step support to AAUP.",
    websiteUrl: "https://www.aaup.org/",
    imageUrl: "/site/house.jpg",
    logoUrl: "",
    sortOrder: 4,
  },
];

/** Fictional placeholder events for layout (per Adrian — replace with real ones later). */
export const COMMUNITY_EVENT_SEED = [
  {
    title: "West Hartford Fall Fest booth",
    eventDate: "2026-10-12",
    location: "West Hartford Town Hall Green",
    blurb: "Stop by our booth to learn about membership and Next Step partnerships.",
    imageUrl: "",
    kind: "upcoming" as const,
    sortOrder: 1,
  },
  {
    title: "UConn Work/Life Expo",
    eventDate: "2026-10-20",
    location: "Storrs, CT",
    blurb: "Meet the Co-op team and ask about member savings for UConn employees.",
    imageUrl: "",
    kind: "upcoming" as const,
    sortOrder: 2,
  },
  {
    title: "Community partner breakfast",
    eventDate: "2026-11-05",
    location: "West Hartford, CT",
    blurb: "Coffee and conversation with nonprofit and union partners.",
    imageUrl: "",
    kind: "upcoming" as const,
    sortOrder: 3,
  },
  {
    title: "UConn Work/Life Expo visit",
    eventDate: "2023-10-12",
    location: "Storrs, CT",
    blurb: "Mark and Rosie spent the day spreading the word about Co-op membership at UConn.",
    imageUrl: "/site/family.jpg",
    kind: "recent" as const,
    sortOrder: 1,
  },
  {
    title: "WHYBL season sponsorship",
    eventDate: "2024-01-15",
    location: "West Hartford, CT",
    blurb: "Continued team sponsorship supporting local youth basketball and sportsmanship.",
    imageUrl: "/site/truck.jpg",
    kind: "recent" as const,
    sortOrder: 2,
  },
  {
    title: "Roxbury Fuel Bank drive",
    eventDate: "2024-02-01",
    location: "Roxbury, CT",
    blurb: "Highlighting our give-back for new Roxbury members supporting neighbors in need.",
    imageUrl: "/site/house.jpg",
    kind: "recent" as const,
    sortOrder: 3,
  },
];
