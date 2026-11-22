Self-authored under explicit creative delegation (the user's long brief sets direction, sections and behaviour; open axes were decided here).

# Recolte Coffee Roastery: homepage

## The eight topics
1. **Vibe**: "warm, tactile, expensive, quiet, and intentional". References: pear.no for pacing and type contrast (not to copy).
2. **Journey (user's order)**: cinematic walk-in film > Featured origins > Roastery and cafe ritual > Subscription > Brew guide and workshop > Visit.
3. **Energy**: calm open, rising through the film, quiet reading in the middle, a small active pulse at subscription and brew, calm resolve at the visit.
4. **Feeling and the one moment**: see curve and peak below.
5. **The thing no other site does**: scrolling roasts the coffee. A live bean-temperature curve climbs as you go and drops at the door.
6. **Range**: premium-minimal editorial, asked for by the user.
7. **World**: distinct scenes. One continuous film for the walk-in, then chapters on hard-cut grounds.
8. **Assets**: the 25 s Seedance cafe walk-through and three stills of the same venue. No generation.

Real brand facts used (recoltecoffee.com, read 2026-11-22): four coffees with notes, body/acidity and prices; Rwanda 1,800 m, washed, organic, SCA 84.75, women producers; subscription mechanics; story "a dialogue of time and fire"; artwork The Silent Hands by Melek Demirci; address Bomonti Modern Palas, Sisli; phone line Mon-Fri 09:00-17:00. **Cafe opening hours are not published: the hours on the page are a placeholder.**

## Footage map (what is really on screen)
| t (s) | frame | scene copy |
|---|---|---|
| 0-3.4 | doors open from the street | hero: every cup begins as a harvest |
| 3.4-11 | stone bar, grinders, machines | harvest > roast |
| 12-18 | checkerboard wall, plants, arches | the room |
| 18-20.5 | espresso machine, pastry case | extraction |
| 20.5-25 | green leather armchairs | stay |
The footage has no farm, drum roaster or extraction close-up, so those beats are told in copy over the frames that carry them.

## Grammar
New grammar, **Threshold and chapters**: one walk-in film (outside becomes inside), then printed-feeling chapters on hard-cut grounds. Navigation is a roast instrument whose phases are the chapters. Bans: drift interpolation between chapters, a second scrub, centred hero copy, scroll cues, counters with invented numbers.
Why not the others: filmic one-shot forbids visible sequence and hard cuts (the roast nav is a sequence); chaptered editorial forbids the full-bleed scrub the user requires; continuous world cannot hold five content sections; live surface, poster, gallery, split and cutlist do not fit a hospitality story.

## Feeling curve
1. **Stillness then curiosity**: linen paper, a closed arch holding a doorway. The arch opens under the hand.
2. **Arrival (PEAK)**: you walk through the doors and the cafe unfolds, copy landing on what is actually on screen.
3. **Appetite**: four coffees slide past as labels you can open.
4. **Reverence**: the frame holds; the roaster's philosophy crosses over a portrait of the bar.
5. **Agency**: you shape a subscription and the page answers in grams and cups.
6. **Competence**: the scroll becomes a brew timer: grams and seconds tick with your hand.
7. **Belonging, resolved**: green leather, the address, the roast drops at 207 C. The page stops.

**Peak**: "the page opened like a doorway and I walked into the cafe with my scroll wheel." Act 1, the largest span (7.5vh).
**Tell-someone**: "It's the site where scrolling roasts the coffee: a little temperature curve climbs while you walk into the cafe and hits first crack when you subscribe."
**Authored silence**: the first viewport is deliberately still (paper, closed arch) before the peak.

## Score
| Beat | Device | Why |
|---|---|---|
| Walk-in | `scrub` + bespoke arch + time-keyed copy | the camera moving under the hand is the open |
| Origins | `pan` | range reads sideways |
| Ritual | `pin` + kinetic + parallax | an argument, the frame holds |
| Subscription | `flow` + `in` | a working form wants normal scroll |
| Brew | `pin` + bespoke scroll-timer (flow on phones) | the hand drives the recipe |
| Visit | `flow` + `reveal`, holds | the close resolves |
Families: scrub, pan, pin, flow, reveal (5). No family twice in a row. One scrub.

## Signature move
Roast-curve instrument: fixed SVG of a real roast profile shape, drawn by page scroll, live bean temperature and roast clock, chapter markers at Charge, Yellowing, Maillard, First crack, Development, Drop. Markers are magnetic and jump to chapters.

## Revision 2 (2026-11-22): one continuous world
User feedback: "why aren't the transitions like pear.no? the whole point of the video was to transition with it."
Pear, measured headlessly: one 48,150px section with a single sticky stage, one WebGL canvas, nothing ever scrolls past as a block; scenes hand off through camera moves, a pixel/halftone dissolve and blur.
Rebuilt to match that grammar (scroll-craft **Continuous world**): a tall track, one pinned stage, the 25 s clip drawn into WebGL at one pace (1.1 vh per second of film) for the whole page. Every chapter arrives inside the stage.
Transitions: camera move between all chapters; depth blur + dim behind Origins and Brew; halftone dissolve into linen for Subscription and back out to the espresso machine. The arch threshold stays as the opening.
The scrollcraft engine is not mounted on this page: worldflight crossfades separate clips; this is one clip with a shader dissolve. Its rules are kept: only the track in document flow, copy translate under 4vh, lerped playhead, one pace.
Previous version kept in v1-chapters/.
