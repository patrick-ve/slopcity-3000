import type { Sim } from './sim';

const FLAVOR = [
  'Local llama wins spelling bee, refuses to spell "alpaca"',
  'Scientists confirm the city is, in fact, low-poly',
  'Study: 9 out of 10 residents prefer roads that go somewhere',
  'Weather forecast: sunny, with a 30% chance of zoning',
  'Traffic engineers propose radical new idea: more lanes. Again.',
  'Area man builds house entirely out of triangles',
  'Bridge enthusiasts gather to admire "a very nice bridge"',
  'Neighbourhood watch elects cat as chairperson; cat naps through first meeting',
  'New study finds parks "pretty nice, actually"',
  'Pothole on Main Street declared a historical landmark',
  'Llama sighting near City Hall; mayor denies involvement',
  'Power company announces plan to keep producing power',
  'Residents puzzled as buildings appear overnight — "construction" blamed',
  'Economists predict economy will continue to be economic',
  'Water tower painted with a smiley face; citizens report feeling 10% happier',
  'Commuters discover radical shortcut: working from home',
  'Researchers announce breakthrough in reticulating splines',
  'Local bakery\'s polygonal croissant wins regional award',
  'Pigeons file formal complaint about new statue placement',
  'Survey: residents rate sunsets "nine out of ten, would watch again"',
  'Retired llama opens popular knitting school downtown',
  'City council debates whether a hot dog is a sandwich; no zoning changes expected',
  'Citizens petition for more benches, fewer meetings about benches',
  'Mysterious hum downtown identified as the mayor whistling',
  'Garbage collectors\' union celebrates "Refuse Appreciation Day"',
  'Record crowds attend the annual Polygon Festival',
  'Tourists amazed that the trees are "so pointy"',
  'Local school\'s robotics team builds robot that mostly apologises',
  'Sim-ball team wins season opener in dramatic overtime',
  'Weather balloon mistaken for UFO, again',
];

/** Generates ticker headlines from the city's condition. */
export class NewsDesk {
  private flavorIdx: number;
  private lastTopic = new Map<string, number>();

  constructor(private sim: Sim) {
    this.flavorIdx = Math.floor(sim.rng.next() * FLAVOR.length);
  }

  private say(text: string, kind: 'info' | 'good' | 'bad' = 'info'): void {
    this.sim.events.emit('news', { text, kind });
  }

  /** Emit at most once every `months` months per topic. */
  private topic(key: string, months: number, text: string, kind: 'info' | 'good' | 'bad'): boolean {
    const m = this.sim.monthIndex;
    const last = this.lastTopic.get(key) ?? -999;
    if (m - last < months) return false;
    this.lastTopic.set(key, m);
    this.say(text, kind);
    return true;
  }

  month(): void {
    const sim = this.sim;
    const s = sim.stats;
    const c = sim.city;
    const name = c.name;
    let said = 0;
    const try_ = (cond: boolean, key: string, months: number, text: string, kind: 'info' | 'good' | 'bad') => {
      if (said < 2 && cond && this.topic(key, months, text, kind)) said++;
    };
    try_(s.powerDemand > s.powerSupply * 1.02 && s.buildings > 5, 'power', 4, `Brownouts across ${name}! Residents demand more power plants`, 'bad');
    try_(s.unwatered > 10, 'water', 5, `Taps run dry in parts of ${name} — water department overwhelmed`, 'bad');
    try_(s.avgTraffic > 0.8, 'traffic', 6, `Gridlock! Commuters stuck for hours on ${name}'s clogged roads`, 'bad');
    try_(s.resPollution > 0.45, 'smog', 6, 'Smog alert: residents told to keep windows closed', 'bad');
    try_(s.resCrime > 0.4, 'crime', 6, 'Crime wave sweeps neighbourhoods; citizens call for more police', 'bad');
    try_(s.unemployment > 0.15 && s.residents > 1000, 'jobs', 6, `Job shortage: unemployment reaches ${(s.unemployment * 100).toFixed(0)}%`, 'bad');
    try_(c.garbageBacklog > 300, 'garbage', 5, 'Garbage piles up on the curbs as dumps overflow', 'bad');
    try_(c.tax.R >= 12, 'taxR', 8, `Tax revolt brewing over ${c.tax.R}% residential tax`, 'bad');
    try_(c.funds < 0, 'debt', 6, 'City treasury in the red, analysts warn', 'bad');
    try_(c.demand.r > 0.6 && s.residents > 200, 'housing', 8, 'Housing shortage: newcomers cannot find homes', 'info');
    try_(c.demand.c > 0.6 && s.residents > 500, 'shops', 8, 'Shoppers ask for more stores and offices', 'info');
    try_(c.demand.i > 0.6 && s.residents > 200, 'factories', 8, 'Industry looking for land to build new factories', 'info');
    try_(s.residents > 3000 && s.eduCover < 0.2, 'schools', 10, 'Parents ask: where are the schools?', 'bad');
    try_(s.residents > 3000 && s.healthCover < 0.2, 'health', 10, 'Long waits at clinics; residents call for a hospital', 'bad');
    try_(s.resCrime < 0.1 && s.resPollution < 0.15 && s.residents > 5000, 'livable', 14, `${name} named one of the region's most livable cities`, 'good');
    if (said === 0 && sim.rng.next() < 0.55) {
      this.say(FLAVOR[this.flavorIdx % FLAVOR.length]);
      this.flavorIdx += 1 + Math.floor(sim.rng.next() * 3);
    }
  }

  year(): void {
    const s = this.sim.stats;
    const hist = this.sim.city.history;
    const prev = hist.length > 12 ? hist[hist.length - 13].pop : 0;
    const growth = s.residents - prev;
    if (s.residents > 0) {
      this.say(
        growth >= 0
          ? `Happy New Year! ${this.sim.city.name} grew by ${growth.toLocaleString('en-US')} residents last year`
          : `Happy New Year! ${this.sim.city.name} lost ${(-growth).toLocaleString('en-US')} residents last year`,
        growth >= 0 ? 'good' : 'bad',
      );
    }
  }
}
