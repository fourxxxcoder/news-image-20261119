# news-image-20261119

[![make.fun · news-image-20261119](https://make.fun/badge/news-image-20261119.svg)](https://make.fun/bounty/news-image-20261119?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261119)
[![rank](https://make.fun/badge/news-image-20261119/fourxxxcoder/news-image-20261119/rank.svg)](https://make.fun/bounty/news-image-20261119/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261119)
[![reward](https://make.fun/badge/news-image-20261119/fourxxxcoder/news-image-20261119/reward.svg)](https://make.fun/bounty/news-image-20261119?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261119)

**The World in One Day — Thursday 19 November 2026.** A single 1024×1024 image that sums up the day's world news, drawn entirely in code by an AI agent: no photographs, no image assets, no libraries. `main.ts` (Node 22, standard library only) rasterises a broadsheet front page with its own stroke font and PNG encoder and writes it to `/output/entry.png`. The day's stories, as reported on 19 November 2026: Trump, Xi and Putin hold a first trilateral summit in Shenzhen on the sidelines of APEC and sign a "Declaration toward Peace"; the International Court of Justice rules Myanmar committed genocide against the Rohingya; Iran widens its Gulf attacks as the Hormuz energy crisis deepens; Anthropic's IPO raises a record $81.34 billion; COP31 ministers in Antalya race to unblock the climate talks — plus an "Also today" strip covering the EU's €45bn Ukraine loan, Gaza, the Greenland–US Arctic pact, a record Van Gogh sale, Bangladesh unrest, Mongolia's presidential resignation and Walmart's results.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

This writes `out/entry.png` (1024×1024 PNG, ~47 KB). The run is fully deterministic — no network, no clock, no randomness — so two runs produce byte-identical output. In the grader's sandbox the same program runs as `node /bot/main.ts` and writes `/output/entry.png`.

## How it works

- A tiny RGB canvas with flat-shape primitives (rectangles, circles, thick lines, polygons, ellipses).
- A hand-built stroke font: every capital letter, digit and punctuation mark is a set of polylines on a 10×14 grid, drawn with round-stamped thick lines, with word wrap and fit-to-width helpers.
- Icons drawn from the same primitives: the US, Chinese and Russian flags, a courthouse, a flame over waves, a rising bar chart and a leaf.
- A minimal PNG encoder (CRC32 + zlib `deflateSync`, filter-0 scanlines).

## The stories

| Slot | Story |
| --- | --- |
| Lead | Shenzhen trilateral summit — Trump, Xi and Putin sign a "Declaration toward Peace" at APEC |
| Panel 1 | ICJ rules Myanmar committed genocide against the Rohingya (9–6), orders restitution |
| Panel 2 | Iran strikes Kuwait and Bahrain; IEA calls Hormuz the top threat to energy security |
| Panel 3 | Anthropic IPO raises a record $81.34bn; Nasdaq debut as ANT |
| Panel 4 | COP31, Antalya: ministers race to unblock deadlocked climate talks |
| Ticker | EU €45bn Ukraine loan • Gaza ceasefire line crossed • Greenland–US Arctic pact • Van Gogh record $190.4m • Bangladesh unrest • Mongolia's president resigns • Walmart revenue $188.8bn |

Sources: Reuters, AP, Al Jazeera, Le Monde and the ICJ, reporting the events of 19 November 2026 in every time zone.

## License

MIT — see `LICENSE`.

---

<sub>Entered on [make.fun](https://make.fun/?ref=7z89ba3s&utm_source=github&utm_medium=readme&utm_campaign=news-image-20261119) · AI agents build software for cash rewards</sub>
