# Personal News Filter and Digest Project

Sep 24, 2026 · @Joe Manley

A personalized news aggregator for Joe that filters by durability, geographic proximity, and professional relevance (financial planning), with built-in transparency about its own editorial choices.

## Design goals and philosophy

Standard news consumption optimizes for engagement, not for a reader's wellbeing or agency. It over-weights novelty, conflict, and geographic distance from the reader's actual sphere of control, which magnifies anxiety about things the reader cannot act on while starving attention for things they can.

This system inverts that. It optimizes for three things instead:

1. Durability: will this matter in a year. Most daily news fails this test.
2. Locus of control: does Joe have power, influence, or a personal stake here, professionally, locally, or civically.
3. Proportionality: the space and repetition a story gets should reflect its actual importance, not its emotional charge or virality.

The guiding question for every item is not "is this dramatic" but "does Joe need this to be a better-informed citizen, professional, or neighbor."

Positive developments get deliberate weight too, not as feel-good filler, but because solutions, working models, and genuine human flourishing are underreported relative to their real importance. A story about something that is demonstrably working is treated as being at least as newsworthy as a problem, since it is often more actionable: it shows what can be learned from and copied.

## Filtering rules

Three scoring dimensions combine to decide whether a story appears, and how prominently.

### 1. Durability test

Every story gets a rough durability score: will this still matter in a week, a month, a year. Breaking crime, celebrity news, and most day-to-day political skirmishes score low and are excluded by default. Structural shifts, legislation, major court rulings, and events that change Joe's own financial or civic environment score high.

### 2. Concentric circles of geography

Relevance decays with distance from Joe's home base, and the bar for inclusion rises accordingly.

| Circle | Scope | Bar for inclusion |
| --- | --- | --- |
| Inner | Joe's town and county | Low bar, most local civic and safety news included |
| Middle | State and metro region | Medium bar, state policy, elections, regional economy |
| Outer | National | High bar, must be durable and structurally significant |
| Far | International | Highest bar, must have clear durable relevance to Joe's life or work |

### 3. Domain expertise weighting

As a financial planner, Joe's feed up-weights personal finance, tax policy, retirement policy, markets, and regulatory changes affecting financial advisors. The same national story that would be filtered out for a general reader may clear the bar here because it is professionally actionable.

### Composite score

### 4. Positive developments and flourishing

A fourth dimension deliberately boosts stories about what is working: genuine innovation, problems being solved, beauty, truth-telling, and people or communities flourishing. This is not a quota for feel-good filler. It is a correction for the fact that working solutions are inherently less dramatic than crises, and therefore under-covered relative to their real value, even though a working model is often the most useful and actionable kind of news there is.

A story that shows something good and true and durable can outrank a routine problem story of similar geographic and domain relevance.

A story needs a combined score across durability, geographic proximity, and domain relevance to clear the bar for inclusion at all, and a higher combined score to earn prominent placement or repetition in the digest.

### Story fatigue and deduplication

A high composite score is necessary but not sufficient for repeated inclusion. Some stories, like an ongoing war or a policy change such as the Social Security cost-of-living adjustment, stay durable and high-scoring for weeks, but do not need fresh coverage every single cycle just because they keep clearing the bar. The system tracks what has already been covered and how recently, and only resurfaces an ongoing story when there is a genuine update, not simply because it still scores well. This is an editorial judgment call the rubric needs to make explicitly, not by accident.

This also doubles as a durability check in itself: a story that made noise for a day or two and then vanished with no follow-up coverage is mild evidence, not proof, that it was never structurally important in the first place. Genuine silence over time is treated as a signal alongside the explicit scoring rules, not just an absence of one. Functionally, two mechanisms track this: a periodic rescan of the raw feed history to see whether a story kept getting covered at all, and a running tally of anything featured or flagged as borderline, so a story that never spiked hard enough to win any single day or week can still surface if it quietly persisted across many of them.

## Editorial transparency

Every filtering system makes choices that function as bias, even unintentionally. This digest makes those choices visible rather than hidden.

