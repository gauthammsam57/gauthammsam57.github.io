// Every word on the interactive page lives in this file (numbers shared with the CV page are in profile.js).
// Change the wording here, not in the code.
//
// Rules that apply to every line:
//  - Nothing about clients: no names, countries, cities, sites, industries.
//  - "We" for outcomes, "I" only for the specific part.
//  - Facts, not adjectives.

// Sources: words in a line that link to where it was said publicly. { text: the words, href }.
// The company founder's post on the 1,000 km (saved 17 Nov 2026; the post itself names the setting).
// His manager at Invento looking back at one of the arm and hand experiments of the Covid days (saved 17 Nov 2026).
const POST_ARM = { text: 'wrote about one of them', href: 'https://www.linkedin.com/posts/arvind-nagaraj-9a17aa82_every-time-i-see-a-robot-demo-these-days-ugcPost-7196602113890619393-RNfA/' };
// Gautham's own post on the robot that follows a person (saved 17 Nov 2026).
const POST_FOLLOW = { text: 'follows a person and responds to gestures', href: 'https://www.linkedin.com/posts/gautham-sam_activity-7176091428933009409-Ey6e' };
const POST_1000KM = { text: 'as the company announced', href: 'https://www.linkedin.com/posts/balajivi_the-mitra-robot-ran-1000km-autonomously-without-activity-7109705912373678080-DmRX' };

// Clip status. The published pages show only photos and cleared clips; every other clip stays listed
// here and shows in the preview as a striped box, ready for the day it is cleared.
// Clip status:
//   team    = filmed in-house at Invento (Mitra). Faces need each person's OK, or a blur.
//             Cleared (22 Nov 2026): a small copy in public/media/, no sound, no metadata; `local` is the archive original.
//   company = Neural Foundry material. Needs the company's agreement.
//   held    = never shown.
//   drawn   = no footage exists; the scene is drawn.
//   photo   = a photograph Neural Foundry has published on its own site. Needs no ask (Gautham, 21 Nov
//             2026): it is shown credited to the company, with a link to the page it is from. `img` is
//             a small copy in site/public/photos/, `alt` says what it shows, `from` names the page.
// `local` plays only on Gautham's own machine (dev server). It is never part of a build.
const NC = 'Navigation Collections/';

