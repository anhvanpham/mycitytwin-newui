/** Preset conversation content. No generated or predicted local outcomes. */
export type PlanId = 'greenline' | 'transport';
export type QuestionId = 'public-space' | 'shade' | 'access' | 'commute' | 'construction' | 'business' | 'prices' | 'rent';

export const PLAN_SOURCES = {
  greenline: { title: 'The Greenline Project · City of Melbourne', href: 'https://participate.melbourne.vic.gov.au/greenline' },
  transport: { title: 'Transport Strategy 2030 · City of Melbourne', href: 'https://participate.melbourne.vic.gov.au/transportstrategy' },
  walking: { title: 'Walking discussion paper · City of Melbourne', href: 'https://participate.melbourne.vic.gov.au/transportstrategy/walking' },
  streets: { title: 'Future Streets Framework · City of Melbourne', href: 'https://participate.melbourne.vic.gov.au/future-streets-framework' },
};
type SourceId = keyof typeof PLAN_SOURCES;
export interface PlanReply {
  title: string;
  body: string;
  consider: string;
  limit: string;
  sources: SourceId[];
}

export const PLANS: { id: PlanId; title: string; status: string; prompt: string; summary: string; greeting: string }[] = [
  {
    id: 'greenline', title: 'The Greenline Project', status: 'Approved master plan',
    prompt: 'What could change by the river?',
    summary: 'A plan for connected public spaces along the north bank of the Yarra River – Birrarung.',
    greeting: 'Hi! Curious about the riverfront? Pick a question. Let’s explore it together.',
  },
  {
    id: 'transport', title: 'Transport Strategy 2030', status: 'Council-endorsed strategy',
    prompt: 'What could change on city streets?',
    summary: 'A city-wide transport strategy, including more space for walking and people-focused streets.',
    greeting: 'Hi! Let’s talk about getting around Melbourne. Which part of your day is on your mind?',
  },
];

export const PLAN_QUESTIONS: { id: QuestionId; label: string; topic: string }[] = [
  { id: 'public-space', label: 'Will I have more places to spend time?', topic: 'Public space' },
  { id: 'shade', label: 'Will my street feel shadier or hotter?', topic: 'Shade' },
  { id: 'access', label: 'Will it be easier for me to get around?', topic: 'Access' },
  { id: 'commute', label: 'What does it mean for my commute?', topic: 'Your commute' },
  { id: 'construction', label: 'Will construction disrupt my day?', topic: 'Construction' },
  { id: 'business', label: 'What could it mean for local businesses?', topic: 'Local business' },
  { id: 'prices', label: 'Could it affect property prices?', topic: 'Property prices' },
  { id: 'rent', label: 'Could it affect my rent?', topic: 'Rent' },
];

