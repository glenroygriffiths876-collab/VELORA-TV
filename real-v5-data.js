
// Velora V5 — Real Sources Layer
// Loaded after app.js. Keeps V3/V4 ingestion engine intact while replacing consumer-facing demo content.

const V5_DEMO_SOURCE_ID = 'velora-open-demo';

const V5_OFFICIAL_CHANNELS = [
  {id:'real-abc',num:'201',name:'ABC News Live',short:'ABC',group:'USA News',official:true,access:'Official free stream',now:'24/7 Breaking News',desc:'ABC News Live official 24/7 coverage.',watchUrl:'https://abcnews.com/live?stream=3',sourceName:'ABC News'},
  {id:'real-cbs',num:'202',name:'CBS News 24/7',short:'CBS',group:'USA News',official:true,access:'Watch in Velora',now:'CBS News 24/7',desc:'Free 24/7 live news from CBS News.',embedUrl:'https://www.youtube.com/embed/m0JXqFvo_ck?autoplay=1&rel=0',watchUrl:'https://www.cbsnews.com/live/',sourceName:'CBS News'},
  {id:'real-nbc',num:'203',name:'NBC News NOW',short:'NBC',group:'USA News',official:true,access:'Watch in Velora',now:'NBC News NOW',desc:'NBC News NOW live breaking news and developing stories.',embedUrl:'https://www.youtube.com/embed/MC6SS_D3psM?autoplay=1&rel=0',watchUrl:'https://www.youtube.com/watch?v=MC6SS_D3psM',sourceName:'NBC News'},
  {id:'real-livenow',num:'204',name:'LiveNOW from FOX',short:'FOX',group:'USA News',official:true,access:'Watch in Velora',now:'Raw & Unfiltered News',desc:'Non-stop breaking news, live events and stories from FOX Television Stations.',embedUrl:'https://www.youtube.com/embed/J8w2u82o-Is?autoplay=1&rel=0',watchUrl:'https://www.livenowfox.com/live?id=LIVENOW',sourceName:'LiveNOW from FOX'},
  {id:'real-foxweather',num:'205',name:'FOX Weather',short:'WX',group:'Weather',official:true,access:'Official free stream',now:'Weather Streaming 24/7',desc:"FOX Weather live from America's Weather Center.",watchUrl:'https://www.livenowfox.com/live/fox-weather',sourceName:'FOX Weather'},
  {id:'real-foxsoul',num:'206',name:'FOX Soul',short:'SOUL',group:'Entertainment',official:true,access:'Official free stream',now:'Celebrate Black Culture',desc:'FOX Soul 24/7 programming and culture.',watchUrl:'https://www.livenowfox.com/live/soul-live',sourceName:'FOX Soul'},
  {id:'real-cbssportshq',num:'210',name:'CBS Sports HQ',short:'HQ',group:'Sports',official:true,access:'Official free stream',now:'24/7 Sports News',desc:'Always-on sports news, highlights and analysis with no subscription required.',watchUrl:'https://www.cbssports.com/watch/live',sourceName:'CBS Sports'},
  {id:'real-golazo',num:'211',name:'CBS Sports Golazo',short:'GOAL',group:'Sports',official:true,access:'Official free stream',now:'Soccer News & Live Programming',desc:'CBS Sports Golazo Network soccer coverage.',watchUrl:'https://www.cbssports.com/watch/cbs-sports-golazo-network',sourceName:'CBS Sports'},
  {id:'real-bloomberg',num:'220',name:'Bloomberg Television',short:'BTV',group:'Business',official:true,access:'Official free stream',now:'Bloomberg Television',desc:'Markets, business and financial news from Bloomberg.',watchUrl:'https://www.bloomberg.com/live',sourceName:'Bloomberg'},
  {id:'real-aljazeera',num:'221',name:'Al Jazeera English',short:'AJE',group:'World News',official:true,access:'Watch in Velora',now:'Al Jazeera Live',desc:'Live international news from Al Jazeera English.',embedUrl:'https://www.youtube.com/embed/3XiMJUpliI4?autoplay=1&rel=0',watchUrl:'https://www.aljazeera.com/video/live',sourceName:'Al Jazeera'},
  {id:'real-pbcj',num:'301',name:'PBC Jamaica',short:'PBCJ',group:'Jamaica',official:true,access:'Official Jamaica stream',now:'PBCJ Live',desc:'Public Broadcasting Corporation of Jamaica official live stream.',watchUrl:'https://pbcjamaica.org/live-stream/',sourceName:'PBCJ'},
  {id:'real-weather',num:'230',name:'WeatherNation',short:'WN',group:'Weather',official:true,access:'Official free stream',now:'WeatherNation Live',desc:'National weather coverage and forecasts.',watchUrl:'https://www.weathernationtv.com/',sourceName:'WeatherNation'},
  {id:'real-sky',num:'231',name:'Sky News',short:'SKY',group:'World News',official:true,access:'Watch in Velora',now:'Sky News Live',desc:'Sky News live breaking news and analysis from the UK and around the world.',embedUrl:'https://www.youtube.com/embed/xDWQ3LkccY8?autoplay=1&rel=0',watchUrl:'https://news.sky.com/watch-live',sourceName:'Sky News'},
  {id:'real-dw',num:'240',name:'DW News',short:'DW',group:'World News',official:true,access:'Watch in Velora',now:'DW News Live',desc:'Deutsche Welle live international news and analysis.',embedUrl:'https://www.youtube.com/embed/Lh5GXucy2EU?autoplay=1&rel=0',watchUrl:'https://www.youtube.com/watch?v=Lh5GXucy2EU',sourceName:'DW News'},
  {id:'real-fr24',num:'241',name:'France 24 English',short:'F24',group:'World News',official:true,access:'Watch in Velora',now:'France 24 Live',desc:'France 24 English live international breaking news.',embedUrl:'https://www.youtube.com/embed/Ap-UM1O9RBU?autoplay=1&rel=0',watchUrl:'https://www.youtube.com/watch?v=Ap-UM1O9RBU',sourceName:'France 24'},
  {id:'real-trt',num:'242',name:'TRT World',short:'TRT',group:'World News',official:true,access:'Watch in Velora',now:'TRT World Live',desc:'TRT World live global news and current affairs.',embedUrl:'https://www.youtube.com/embed/b8lPrtjmnmw?autoplay=1&rel=0',watchUrl:'https://www.youtube.com/watch?v=b8lPrtjmnmw',sourceName:'TRT World'},
  {id:'real-nasa',num:'250',name:'NASA+',short:'NASA',group:'Science',official:true,access:'Official free service',now:'NASA+ Live & On Demand',desc:'NASA live events, documentaries, mission coverage and science programming.',watchUrl:'https://plus.nasa.gov/',sourceName:'NASA'},
  {id:'real-redbull',num:'260',name:'Red Bull TV',short:'RBTV',group:'Sports',official:true,access:'Official free service',now:'Live Action Sports & Events',desc:'Free live events, action sports, films and shows from Red Bull TV.',watchUrl:'https://www.redbull.com/us-en/live-events',sourceName:'Red Bull TV'}
];