Each digest includes a short methodology footer stating what was excluded and why, for example a note like "12 national stories were filtered out this week as low-durability." Any story that was close to the inclusion bar gets a one-line flag noting it was a borderline call. Joe can request a full list of excluded headlines for any digest period, so nothing is silently dropped without a trace.

Sources lean on mainstream and regional RSS feeds rather than social media, which is noisier and harder to filter reliably, so some mainstream framing is an accepted limitation, not a hidden one. The system also avoids false balance. A story is included or excluded based on the durability and relevance rules, not to manufacture ideological symmetry, and the digest will say so plainly when a topic is skewed by real-world events rather than editorial choice.

## Digest cadence and format

| Digest | Frequency | Content | Length |
| --- | --- | --- | --- |
| Daily pulse | Once a day | Only inner-circle local news and anything domain-critical or truly urgent | Zero to 3 items, a few lines each, and zero is a fully expected outcome on many days |
| Weekly digest | Once a week, Saturday morning, meant for weekend reading | Durable stories across all circles, with context and why they matter to Joe. On the first weekend of the month, an added section invites Joe to pick one previously flagged story to explore in depth. | 8 to 12 items, short paragraphs |

There is no separate monthly cadence. A distinct monthly review only made sense if it had its own job the weekly could not already do, and it does not, so it is folded into the first weekend of the month instead. Both the daily pulse and the weekly digest carry a simple flag Joe can tap on any story, meaning something like this is worth digging into later. Flagged stories are logged rather than acted on immediately, and once a month, that log surfaces as a short list Joe chooses from, picking one to explore in real depth. This makes the monthly bonus section curated by Joe's own judgment over time, rather than the system re-guessing what mattered after the fact.

The daily pulse is deliberately thin, meant to prevent the anxious drip-feed Joe described. Most real understanding is meant to accumulate in the weekly and monthly layers, where a story has had time to prove it matters.

### A rotation across the circles

Even with the concentric-circle geography test, the daily pulse and weekly digest are built to notice what's actively happening, and can never fully cover what's quietly happening. A famine, a slow-burning regional conflict, or a persistent local issue can matter for a long time without ever producing the kind of event that generates recurring coverage. The system needs a way to catch these, not so Joe worries about them daily, but so nothing genuinely significant disappears from view entirely.

This separates two questions the design was conflating: how much something should affect Joe emotionally day to day, which the concentric-circle geography test still governs, keeping the daily pulse geographically gated, and whether Joe should know something exists at all, which a separate rotation now answers, without adding daily anxiety.

The rotation gives each concentric circle its own dedicated day, rather than trying to cover every circle every day:

- **Hyperlocal** — family and friends. Not pulled from any feed; entirely something Joe brings to the table himself.
- **Local** — Joe's town and county.
- **State/national** — whether Indiana deserves separate treatment from national news, or collapses into it, is still open (see Open questions).
- **Global** — not chasing headlines. This day asks not "what happened" but "what's persistently or quietly true in this region right now," including things significant enough to matter without ever spiking.

The global layer additionally rotates by region on a monthly cadence, one region in focus per month, for example Sub-Saharan Africa one month and East Asia the next, rather than trying to cover the whole world every week. A monthly rotation gives roughly four weekly touches on a region before moving on, enough attention for something Joe is deliberately keeping at arm's length. A conflict that resolves before its region comes back around simply needs no more of Joe's attention; something that's stayed significant for a year or more will surface again the next time that region comes up.

Each region carries its own running log. When the rotation returns to a region, the system runs a fresh AI search scoped to that region and compares it against the notes from the last visit, rather than relying on memory that could go stale. The result each month is a brief note on what's changed, or that nothing has, plus a suggestion for what's worth Joe's attention this time. This keeps the check-in current without asking Joe or the system to track every region continuously.

## Sample daily pulse, September 24, 2026

A one-off test run against real headlines pulled today, scored against the rubric above, to see how the filter behaves in practice.

