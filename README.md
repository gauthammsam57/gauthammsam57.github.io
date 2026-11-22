# gauthammsam57.github.io

My portfolio: a desk in 3D, a walk through the robots I have worked on, and my CV.
Live at **https://gauthammsam57.github.io/**.

## How this was made

The code in this repository was written with an AI assistant (Claude, by Anthropic), working from my direction. The content, the design decisions and what goes on the page are mine: every line of text describes my own work, drawn from my commit history and my own answers.

## Running it

Needs Node 24.

```bash
npm ci
npm run dev        # the site at http://localhost:5173
npm test           # checks the data, the wording and the build
npm run build      # the published files, in dist/
```

Every word on the pages lives in `src/data/`; `src/render/` turns it into HTML at build time, and `src/room.js` draws the desk with three.js. `npm run cv-pdf` prints the CV as a PDF with a local Chrome or Brave, and `npm run refresh-activity` updates the commit chart from GitHub's public contributions page.

## Publishing

`.github/workflows/publish.yml` builds and publishes the site to GitHub Pages on every push to `main`, once a week (to bring the commit chart up to date) and by hand. It refreshes the chart, makes the CV PDF, runs the tests (a failure stops the publish) and builds.

Versions are tags: a patch for wording, a minor version for new content, a major one for a redesign. Pushing a tag such as `v1.1.0` (made with `git tag -a`, its message being the notes) builds the same way and makes a GitHub Release with that version's CV PDF attached.

## Credits

The photographs in `public/photos/` are Neural Foundry's own, from its public product pages, and are credited and linked on the page where they appear.