const V5_DISCOVERY_ITEMS = [
  {id:'d-nf-1',title:'Riot',kind:'movie',service:'Netflix Jamaica',rank:1,tag:'Top 10 in Jamaica',note:'Currently charting on Netflix Jamaica.',watchUrl:'https://www.netflix.com/search?q=Riot'},
  {id:'d-nf-2',title:'Black Adam',kind:'movie',service:'Netflix Jamaica',rank:2,tag:'Top 10 in Jamaica',note:'Currently charting on Netflix Jamaica.',watchUrl:'https://www.netflix.com/search?q=Black%20Adam'},
  {id:'d-nf-3',title:'Best of the Best',kind:'movie',service:'Netflix Jamaica',rank:3,tag:'Top 10 in Jamaica',note:'Currently charting on Netflix Jamaica.',watchUrl:'https://www.netflix.com/search?q=Best%20of%20the%20Best'},
  {id:'d-nf-4',title:'Why Did I Get Married Again?',kind:'movie',service:'Netflix Jamaica',rank:4,tag:'Top 10 in Jamaica',note:'Currently charting on Netflix Jamaica.',watchUrl:'https://www.netflix.com/search?q=Why%20Did%20I%20Get%20Married%20Again'},
  {id:'d-nf-5',title:'Daredevil',kind:'movie',service:'Netflix Jamaica',rank:5,tag:'Top 10 in Jamaica',note:'Currently charting on Netflix Jamaica.',watchUrl:'https://www.netflix.com/search?q=Daredevil'},
  {id:'d-nf-6',title:'A Minecraft Movie',kind:'movie',service:'Netflix Jamaica',rank:6,tag:'Top 10 in Jamaica',note:'Currently charting on Netflix Jamaica.',watchUrl:'https://www.netflix.com/search?q=A%20Minecraft%20Movie'},
  {id:'d-nf-7',title:'The SpongeBob Movie: Search for Squarepants',kind:'movie',service:'Netflix Jamaica',rank:7,tag:'Top 10 in Jamaica',note:'Currently charting on Netflix Jamaica.',watchUrl:'https://www.netflix.com/search?q=The%20SpongeBob%20Movie'},
  {id:'d-nf-8',title:'Blood Work',kind:'movie',service:'Netflix Jamaica',rank:8,tag:'Top 10 in Jamaica',note:'Currently charting on Netflix Jamaica.',watchUrl:'https://www.netflix.com/search?q=Blood%20Work'},
  {id:'d-nf-9',title:'UNABOMBER',kind:'movie',service:'Netflix Jamaica',rank:9,tag:'Top 10 in Jamaica',note:'Currently charting on Netflix Jamaica.',watchUrl:'https://www.netflix.com/search?q=UNABOMBER'},
  {id:'d-nf-10',title:'How to Lose a Popularity Contest',kind:'movie',service:'Netflix Jamaica',rank:10,tag:'Top 10 in Jamaica',note:'Currently charting on Netflix Jamaica.',watchUrl:'https://www.netflix.com/search?q=How%20to%20Lose%20a%20Popularity%20Contest'},

  {id:'d-hu-1',title:'The Substance',kind:'movie',service:'Hulu',rank:1,tag:'October pick',note:'Featured in Hulu’s October 2026 lineup.',watchUrl:'https://www.hulu.com/search?q=The%20Substance'},
  {id:'d-hu-2',title:'The Craft',kind:'movie',service:'Hulu',rank:2,tag:'Popular on Hulu',note:'Listed among Hulu popular movies.',watchUrl:'https://www.hulu.com/search?q=The%20Craft'},
  {id:'d-hu-3',title:'Hidden Figures',kind:'movie',service:'Hulu',rank:3,tag:'Popular on Hulu',note:'Listed among Hulu popular movies.',watchUrl:'https://www.hulu.com/search?q=Hidden%20Figures'},
  {id:'d-hu-4',title:'Despicable Me',kind:'movie',service:'Hulu',rank:4,tag:'Popular on Hulu',note:'Listed among Hulu popular movies.',watchUrl:'https://www.hulu.com/search?q=Despicable%20Me'},
  {id:'d-hu-5',title:'Wonka',kind:'movie',service:'Hulu',rank:5,tag:'Popular on Hulu',note:'Listed among Hulu popular movies.',watchUrl:'https://www.hulu.com/search?q=Wonka'},

  {id:'d-hus-1',title:'American Horror Story: 13',kind:'series',service:'Hulu',rank:1,tag:'New this month',note:'New episodes in Hulu’s October 2026 lineup.',watchUrl:'https://www.hulu.com/search?q=American%20Horror%20Story'},
  {id:'d-hus-2',title:'Scrubs — Season 2',kind:'series',service:'Hulu',rank:2,tag:'New this month',note:'Season 2 begins in Hulu’s October 2026 lineup.',watchUrl:'https://www.hulu.com/search?q=Scrubs'},
  {id:'d-nfs-1',title:'Monster: The Lizzie Borden Story',kind:'series',service:'Netflix',rank:1,tag:'Global TV leader',note:'No. 1 on Netflix’s English TV list for the week of Sept. 21.',watchUrl:'https://www.netflix.com/search?q=Monster%20The%20Lizzie%20Borden%20Story'},

  {id:'d-th-1',title:'Verity',kind:'theater',service:'In Theaters',rank:1,tag:'US box office',note:'No. 1 on the October month-to-date box-office chart.',watchUrl:'https://www.google.com/search?q=Verity+showtimes+Jamaica'},
  {id:'d-th-2',title:'Resident Evil',kind:'theater',service:'In Theaters',rank:2,tag:'US box office',note:'Current October theatrical release.',watchUrl:'https://www.google.com/search?q=Resident+Evil+2026+showtimes+Jamaica'},
  {id:'d-th-3',title:'Heart of the Beast',kind:'theater',service:'In Theaters',rank:3,tag:'US box office',note:'Current October theatrical release.',watchUrl:'https://www.google.com/search?q=Heart+of+the+Beast+2026+showtimes+Jamaica'},
  {id:'d-th-4',title:'Primetime',kind:'theater',service:'In Theaters',rank:4,tag:'US box office',note:'Current October theatrical release.',watchUrl:'https://www.google.com/search?q=Primetime+2026+showtimes+Jamaica'},
  {id:'d-th-5',title:'Digger',kind:'theater',service:'In Theaters',rank:5,tag:'US box office',note:'Current October theatrical release.',watchUrl:'https://www.google.com/search?q=Digger+2026+showtimes+Jamaica'}
];