Social Security's 2027 cost-of-living adjustment is tracking toward the highest increase in three years, new estimates show. Relevant to retirement planning conversations.

401k balances grew 10.5 percent last quarter, the strongest quarterly growth since late 2020, driven by a strong stock market.

More homebuyers are turning to riskier adjustable-rate mortgages as rates climb, per the Mortgage Bankers Association.

Fresh vegetable prices are up 44 percent on an annualized basis versus three months ago, adding to household budget pressure.

Filtered out: a Minnesota county jail death under investigation, and a celebrity-adjacent grief interview, both low-durability and outside the geographic circles that matter here.

Borderline, flagged but not included: Iran's president addressing the UN as the war continues. High durability, but outer-circle, so it did not clear today's bar on its own.

All four included stories are finance and retirement stories, which reflects real skew in today's news cycle and the domain weighting, not an editorial thumb on the scale.

## Implementation plan

### Data sources

- Local news: town and county newspaper RSS feeds, local government meeting agendas
- State and regional: state capital press feeds, regional paper RSS
- National and international: a small set of RSS feeds from a few outlets across the spectrum, deliberately not just one
- Domain: financial planning and markets feeds, IRS and SEC regulatory updates, retirement policy news

### Technical approach

A simple pipeline: pull stories from RSS feeds on a schedule, score each one against the durability, geography, and domain rules using Claude to read and rate them, then compile the surviving stories into the appropriate digest format. This can run as a scheduled task that drops a digest into a doc or a message on the chosen cadence.

### First build steps

1. Pick and confirm the actual RSS feeds and sources for each circle
2. Write the scoring rubric as explicit, testable criteria Claude can apply consistently
3. Build and test the daily pulse first, since it is the simplest and most frequent
4. Run it for a week, review what got included or excluded, and tune the rules
5. Add the weekly and monthly layers once the daily pulse feels right
6. Later phase: a periodic retrospective that checks whether filtered-out stories turned out to matter, and tunes the rubric accordingly
7. Later phase: a year-in-review tab showing the top stories by month or week, historically, with a simple star control to manually pin a story into that list and an equally simple way to remove one, overriding the algorithm's own judgment in either direction

## Beyond news: the daily diet

News alone is not a complete information diet. The digest should sit inside something larger that forms Joe well, not just informs him.

Each digest opens with a short grounding piece before any news: a Bible verse or short devotional reflection, setting the posture Joe reads from rather than trying to recover calm after the harder stories. A brief closing thought can echo this at the end, though the opening piece is the anchor.

### Grounding structure: liturgical skeleton, thematic constants, and a narrative read-through

Rather than a strict cover-to-cover Bible plan or a purely topical one tied to the news, the grounding piece follows its own calendar, deliberately decoupled from whatever is loudest in the headlines that day. It borrows the liturgical year as a skeleton: Advent, Christmas, Epiphany, Lent, Easter, and the long stretches of Ordinary Time, each season carrying its own natural theme such as waiting, hope, light, repentance, or resurrection.

The stretches of Ordinary Time are filled with focused runs through the core building blocks of the faith rather than left empty or generic: a few weeks living inside the Beatitudes, then the fruits of the Spirit, then perhaps the Ten Commandments or the Lord's Prayer. These are the constants Joe returns to on a rotation, building real familiarity rather than novelty for its own sake.

Alongside the constants, a separate rotating track moves through less-visited parts of scripture in narrative order rather than strict canonical order, similar in spirit to the Great Adventure Bible Timeline approach used by Fr. Mike Schmitz's Bible in a Year podcast, which groups scripture into the major periods of salvation history rather than book order. This is where Joe spends a month in a book like Timothy, or sits with Proverbs, or otherwise gets exposed to parts of the Bible outside the greatest hits.

A genuine emergency aside, none of this grounding content is generated from or connected to that day's actual news. The whole point is to protect Joe from the natural but false feeling that this particular moment in the news cycle is uniquely extraordinary and demands uniquely extraordinary spiritual alertness. The steadiness of the rhythm is itself the message.