export const scenes = [
  {
    id: 'cell',
    nav: 'Now: the cell',
    kicker: 'Now',
    title: 'The cell',
    words: [
      'This is what I work on today.',
      'A robot arm on its own does very little. The work is getting ten different machines to act as one.',
    ],
    proof: [
      ['I was the first engineer on ALEX, the system that runs lab tasks with a robot arm. I wrote most of the first version; the team that joined took it to its first stable release with me.', 'Neural Foundry · 2024–26'],
      ['We brought around ten lab devices under robot control in a client’s lab: dispensers, balances, a pipette station, a homogenizer, pumps. Each one from embedded code up to the controller.', 'Neural Foundry · 2025–26'],
      ['I designed the two clients that connect any robot or device to URP, the company’s robotics platform. One config-driven command server now handles arms, mobile robots and cameras.', 'Neural Foundry · 2026'],
      ['We made device health visible: logs as telemetry, online and offline state, authenticated messaging.', 'Neural Foundry · 2026'],
      ['We moved the system to ROS 2 Jazzy and built a simulated twin of the cell, where the same automation runs before it touches hardware.', 'Neural Foundry · 2026'],
    ],
    thanks: 'the robotics team at Neural Foundry, the platform, AI and XR teams we build with, and the company that backed the work.',
    cta: 'Open a device',
    stories: [
      {
        title: 'The day the pH meter joined',
        body: [
          '5 September 2024, with a demo coming. The arm could already move and pour. That day we brought the pH meter into the cell.',
          'We tested the measurement on its own first, with the arm held still, then joined the two. The first commit went in at 11:28 and the twenty-first at 22:37. A little after eight in the evening, the robot read a pH value for the first time.',
        ],
        clips: [
          { title: 'The cell', status: 'photo', img: '/photos/urp-labs-cell.webp', alt: 'The lab cell seen from the front: a dark robot arm standing upright in its frame, a rack of glass beakers in front of it, lab devices on either side.', from: 'URP Labs', href: 'https://neuralfoundry.co.uk/products/urp-labs' },
          { title: 'At the beaker rack', status: 'photo', img: '/photos/urp-labs-rack.webp', alt: 'The arm’s gripper beside a black rack of beakers, one beaker of clear liquid in place, a stereo camera above the wrist.', from: 'URP Labs', href: 'https://neuralfoundry.co.uk/products/urp-labs' },
          { title: 'The whole cell running', status: 'company', note: 'Company demo film, 2 min 14 s.' },
          { title: 'The arm carrying a container to a station', status: 'company', note: 'Hand-held, January 2026.' },
          { title: 'The same flow in simulation and on the real robot', status: 'company', note: 'Recorded by a teammate.' },
        ],
      },
    ],
  },
  {
    id: 'arms',
    nav: 'Arms',
    kicker: 'Arms',
    title: 'Arms',
    words: [
      'Moving the arm is the easy part.',
      'Making it safe, repeatable, and able to carry on after something goes wrong is the job.',
    ],
    proof: [
      ['I built a multi-layer graph of safe points, searched with Dijkstra’s algorithm, so the arm always travels through known-safe positions.', 'Neural Foundry · 2025'],
      ['We made the arm recover from faults: runtime errors, a lost controller connection, resuming a task partway through.', 'Neural Foundry · 2025'],
      ['Small fixes merged upstream in MoveIt 2 and in Doosan’s official ROS 2 driver.', 'Open source · 2025–26'],
      ['For client projects I evaluate and select robots: collaborative arms, a SCARA, mobile robots from four vendors.', 'Neural Foundry · 2026'],
    ],
    thanks: 'the open-source ROS 2 and MoveIt communities, and teammates who collected safety points and tested on the real station.',
    cta: 'Open the arm',
    stories: [
      {
        title: 'Only through known-safe points',
        body: [
          'The arm does not plan a path through open space. It travels through a graph of positions that are known to be safe, arranged in layers.',
          'Teammates collected those points and tested them on the real station. My part was the graph and the search: Dijkstra’s algorithm picks the route.',
          'When something does go wrong (a runtime error, a lost connection to the controller) the task can resume partway, not from the start.',
        ],
        clips: [
          { title: 'The wrist camera and gripper, holding a beaker', status: 'photo', img: '/photos/urp-labs-wrist-camera.webp', alt: 'Close up of the arm’s wrist: a stereo camera mounted above a gripper that holds a glass beaker.', from: 'URP Labs', href: 'https://neuralfoundry.co.uk/products/urp-labs' },
          { title: 'What the arm sees from its wrist camera', status: 'company', note: 'December 2024.' },
          { title: 'Tool changes and stacked-luggage pick and place, in simulation', status: 'company', note: 'Recorded by a teammate.' },
        ],
      },
    ],
  },
  {
    id: 'wheels',
    nav: 'Wheels',
    kicker: 'Wheels',
    title: 'Wheels',
    words: [
      'Where I started, and where I spent four years:',
      'robots that find their own way around places where people live and work.',
    ],
    proof: [
      ['I inherited a ROS 1 navigation stack. With my team I rebuilt it and moved it to ROS 2, including path-tracking controllers I wrote (pure pursuit and Stanley).', 'Invento (Mitra) · 2020–22'],
      ['The robot went on to run 1,000 km autonomously without an incident, as the company announced.', 'Invento (Mitra) · 2023', POST_1000KM],
      ['I wrote autonomous docking using visual markers, so a robot could find and reach its charger alone, and trained teammates and customers to use it.', 'Invento (Mitra) · 2020–22'],
      ['We added fleet patrol, and mapped and deployed robots at customer sites. One of them I mapped without being there, by driving the robot remotely from another country.', 'Invento (Mitra) · 2023–24'],
      ['On the fleet web apps I worked on the takeover page (driving by gamepad and keyboard, chat, robot controls) and, in the later care portal, most of the live map after our founder started it.', 'Invento (Mitra) · 2022–24'],
      ['At Neural Foundry I designed the mobile-robot side of our ROS 2 client, and my team rebuilt mapping, navigation and docking in simulation.', 'Neural Foundry · 2026'],
    ],
    thanks: 'the Invento (Mitra) team, the people who built the stack I inherited, and Nav2.',
    cta: 'Open the robot',
    stories: [
      {
        title: 'From a hand-me-down stack to 1,000 km',
        body: [
          'The navigation stack came to me second-hand, written for ROS 1. ROS 1 was on its way out, so we had to move anyway.',
          'With the team I rebuilt it on ROS 2 and Nav2. With the standard controller the robot wobbled and cut corners, so I wrote our own to keep it on its path.',
          'The robot later ran 1,000 km autonomously without an incident, as the company announced.',
        ],
        links: [POST_1000KM],
        clips: [
          { title: 'Five or six robots moving at once', status: 'team', local: NC + 'all_robot_navigation.mp4', cleared: true, src: '/media/robots-moving.mp4' },
          { title: 'Through a narrow passage', status: 'team', local: NC + 'Narrow_Passage_1.mp4', cleared: true, src: '/media/narrow-passage.mp4' },
          { title: 'A person steps into its path', status: 'team', local: NC + 'Obstacle_Avoidance.blurred.mp4', cleared: true, src: '/media/person-steps-in.mp4' },
        ],
      },
      {
        title: 'Teaching a robot to dock itself',
        body: [
          'A robot that cannot reach its charger alone needs a person every few hours.',
          'We looked at three ways to find the dock: a known spot on the map, its shape in the lidar scan, and printed markers the camera can see. We settled on the markers.',
          'The hard part was the last few centimetres: lining up and backing on until the contacts touch. Then I taught teammates and customers how to set it up.',
        ],
        clips: [{ title: 'Docking, seen from the side', status: 'team', local: NC + 'Docking_1.mp4', cleared: true, src: '/media/docking-side.mp4' }],
      },
      {
        title: 'Mapping a building without being there',
        body: [
          'To map a building, someone usually walks the robot around it. This time the robot was in another country and none of us were.',
          'Over the years before, without planning for this, we had built the pieces: a way to reach a robot inside a site’s network, a way to drive it from afar, and a map that draws itself in the browser.',
          'Late at night in India, because of the time difference, I drove it with those and a remote desktop, and watched the map fill in. No one was on site: the building was step-free, so the robot went everywhere on its own.',
        ],
        clips: [{ title: 'The remote mapping recording', status: 'held', note: 'Not shown. It would give away a customer’s floor plan.' }],
      },
    ],
  },
  {
    id: 'remote',
    nav: 'Remote hands',
    kicker: 'Remote hands',
    title: 'Remote hands',
    words: [
      'I keep coming back to this:',
      'a person in one place, a robot in another, and as little delay between them as possible.',
    ],
    // RAVEN first: it is what the picture shows (Gautham, 19 Nov 2026)
    proof: [
      ['I designed the peer-to-peer link behind RAVEN, the company’s VR teleoperation. We tested it from Europe to India over an ordinary home connection, at about 100 ms.', 'Neural Foundry · 2024–'],
      ['I built joystick teleoperation for the fleet. The controller vibrates when the robot nears an obstacle, so the operator feels it.', 'Invento (Mitra) · 2022–23'],
      ['I built the WebSocket layer between robots and the care portal, tested to over 1,000 connections at once.', 'Invento (Mitra) · 2023–24'],
      ['I moved our robot camera streaming to WHIP and a media server. The robot used to keep a connection, and its own encoding, for every browser watching; now it sends one stream, which serves every viewer and can be recorded and monitored as it runs. With stereo camera support.', 'Neural Foundry · 2026'],
    ],
    thanks: 'the XR team who built RAVEN’s virtual side, and the platform team who run the streaming servers.',
    cta: 'Open the headset',
    stories: [
      {
        title: 'Picking up a pen from another continent',
        body: [
          'The test was small on purpose: pick up a marker pen, lay it down flat. A pen, because it shows straight away whether the grip and the release are right.',
          'We first ran it from a home connection in Europe, with the arm in India. Then, at an expo in Europe, our CEO, our CTO and visitors took turns in the headset.',
          'The delay was about 100 ms.',
        ],
        clips: [
          { title: 'RAVEN’s arm and gripper', status: 'photo', img: '/photos/raven-arm.webp', alt: 'A dark robot arm reaching across a white table with its gripper open; a VR headset lies on the table in front of it.', from: 'RAVEN', href: 'https://neuralfoundry.co.uk/products/raven' },
          { title: 'The arm, the headset and the controllers', status: 'photo', img: '/photos/raven-controller.webp', alt: 'Seen from above: the arm’s gripper beside a white VR headset and its two hand controllers.', note: 'There is no film of this test.', from: 'RAVEN', href: 'https://neuralfoundry.co.uk/products/raven' },
        ],
      },
    ],
  },
  {
    id: 'eyes',
    nav: 'Eyes',
    kicker: 'Eyes',
    title: 'Eyes',
    words: ['A robot is only as useful as what it knows about the world in front of it.'],
    proof: [
      ['I worked with the chief architect on the image and video pipelines behind Mitra AI, which let you search and question camera footage in plain language.', 'Invento (Mitra) · 2023–24'],
      ['We use visual markers so the arm can find equipment and containers without being told exact positions.', 'Neural Foundry · 2025–26'],
      ['Next: a vision-based quality inspection showcase, planned for 2027.', 'Neural Foundry'],
    ],
    thanks: 'the chief architect and AI team at Invento, and the AI team at Neural Foundry.',
    stories: [],
  },
  {
    id: 'people',
    nav: 'Robots for people',
    kicker: 'Robots for people',
    title: 'Robots for people',
    words: [
      'For four years the robots I worked on had one job:',
      'keeping older people company and getting them through the day.',
    ],
    proof: [
      ['We built a robot that follows a person and responds to gestures, using body and face tracking.', 'Invento (Mitra) · 2023', POST_FOLLOW],
      ['We built the daily flow: a sequence of news, music and exercise, where the order is set but the content is chosen from each person’s history and preferences.', 'Invento (Mitra) · 2023'],
      ['I built the recording tools for a public gesture dataset: 35 gestures from 39 people, 22 of them over 70.', 'Invento (Mitra) · 2023–24'],
      ['I built tools for a machine learning course: bots that answered students’ questions and ran quizzes.', 'Invento (Mitra) · 2023–24'],
    ],
    thanks: 'the whole Invento (Mitra) team, and the seniors who took part.',
    cta: 'Open the robot',
    stories: [
      {
        title: 'Following someone across a room',
        body: [
          'A team project. The robot tracks a person’s body and face, follows them, and stops when they sit down.',
          'The daily flow ran on the robot’s screen: some news, some music, a little exercise, one after the other.',
        ],
        clips: [
          { title: 'Crossing the office to a seated person', status: 'team', local: NC + 'pose_follower_merge.mp4', cleared: true, src: '/media/crossing-to-seated.mp4' },
          { title: 'Following a person until they sit', status: 'team', local: NC + 'people follower.mp4', cleared: true, src: '/media/following-person.mp4' },
          { title: 'The daily flow on the robot’s screen', status: 'team', local: NC + 'Media_Flow.blurred.mp4', cleared: true, src: '/media/daily-flow.mp4' },
        ],
      },
    ],
  },
  {
    id: 'humanoid',
    nav: 'Humanoids',
    kicker: 'Humanoids',
    title: 'Humanoids',
    words: ['I have built one arm of one, from the firmware up.', 'I have not worked on a whole one yet. It would be cool to.'],
    proof: [
      ['I prototyped the control system for a humanoid robot’s arm and hands: motor control, communication between boards, power measurement.', 'Invento (Mitra) · 2020–22'],
      ['We built the robot hardware that a research lab then used for brain-computer-interface work. The brain interface was theirs.', 'Invento (Mitra)'],
    ],
    thanks: 'the hardware team at Invento (Mitra).',
    cta: 'Open the humanoid',
    stories: [
      {
        title: 'One arm, from the firmware up',
        body: [
          'A prototype. The hardware team built the printed parts, motors and boards and handed them to me; I worked from the firmware up: Arduino boards talking to each other, and the control on top. It raised an arm and flexed a hand.',
          'The parts held up well. What broke, now and then, was a tension string in the hand.',
          'We ran a lot of experiments with it. My manager at the time later wrote about one of them.',
        ],
        links: [POST_ARM],
        clips: [
          { title: 'The arm moving', status: 'team', local: NC + 'Mitra Arm Control.mp4', cleared: true, src: '/media/arm-moving.mp4' },
          { title: 'A hand flexing', status: 'team', local: NC + 'humonoid hands control.mp4', cleared: true, src: '/media/hand-flexing.mp4' },
        ],
      },
    ],
  },
];