function v5ImportedChannels(){
  return state.channels.filter(x => rightsActive(x) && ((x.sources||[]).some(s=>s.sourceId!==V5_DEMO_SOURCE_ID) || x.sourceId!==V5_DEMO_SOURCE_ID));
}
function v5LicensedCatalog(){
  const base=state.catalog.filter(x => rightsActive(x) && ((x.sources||[]).some(s=>s.sourceId!==V5_DEMO_SOURCE_ID) || x.sourceId!==V5_DEMO_SOURCE_ID));
  return state.profile.kids ? base.filter(x=>x.rating==='TV-Y'||x.genre==='Kids') : base;
}

filteredChannels = function(){ return [...V5_OFFICIAL_CHANNELS, ...v5ImportedChannels()]; };
filteredCatalog = function(){ return v5LicensedCatalog(); };

function v5ChannelCard(ch){
  return `<article class="card realLiveCard" tabindex="0" data-v5-live="${esc(ch.id)}">
    <div class="cardArt channelArt">
      <div class="channelMonogram">${esc(ch.short||ch.name.slice(0,4).toUpperCase())}</div>
      <span class="badge">${ch.official?'OFFICIAL LIVE':'LIVE'}</span>
      ${ch.official?'<span class="verifiedBadge">✓</span>':''}
    </div>
    <b>${esc(ch.name)}</b><small>${esc(ch.now||'Live now')}</small>
  </article>`;
}
liveCard = v5ChannelCard;

function v5DiscoveryCard(x){
  const cls=x.service.toLowerCase().includes('netflix')?'netflix':x.service.toLowerCase().includes('hulu')?'hulu':'theater';
  const action=x.service.includes('Netflix')?'Open Netflix':x.service==='Hulu'?'Open Hulu':'Find showtimes';
  return `<article class="discoveryCard ${cls}">
    <div class="discoverTop"><span>${esc(x.service)}</span><b>#${x.rank}</b></div>
    <div class="discoverBody"><small>${esc(x.tag)}</small><h3>${esc(x.title)}</h3><p>${esc(x.note)}</p></div>
    <button class="ghost discoveryAction" data-v5-external="${esc(x.watchUrl)}">${action} ↗</button>
  </article>`;
}
function v5DiscoveryRail(title,items){
  if(!items.length)return'';
  return `<section class="railSection discoveryRail"><div class="railHead"><h2>${esc(title)}</h2><button data-view="discover">See all ›</button></div><div class="rail">${items.map(v5DiscoveryCard).join('')}</div></section>`;
}