export const PLAN_REPLIES: Record<PlanId, Record<QuestionId, PlanReply>> = {
  greenline: {
    'public-space': {
      title: 'More ways to enjoy the riverfront.',
      body: 'The master plan includes connected promenades, parks and public spaces. That gives the riverfront a stronger role as a place to walk, pause and spend time.',
      consider: 'For a place you know, look at its precinct design: seating, paths, planting and connections to nearby streets.',
      limit: 'The master plan describes an intended direction. Check the council’s project updates for what is open and what is still being developed.',
      sources: ['greenline'],
    },
    shade: {
      title: 'Planting is part of the picture.',
      body: 'Native planting and environmental renewal are part of the Greenline plan. Shade at a particular spot also depends on tree size, nearby buildings and the time of day.',
      consider: 'Look for planting and shelter in the detailed design for your stretch of riverfront.',
      limit: 'This guide does not calculate future shade or temperature. A planting proposal alone cannot tell us how cool your street will feel.',
      sources: ['greenline'],
    },
    access: {
      title: 'Connections matter as much as the destination.',
      body: 'The plan aims to connect riverfront public spaces. Whether a route works for you depends on its entrances, gradients, crossings and links to the streets you use.',
      consider: 'Check the detailed precinct plan for step-free access and the full route between your starting point and destination.',
      limit: 'A continuous-looking line on a master plan does not confirm every access detail or that every section is open.',
      sources: ['greenline'],
    },
    commute: {
      title: 'A riverfront route could become part of your day.',
      body: 'Connected promenades could offer another way to walk along the river. Their usefulness for your commute depends on where you start, where you finish and how you reach them.',
      consider: 'Compare your actual route, including crossings, access points and links to public transport.',
      limit: 'There is no journey-time calculation here. A riverfront connection does not guarantee a quicker commute.',
      sources: ['greenline'],
    },
    construction: {
      title: 'Look at the stage near your route.',
      body: 'Work on a riverfront precinct may temporarily change how you move through that area. The relevant details are the location, work dates and access arrangements for that stage.',
      consider: 'Check the council’s current project updates before visiting, and look for site notices about closures or detours.',
      limit: 'This conversation does not show live works, noise levels or current closures.',
      sources: ['greenline'],
    },
    business: {
      title: 'Think about access during and after change.',
      body: 'New public spaces could change how people spend time nearby. During works, access to shops and deliveries may also need attention.',
      consider: 'Look at how a specific design connects to shopfronts, walking routes and servicing access.',
      limit: 'These are things to consider, not forecasts of customers, sales or business growth.',
      sources: ['greenline'],
    },
    prices: {
      title: 'The plan cannot tell us a future price.',
      body: 'A master plan describes proposed changes to a place. It does not provide a property-by-property valuation or show how much of a price change would come from that project.',
      consider: 'Use the plan to understand the proposed setting, alongside separate, current evidence about the property and market.',
      limit: 'We cannot predict a price increase or decrease from this plan.',
      sources: ['greenline'],
    },
    rent: {
      title: 'A proposed change is not a rent forecast.',
      body: 'The Greenline plan does not establish what you will pay in rent. A nearby public-space project alone is not enough to calculate a rental change.',
      consider: 'Separate what is proposed in the neighbourhood from current rental information about the home you are considering.',
      limit: 'This guide does not predict rents or give tenancy advice.',
      sources: ['greenline'],
    },
  },
  transport: {
    'public-space': {
      title: 'Streets can be places to stay, too.',
      body: 'The strategy supports people-focused Little Streets and public spaces around stations. Its walking priorities also include generous, unobstructed space for people on foot.',
      consider: 'Look at the design of an individual street: room to walk, places to pause and access to nearby destinations.',
      limit: 'The strategy sets a direction. It does not mean every street has already changed.',
      sources: ['transport', 'streets'],
    },
    shade: {
      title: 'A street change needs a closer look.',
      body: 'More walking space does not automatically mean more shade. Trees, shelter, building shadows and their position all affect exposure along a street.',
      consider: 'Look for planting and shelter in a specific street design, then consider when you would be walking there.',
      limit: 'The transport strategy alone cannot establish future shade or temperature at your location.',
      sources: ['transport', 'streets'],
    },
    access: {
      title: 'More room for people walking.',
      body: 'High-quality, unobstructed walking space is a priority in the strategy. For your journey, crossings, footpath continuity and access to destinations still matter.',
      consider: 'Check the specific route for step-free crossings, clear paths and connections to public transport.',
      limit: 'A policy goal does not confirm that a particular route is accessible today.',
      sources: ['transport', 'walking'],
    },
    commute: {
      title: 'Start with the parts of your journey.',
      body: 'The strategy guides transport across the city. An individual commute depends on the streets, connections and services used along the way.',
      consider: 'Look at the walk to your stop or station, the interchange and the final part of your trip.',
      limit: 'This guide has no live timetable or travel-time estimate. Check current service information for your trip.',
      sources: ['transport'],
    },
    construction: {
      title: 'A strategy is not a works timetable.',
      body: 'Changes to individual streets can involve works and temporary access arrangements. Their dates and details sit with the specific project, rather than the overall strategy.',
      consider: 'Find the project for your street and check its latest works notice, delivery arrangements and detour information.',
      limit: 'There is no live construction schedule or closure feed in this conversation.',
      sources: ['transport', 'streets'],
    },
    business: {
      title: 'Look at both visitors and servicing.',
      body: 'The strategy links people-focused Little Streets with hospitality and retail. For a particular business, pedestrian access, deliveries and servicing are all relevant design questions.',
      consider: 'Compare customer walking routes and shopfront access with the proposed loading and delivery arrangements.',
      limit: 'We do not forecast turnover, footfall or a financial benefit for a business.',
      sources: ['transport', 'streets'],
    },
    prices: {
      title: 'Transport policy is not a valuation.',
      body: 'The strategy describes transport priorities, rather than prices for individual properties. It cannot isolate the effect of one street change from other changes in the property market.',
      consider: 'Use a specific project design to understand the surroundings, and keep property-market evidence separate.',
      limit: 'There is no property-price prediction in this guide.',
      sources: ['transport'],
    },
    rent: {
      title: 'Your rent needs different evidence.',
      body: 'A city-wide transport strategy does not tell us the future rent of an individual home. Proposed access improvements are context, not a rental calculation.',
      consider: 'Check the actual proposal near the home, then compare it with current rental information for that property and area.',
      limit: 'We do not estimate rental changes or give tenancy advice.',
      sources: ['transport'],
    },
  },
};

/** Asking an existing question takes the reader back to its answer. */
export function appendPlanQuestion(history: QuestionId[], question: QuestionId): QuestionId[] {
  return history.includes(question) ? history : [...history, question];
}