export const journey = {
  title: 'Journey',
  rows: [
    ['2016–2020', 'CSI College of Engineering (Anna University)', 'B.E. Mechanical Engineering. Built a gesture-controlled wheelchair; a paper on it was published. Two robotics internships.'],
    ['2020', 'Invento Robotics (Mitra Robot), Bangalore', 'Intern: robot model, simulation, test procedures for navigation.'],
    ['2020–2022', 'Invento Robotics (Mitra Robot)', 'Software Engineer: navigation, docking, humanoid arm, fleet web app.'],
    ['2023–2024', 'Invento Robotics (Mitra Robot)', 'Senior Software Engineer: teleoperation, communications, AI pipelines, deployments.'],
    ['2024–now', 'Neural Foundry, Hyderabad', 'First robotics engineer; now Robotics Lead with a team of six.'],
  ],
  // The commit chart is on the CV page only (Gautham, 17 Nov 2026).
};

export const off = {
  title: 'Off the floor',
  // (A former colleague's recommendation was quoted here; dropped 19 Nov 2026 by Gautham: facts, not praise.)
  words: 'When I’m not with robots: travelling, sport, and a camera.',
  places: ['Gulmarg', 'Gandikota', 'Ooty', 'Kerala', 'Ketti Valley', 'Riyadh'],
};

export const thanks = {
  title: 'None of this was mine alone.',
  items: [
    'The Invento (Mitra) team, and the people who built the stack I inherited there.',
    'The robotics team at Neural Foundry.',
    'The AI, XR and platform teams we build with.',
    'The open-source projects underneath all of it: ROS 2, Nav2, MoveIt.',
  ],
  // Teams only, no names (Gautham, 19 Nov 2026). A `note` line under the list is shown if one is added.
};

export const contact = {
  title: 'Working on something with robots?',
  sub: 'I’d like to hear about it.',
};