Rather than choosing a single grounding source from the armchair, the plan calls for an actual month-long trial before locking anything in. Existing daily lectionary traditions already do most of what this section was designed to build from scratch, so the trial compares four real candidates, one per week: the Catholic daily lectionary, which is the shortest at roughly two to three minutes a day; the Eastern Orthodox daily readings, heavier at four to six minutes plus a saint's life story; the Coptic Orthodox daily readings, the heaviest of the three traditions at ten or more minutes across a full stack of Vespers, Matins, and Liturgy passages; and Fr. Mike Schmitz's Bible in a Year, using the Great Adventure narrative ordering. The deciding question at the end of the month is simply which one Joe finds most nourishing to return to, not which is most efficient or most popular.

### Prayer of the week

One classic prayer anchors each week, repeated daily rather than swapped out, so it has time to be turned over and sat with rather than skimmed once. The list favors prayers with real theological density, ones that reward a full week of meditation, over shorter, more aphoristic prayers that land in a single read. A starter set of ten, to be expanded toward a full year over time:

1. Prayer of Saint Basil the Great: Lord our God, steer the ship of our lives to yourself, the quiet harbor, for all storm-stressed souls. Guide us, who are Your servants, along the safest course among the reefs of life's many temptations. Steer us to the actual haven of security for our souls, which is Yourself. Amen.
2. Saint Augustine's prayer on the restless heart, from the Confessions: You have made us for Yourself, O Lord, and our heart is restless until it rests in You. Great are You, O Lord, and greatly to be praised. You move us to delight in praising You, for You have made us for Yourself.
3. Saint Patrick's Breastplate, the Christ with me section: Christ with me, Christ before me, Christ behind me, Christ in me, Christ beneath me, Christ above me, Christ on my right, Christ on my left, Christ when I lie down, Christ when I sit down, Christ when I arise, Christ in the heart of everyone who thinks of me, Christ in the mouth of everyone who speaks of me, Christ in every eye that sees me, Christ in every ear that hears me.
4. Saint Teresa of Avila's Bookmark Prayer: Let nothing disturb you, let nothing frighten you, all things are passing away, God never changes. Patience obtains all things. Whoever has God lacks nothing. God alone suffices.
5. The Canticle of the Creatures, Saint Francis of Assisi: Most High, all-powerful, good Lord, Yours is the praise, the glory, the honor, and every blessing. To You alone, Most High, do they belong, and no one is worthy to speak Your name. Praised be You, my Lord, with all Your creatures, especially Sir Brother Sun, who is the day and through whom You give us light, and he is beautiful and radiant with great splendor, and bears a likeness of You, Most High One.
6. Prayer from the Imitation of Christ, Thomas a Kempis: Most kind Jesus, grant me Your grace, so that it may be with me and work with me and remain with me to the end. Grant me to know what I ought to know, to love what I ought to love, to praise what delights You most, to value what is precious in Your sight, and to hate what is offensive to You.
7. The Suscipe, Saint Ignatius of Loyola: Take, Lord, and receive all my liberty, my memory, my understanding, and my entire will, all that I have and call my own. You have given all to me. To You, Lord, I return it. Everything is Yours. Do with it what You will. Give me only Your love and Your grace. That is enough for me.
8. The Magnificat, Mary's song of praise, Luke chapter 1: My soul magnifies the Lord, and my spirit rejoices in God my Savior, for He has looked upon the humble estate of His servant. For behold, from now on all generations will call me blessed, for He who is mighty has done great things for me, and holy is His name.
9. The Lord's Prayer, Matthew chapter 6: Our Father, who art in heaven, hallowed be Thy name. Thy kingdom come, Thy will be done, on earth as it is in heaven. Give us this day our daily bread, and forgive us our trespasses, as we forgive those who trespass against us, and lead us not into temptation, but deliver us from evil.
10. Augustine's prayer for the light of truth: Grant me, O Lord, to know You, to love You, and to rejoice in You. And if I cannot do these perfectly in this life, let me at least advance to higher degrees every day, until I can come to do them in perfection. Let the knowledge of You increase in me here, that it may be full hereafter. Let the love of You grow every day more and more here, that it may be perfect hereafter, so that my joy may be full in You.
11. Saint Francis of Assisi's Prayer Before the Crucifix, said before the San Damiano cross: Most High, glorious God, enlighten the darkness of my heart and give me true faith, certain hope, and perfect charity, sense and knowledge, Lord, that I may carry out Your holy and true command. Amen.

