// Every word of the desk page that is not about a project. Change the wording here, not in the code.
// The projects themselves stay in scenes.js and are shown inside the second monitor.
// `draft: true` marks wording Gautham has not confirmed yet; it shows an amber label in preview.

export const desk = {
  hint: 'Look around. Click anything in the room.',

  // The buttons along the bottom: the same objects, for anyone who would rather not hunt.
  // What a shared link to the desk shows: the page title, this, and a picture of the room (share.jpg).
  share: { description: 'Gautham Sam, Robotics Lead. A desk to look around: how he works, who he works with, and what he has built.' },

  objects: [
    { id: 'monitor', label: 'Sit down', sub: 'The second chair' },
    { id: 'whiteboard', label: 'The whiteboard', sub: 'Who is on what' },
    { id: 'notebook', label: 'The notebook', sub: 'Evenings and people' },
    { id: 'bin', label: 'The bin', sub: 'What did not work' },
    { id: 'photos', label: 'The photographs', sub: '2020 and now' },
    { id: 'outside', label: 'The window', sub: 'Life outside work' },
  ],

  // Which project opens when a robot on the shelf is clicked (ids from scenes.js).
  shelf: [
    { id: 'arms', label: 'An arm' },
    { id: 'wheels', label: 'A robot on wheels' },
    { id: 'humanoid', label: 'One arm of a humanoid' },
    { id: 'remote', label: 'A headset' },
  ],

  // The drawers under the right end of the desk, top one first. The pedestal has four; the ones not
  // listed here stay shut and unlabelled, spare for later. Each has a label you can read from
  // across the room. `href` leaves for another page; `page` opens the notebook at that page.
  drawers: [
    { id: 'cv', label: 'CV', sub: 'the facts, on one page', href: './cv.html' },
    { id: 'hello', label: 'Say hello', sub: 'how to reach me', page: 'hello' },
  ],

  // The small things on the right of the desk. A click leans over the desk to look at them:
  // the gears turn, the lights on the board run. One line each on why they are there.
  small: {
    back: 'Back to the desk',
    items: [
      { id: 'gears', label: 'Gears', caption: 'I trained as a mechanical engineer, and moved into software to make machines move.' },
      { id: 'board', label: 'A circuit board', caption: 'Embedded C is still part of the work: each lab device, from its own code up to the controller.' },
    ],
  },

  // The window on the right wall: life outside work, one place at a time. A camera sits on its sill.
  // `photo` is the picture file, in site/public/outside/ (taken from his Notion gallery). If one is
  // missing the room draws a simple stand-in of the kind named in `scene`.
  // The window is wider than a photograph, so some of the top and bottom is cut: `focus` says which
  // part to keep (0 the top, 1 the bottom, 0.5 the middle if left out).
  // `more` leads to where the rest of the photographs are.
  outside: {
    label: 'Life outside work',
    next: 'Next place',
    back: 'Back to the desk',
    more: { label: '@bog_velik on Instagram', href: 'https://www.instagram.com/bog_velik/' }, // the handle shown (Gautham, 19 Nov 2026)
    places: [
      { id: 'gulmarg', name: 'Gulmarg', scene: 'snow', photo: './outside/gulmarg.jpg' },
      { id: 'gandikota', name: 'Gandikota', scene: 'canyon', photo: './outside/gandikota.jpg' },
      { id: 'ooty', name: 'Ooty', scene: 'tea', photo: './outside/ooty.jpg' },
      { id: 'kerala', name: 'Kerala', scene: 'water', photo: './outside/kerala.jpg' },
      { id: 'ketti', name: 'Ketti Valley', scene: 'valley', photo: './outside/ketti.jpg' },
      { id: 'riyadh', name: 'Riyadh', scene: 'desert', photo: './outside/riyadh.jpg', focus: 0.1 },
    ],
  },

  // The clock on the wall and the view from the window follow this time zone.
  // The clock can be set: drag round its face. `set` is shown while it is not the real time,
  // and `reset` is the button (and a click on the clock) that puts it back.
  clock: { zone: 'IST', offsetHours: 5.5, hint: 'Drag to change the time', set: 'not the real time', reset: 'Back to now in Hyderabad' },

  monitor: {
    lead: 'Pull up a chair. This is what we have been building.',
    back: 'Back to the desk',
    // The monitor shows a browser with tabs: a walk past the robots, everything written out, and the
    // robot in the room as its own software shows it (only when picked; Gautham, 21 Nov 2026).
    tabs: { walk: 'Walk-through', detail: 'In detail', map: 'Live map' },
    // under the Live map; '' leaves the picture on its own (Gautham is not sure it is needed, 21 Nov 2026)
    mapLegend: 'What the robot in the room sees, live: the amber box is the robot, red is its lidar, green is the way it means to go, blue is its dock.',
    site: 'gautham / work /',
    loading: 'starting the simulation',
    // the last thing on the monitor points back to the desk, so the notebook is not missed
    after: { text: 'The rest is not about robots. It is in the notebook on the desk.', button: 'Open the notebook' },
    // What the second monitor shows while nobody is looking at it: an idea of work going on,
    // not a claim of live or real work.
    // It follows the robot in the room: the task it is on, and a map with the robot where it really is.
    idle: {
      title: 'robot · live',
      topics: ['/scan', '/odom', '/tf', '/map', '/plan'],
      tasks: { charging: 'Charging', cleaning: 'Cleaning up', patrolling: 'Patrolling', docking: 'Docking' },
    },
  },

  // The notebook holds what a person would write down: evenings, people, how to reach him.
  notebook: {
    pages: [
      {
        id: 'evenings',
        tab: 'Evenings',
        title: 'The WebRTC evening',
        body: [
          'A teammate was building our WebRTC streaming and it was not working yet. I had worked on it before, so I got curious and sat down with him.',
          'We spent that evening on how WebRTC works underneath. Once he knew what I knew, we went looking for the real cause together: the browser’s WebRTC internals, STUN, starting with Google’s server.',
          'He built the first connection, from a Python sample I had given him. On the office network it was instant.',
          'Then we tried a phone hotspot and it would not connect. Some mobile carriers block UDP. That took us to TURN.',
        ],
        note: 'More evenings to come.',
      },
      {
        id: 'people',
        tab: 'People',
        title: 'None of this was mine alone.',
        items: [
          'The Invento (Mitra) team, and the people who built the stack I inherited there.',
          'The robotics team at Neural Foundry.',
          'The AI, XR and platform teams we build with.',
          'The open-source projects underneath all of it: ROS 2, Nav2, MoveIt.',
        ],
        // Teams only, no names (Gautham, 19 Nov 2026).
      },
      {
        id: 'hello',
        tab: 'Say hello',
        title: 'Working on something with robots?',
        body: ['I’d like to hear about it.'],
        contact: true,
      },
    ],
  },

  // The whiteboard: who is on what. Roles only, never names. The items are real but safe:
  // each one is already described elsewhere on this site, and none is a live company task.
  whiteboard: {
    title: 'who is on what', // confirmed 17 Nov 2026: a fair picture of the team growing, not an exact chart
    tree: {
      label: 'me',
      children: [
        { label: 'mobile robots', on: 'F4', children: [{ label: 'engineer', on: 'F3' }, { label: 'engineer', on: 'B1' }] },
        { label: 'manipulators', on: 'B2', children: [{ label: 'engineer', on: 'F1' }] },
        { label: 'simulation', on: 'F2' },
      ],
      beside: 'AI · XR · platform',
    },
    bugs: [
      {
        id: 'B1',
        title: 'Video works in the office, not on a hotspot',
        story: [
          'On the office network the robot’s video was instant. On a phone hotspot it would not connect at all.',
          'Some mobile carriers block UDP, so the two ends could not reach each other directly.',
          'The fix was a relay (TURN) for the cases where a direct path is not possible.',
        ],
      },
      { id: 'B2', title: 'Arm stops for good after a lost connection' },
    ],
    // A feature with `what` opens when clicked: one plain sentence, then any of why / part / tools.
    // The rest stay single lines, like on a real board (decided 19 Nov 2026).
    features: [
      {
        id: 'F1',
        title: 'Device logs as telemetry',
        what: 'The critical logs on each edge device are exposed live, so a problem can be debugged while it is happening, without anyone walking over to the device.',
      },
      {
        id: 'F2',
        title: 'The lab cell, simulated then real',
        what: 'A copy of the lab cell in Isaac Sim. Every automation runs there first, then the same flow runs on the real robot.',
        why: 'New flows are tried without risking glassware or real devices. The simulated devices talk to the platform exactly like the real ones.',
        part: 'I look after the project and have reviewed 65 of its pull requests.',
        tools: 'Isaac Sim, ROS 2 Jazzy',
      },
      {
        id: 'F3',
        title: 'Mapping and docking in simulation',
        what: 'A mobile robot maps a simulated warehouse, finds its way around it and docks to charge.',
        why: 'It docks to a printed marker and runs on Nav2, the approach I built on a real robot at Invento in 2020–22. Six years apart: real then, simulated now.',
        tools: 'Nav2, Isaac Sim, Gazebo',
      },
      { id: 'F4', title: 'Pick and place with an arm on wheels' },
    ],
    // said once, under Features, instead of on every one
    featuresNote: 'Built by the team. I set each task and reviewed it.',
    // "me" at the top of the tree opens this
    me: [
      'For the first ten months, most of the code in ALEX was mine, pushed straight in, most often around eight in the evening. There was hardly anyone to read it.',
      'In spring 2025 the team began to arrive, and that way of working had to end: every change now goes through review. By the autumn the team was writing more of ALEX than I was, and most of my week had become reading their work. The hardest part was handing over the interesting work and keeping the planning.',
    ],
    hint: ['Click', 'Tap', 'a bug, a feature or anyone on the tree to read more.'], // Click with a mouse, Tap on a touch screen
    // The board on the 2020 desk: blank but for three notes to himself, true of his first weeks at Invento
    // (Gautham, 19 Nov 2026). Plain marker, nothing to click.
    then: [{ text: 'set up Ubuntu', done: true }, { text: 'learn ROS' }, { text: 'what is SLAM?' }],
  },

  bin: {
    lead: 'Tried, and did not keep.',
    sheets: [
      // The WebRTC client is not here: it was upgraded for a reason, not dropped (Gautham, 22 Nov 2026).
      // Both sheets below were picked, and their wording confirmed, by Gautham on 22 Nov 2026.
      {
        title: 'Finding the dock in the lidar scan',
        body: [
          'Before the markers, we tried finding the charging dock by its shape in the lidar scan.',
          'We kept the printed markers the camera can see.',
        ],
      },
      {
        title: 'Wi-Fi over Bluetooth',
        body: [
          'In the robot’s iOS app I added a way to hand the robot its Wi-Fi details over Bluetooth.',
          'It was later taken out.',
        ],
      },
    ],
    note: 'More sheets to come.',
  },

  // Just a note on the monitor. Proverbs is written on it, small. Deuteronomy is a link only.
  note: {
    verse: {
      ref: 'Proverbs 3:5–6',
      version: 'NIV',
      // The text as Gautham gave it (15 Nov 2026). The translation is named beside it,
      // which its publisher asks for.
      lines: [
        'Trust in the Lord with all your heart',
        'and lean not on your own understanding;',
        'in all your ways submit to him,',
        'and he will make your paths straight.',
      ],
    },
    link: { ref: 'Deuteronomy 28:10', href: 'https://biblehub.com/deuteronomy/28-10.htm' },
  },

  time: {
    line: 'Curious about everything. I learned I can’t build it alone.',
    then: { year: '2020', caption: 'The same desk, earlier: one chair, one screen, a blank board, and more ideas than things.' },
    now: { year: 'now', caption: 'A second chair, a team on the board, a full shelf, and a robot getting on with its work.' },
  },
};
