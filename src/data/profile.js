// The facts both pages share. Change a number here and both pages change with it.
export const profile = {
  name: 'Gautham Sam',
  role: 'Robotics Lead',
  place: 'Hyderabad',
  country: 'India',
  // The headline, confirmed by Gautham on 17 Nov 2026.
  headline: ['Wheels, arms, and one arm of a humanoid.', 'I work on the software that makes them useful.'],
  links: {
    linkedin: 'https://www.linkedin.com/in/gautham-sam/',
    github: 'https://github.com/gauthammsam57',
    email: 'gauthammsam57@gmail.com', // chosen 16 Nov 2026
  },
  // Where the site lives, for the link preview (it needs full addresses). GitHub Pages, from the public
  // repository gauthammsam57.github.io, served at the free is-a.dev name (registered 23 Nov 2026,
  // is-a-dev/register#62462); the github.io address redirects here. cv.gauthamsam.is-a.dev redirects to cv.html.
  site: 'https://gauthamsam.is-a.dev/',
  // Shown on the CV page and in its PDF only, at Gautham's request (16 Nov 2026). Not on the desk or the walk-through.
  phone: '+91 80882 29827',
  numbers: {
    yearsInRobotics: 6,
    since: 2020,
    teamSize: 6,
    prsWritten: 212,
    prsReviewed: 345,
    alexEarlyCommits: 482,
  },
};

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
export const word = (n) => WORDS[n] ?? String(n);