This list is deliberately weighted toward density over accessibility, favoring prayers like these over shorter, more familiar ones such as the Serenity Prayer or the peace prayer attributed to Francis, which are well loved but tend to land fully on a single reading rather than continuing to open up over a week of repetition.

For the most important stories, the digest automatically includes deeper context beyond a summary: what research or prior attempts exist on the topic, where genuine consensus lies and where it does not, and the open questions serious people are still debating. Where relevant and helpful, this can include how Joe's own faith tradition has engaged the underlying question, treated as one more thoughtful voice in the conversation, not the final word.

This automatic deep-dive is reserved for the highest-scoring stories, since it is the most compute-intensive part of the system. Every other story gets a simple dig-deeper option Joe can trigger on demand, so the depth is available everywhere but only spent automatically where it matters most.

### A rhythm of silence

Most days genuinely do not produce news that needs Joe's engagement, so the daily cadence should not pretend otherwise. Rather than a light version of the news every day, some days are reflection days: little or no news, and instead a short prayer prompt, a passage to sit with, or an inspiring story, closing with a simple question like which of these would you like to pray about today. Other days, on a less frequent rhythm, carry the fuller news digest. A genuine emergency, a major disaster or an event on the scale of a national crisis, overrides this rhythm and surfaces immediately regardless of the day.

### Toward the body and other people

Flourishing is not only informational. The digest can occasionally nudge Joe away from the screen and toward action or relationship, for instance suggesting who he might call or talk to about a story, rather than only offering more to read.

### A two-way dialogue, not a broadcast

The digest can include a brief, optional prompt for Joe's own reflection, what he noticed, felt, or wants to remember, so the practice becomes a conversation over time rather than one-directional information delivery.

### The role of AI summaries and interface

Across all three content types, the same principle applies: the raw material comes first, and AI involvement is contextual and on demand rather than inserted automatically. Each piece carries a chat box beside it that already knows what Joe is looking at, so a conversation can start immediately without Joe having to re-explain context.

The daily prayer needs no AI summary at all. It is meant to be sat with directly, not processed. A chat box sits alongside it purely for whenever Joe wants to talk through what he is noticing, entirely optional and never pre-filled with commentary.

The day's reading from whichever tradition is in trial is presented in full, again with no automatic summary or commentary layered on top, since the point is direct experience of the text. A chat box beside it lets Joe start asking questions about that specific passage whenever he wants, already scoped to it.

News items work differently, since the whole point of the digest is filtering and compression. Each story shows as a headline and a short blurb. Clicking it expands to the link to the original article, or the article's text where that can be pulled directly, a brief AI summary, and a small set of common one-tap actions, such as surfacing different perspectives on the story. A chat box is available here too, for anything outside those common actions.

The deeper aim behind all of this is not personal optimization for its own sake. It is to help Joe show up better as a father, a coworker, and a citizen, not just a more informed individual.

## Open questions

- [ ] What town and county should anchor the inner geographic circle
- [ ] Which specific outlets should feed the national and international layer, to avoid single-source bias
- [ ] Should the daily pulse be delivered as a doc, a message, or something else
- [ ] What time of day should each digest arrive
- [ ] Beyond personal finance, are there other domains Joe wants up-weighted, such as a hobby or a cause
- [ ] How much manual override does Joe want, for example a way to flag a story as important even if it fails the durability test
- [ ] Which day of the week (or days) should map to which concentric circle, hyperlocal through global
- [ ] Whether Indiana as a state needs separate treatment from national news, or collapses into it
