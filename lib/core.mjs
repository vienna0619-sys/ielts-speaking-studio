const CREATED_AT = "2026-07-18T00:00:00.000Z";

export const EXAM_STATES = [
  "SETUP",
  "INTRODUCTION",
  "PART1",
  "PART2_INSTRUCTIONS",
  "PART2_PREPARATION",
  "PART2_SPEAKING",
  "PART2_FOLLOW_UP",
  "PART3",
  "FINISHED",
  "ANALYSING",
  "RESULTS",
];

export const INTRODUCTION_QUESTIONS = [
  "Good morning. My name is Alex Morgan. Can you tell me your full name, please?",
  "And what should I call you?",
  "Can I see your identification, please? You do not need to upload anything; just confirm that you have it with you.",
  "Thank you. This speaking test is being recorded. Now, in the first part, I'd like to ask you some questions about yourself.",
];

export const EXAMINER_VOICE_PRESETS = [
  {
    id: "gb-female",
    label: "British English · female",
    accent: "en-GB",
    locale: "en-GB",
    genderPresentation: "female",
    speakingRate: 0.98,
    pitch: 1,
    volume: 1,
    qualityLevel: "high",
    enabled: true,
    supportedModes: ["mock-exam", "practice"],
    fallbackVoiceId: "gb-male",
    baseWeight: 15,
  },
  {
    id: "gb-male",
    label: "British English · male",
    accent: "en-GB",
    locale: "en-GB",
    genderPresentation: "male",
    speakingRate: 0.98,
    pitch: 1,
    volume: 1,
    qualityLevel: "high",
    enabled: true,
    supportedModes: ["mock-exam", "practice"],
    fallbackVoiceId: "gb-female",
    baseWeight: 15,
  },
  {
    id: "us-female",
    label: "North American English · female",
    accent: "en-US",
    locale: "en-US",
    genderPresentation: "female",
    speakingRate: 0.99,
    pitch: 1,
    volume: 1,
    qualityLevel: "high",
    enabled: true,
    supportedModes: ["mock-exam", "practice"],
    fallbackVoiceId: "us-male",
    baseWeight: 12.5,
  },
  {
    id: "us-male",
    label: "North American English · male",
    accent: "en-US",
    locale: "en-US",
    genderPresentation: "male",
    speakingRate: 0.99,
    pitch: 1,
    volume: 1,
    qualityLevel: "high",
    enabled: true,
    supportedModes: ["mock-exam", "practice"],
    fallbackVoiceId: "us-female",
    baseWeight: 12.5,
  },
  {
    id: "au-female",
    label: "Australian English · female",
    accent: "en-AU",
    locale: "en-AU",
    genderPresentation: "female",
    speakingRate: 0.98,
    pitch: 1,
    volume: 1,
    qualityLevel: "high",
    enabled: true,
    supportedModes: ["mock-exam", "practice"],
    fallbackVoiceId: "au-male",
    baseWeight: 10,
  },
  {
    id: "au-male",
    label: "Australian English · male",
    accent: "en-AU",
    locale: "en-AU",
    genderPresentation: "male",
    speakingRate: 0.98,
    pitch: 1,
    volume: 1,
    qualityLevel: "high",
    enabled: true,
    supportedModes: ["mock-exam", "practice"],
    fallbackVoiceId: "au-female",
    baseWeight: 10,
  },
  {
    id: "in-female",
    label: "Indian English · female",
    accent: "en-IN",
    locale: "en-IN",
    genderPresentation: "female",
    speakingRate: 0.97,
    pitch: 1,
    volume: 1,
    qualityLevel: "high",
    enabled: true,
    supportedModes: ["mock-exam", "practice"],
    fallbackVoiceId: "in-male",
    baseWeight: 7.5,
  },
  {
    id: "in-male",
    label: "Indian English · male",
    accent: "en-IN",
    locale: "en-IN",
    genderPresentation: "male",
    speakingRate: 0.97,
    pitch: 1,
    volume: 1,
    qualityLevel: "high",
    enabled: true,
    supportedModes: ["mock-exam", "practice"],
    fallbackVoiceId: "in-female",
    baseWeight: 7.5,
  },
];

export const EXAMINER_AVATARS = [
  {
    id: "avery",
    displayName: "Examiner Avery",
    appearanceProfile: "soft-bob",
    genderPresentation: "female",
    estimatedAgeRange: "35–48",
    enabled: true,
  },
  {
    id: "maya",
    displayName: "Examiner Maya",
    appearanceProfile: "natural-curls",
    genderPresentation: "female",
    estimatedAgeRange: "38–52",
    enabled: true,
  },
  {
    id: "lin",
    displayName: "Examiner Lin",
    appearanceProfile: "neat-crop",
    genderPresentation: "female",
    estimatedAgeRange: "36–50",
    enabled: true,
  },
  {
    id: "rowan",
    displayName: "Examiner Rowan",
    appearanceProfile: "side-part",
    genderPresentation: "male",
    estimatedAgeRange: "40–55",
    enabled: true,
  },
  {
    id: "jordan",
    displayName: "Examiner Jordan",
    appearanceProfile: "short-curls",
    genderPresentation: "male",
    estimatedAgeRange: "34–48",
    enabled: true,
  },
  {
    id: "sam",
    displayName: "Examiner Sam",
    appearanceProfile: "silver-crop",
    genderPresentation: "male",
    estimatedAgeRange: "45–60",
    enabled: true,
  },
];

const makeQuestion = (
  id,
  mainTopic,
  question,
  difficulty = "standard",
  subTopic = mainTopic,
) => ({
  id,
  part: 1,
  mainTopic,
  subTopic,
  question,
  difficulty,
  followUpRules: [
    "Ask one brief clarification only when the answer is too short.",
  ],
  relatedPart2Topic: null,
  relatedPart3Themes: [],
  sourceType: "original-simulation",
  createdAt: CREATED_AT,
  lastUsedAt: null,
  useCount: 0,
});

export const PART1_TOPICS = [
  {
    id: "p1-studies",
    topic: "studies",
    label: "学习",
    questions: [
      makeQuestion(
        "p1-studies-1",
        "studies",
        "Do you work or are you a student?",
      ),
      makeQuestion(
        "p1-studies-2",
        "studies",
        "What do you enjoy most about your studies?",
      ),
      makeQuestion(
        "p1-studies-3",
        "studies",
        "Is there anything you would like to change about the way you study?",
      ),
      makeQuestion(
        "p1-studies-4",
        "studies",
        "What would you like to learn in the future?",
      ),
    ],
  },
  {
    id: "p1-hometown",
    topic: "hometown",
    label: "家乡",
    questions: [
      makeQuestion("p1-hometown-1", "hometown", "Where is your hometown?"),
      makeQuestion(
        "p1-hometown-2",
        "hometown",
        "What do you like most about your hometown?",
      ),
      makeQuestion(
        "p1-hometown-3",
        "hometown",
        "Has your hometown changed much in recent years?",
      ),
      makeQuestion(
        "p1-hometown-4",
        "hometown",
        "Would you like to live there in the future?",
      ),
    ],
  },
  {
    id: "p1-weekends",
    topic: "weekends",
    label: "周末",
    questions: [
      makeQuestion(
        "p1-weekends-1",
        "weekends",
        "What do you usually do at weekends?",
      ),
      makeQuestion(
        "p1-weekends-2",
        "weekends",
        "Do you prefer busy or quiet weekends?",
      ),
      makeQuestion(
        "p1-weekends-3",
        "weekends",
        "How are your weekends different from when you were younger?",
      ),
      makeQuestion(
        "p1-weekends-4",
        "weekends",
        "Is there something new you would like to try at a weekend?",
      ),
    ],
  },
  {
    id: "p1-reading",
    topic: "reading",
    label: "阅读",
    questions: [
      makeQuestion("p1-reading-1", "reading", "How often do you read?"),
      makeQuestion(
        "p1-reading-2",
        "reading",
        "What kind of things do you enjoy reading?",
      ),
      makeQuestion(
        "p1-reading-3",
        "reading",
        "Do you prefer reading on paper or on a screen?",
      ),
      makeQuestion(
        "p1-reading-4",
        "reading",
        "Did you read more when you were a child?",
      ),
    ],
  },
  {
    id: "p1-technology",
    topic: "technology",
    label: "科技",
    questions: [
      makeQuestion(
        "p1-technology-1",
        "technology",
        "What piece of technology do you use most often?",
      ),
      makeQuestion(
        "p1-technology-2",
        "technology",
        "Does technology make your daily life easier?",
      ),
      makeQuestion(
        "p1-technology-3",
        "technology",
        "Is there any technology you find difficult to use?",
      ),
      makeQuestion(
        "p1-technology-4",
        "technology",
        "What technology would you like to own in the future?",
      ),
    ],
  },
  {
    id: "p1-music",
    topic: "music",
    label: "音乐",
    questions: [
      makeQuestion(
        "p1-music-1",
        "music",
        "What kind of music do you like listening to?",
      ),
      makeQuestion(
        "p1-music-2",
        "music",
        "When do you usually listen to music?",
      ),
      makeQuestion(
        "p1-music-3",
        "music",
        "Has your taste in music changed over time?",
      ),
      makeQuestion(
        "p1-music-4",
        "music",
        "Would you like to learn a musical instrument?",
      ),
    ],
  },
  {
    id: "p1-transport",
    topic: "transport",
    label: "交通",
    questions: [
      makeQuestion(
        "p1-transport-1",
        "transport",
        "How do you usually travel around your town or city?",
      ),
      makeQuestion(
        "p1-transport-2",
        "transport",
        "What is your favourite form of transport?",
      ),
      makeQuestion(
        "p1-transport-3",
        "transport",
        "Is public transport convenient where you live?",
      ),
      makeQuestion(
        "p1-transport-4",
        "transport",
        "How might transport change in the future?",
      ),
    ],
  },
  {
    id: "p1-food",
    topic: "food",
    label: "食物",
    questions: [
      makeQuestion(
        "p1-food-1",
        "food",
        "What kind of food do you enjoy eating?",
      ),
      makeQuestion("p1-food-2", "food", "Do you often cook for yourself?"),
      makeQuestion(
        "p1-food-3",
        "food",
        "Is there a food you disliked as a child but enjoy now?",
      ),
      makeQuestion(
        "p1-food-4",
        "food",
        "When do people in your family usually eat together?",
      ),
    ],
  },
];

const makePart3 = (
  id,
  part2Id,
  mainTopic,
  question,
  difficulty = "standard",
) => ({
  id,
  part: 3,
  mainTopic,
  subTopic: mainTopic,
  question,
  difficulty,
  followUpRules: ["Why do you think that is?", "Can you give an example?"],
  relatedPart2Topic: part2Id,
  relatedPart3Themes: [mainTopic],
  sourceType: "original-simulation",
  createdAt: CREATED_AT,
  lastUsedAt: null,
  useCount: 0,
});

export const PART2_SETS = [
  {
    id: "p2-useful-object",
    part: 2,
    mainTopic: "useful objects",
    subTopic: "everyday design",
    title: "Describe a useful object that you use regularly.",
    bullets: [
      "what the object is",
      "when you first got it",
      "how you use it",
      "why it is useful to you",
    ],
    explain: "and explain how your life would be different without it.",
    closingQuestions: [
      "Would you recommend this object to other people?",
      "Do you think you will still use it in the future?",
    ],
    relatedPart3Themes: ["design", "consumer choices", "technology"],
    difficulty: "standard",
    sourceType: "original-simulation",
    createdAt: CREATED_AT,
    lastUsedAt: null,
    useCount: 0,
    part3Questions: [
      makePart3(
        "p3-object-1",
        "p2-useful-object",
        "design",
        "Why are some everyday products easier to use than others?",
      ),
      makePart3(
        "p3-object-2",
        "p2-useful-object",
        "consumer choices",
        "How much does advertising influence the things people buy?",
      ),
      makePart3(
        "p3-object-3",
        "p2-useful-object",
        "technology",
        "Do people replace useful objects too quickly nowadays?",
      ),
      makePart3(
        "p3-object-4",
        "p2-useful-object",
        "technology",
        "How might everyday objects change in the future?",
      ),
    ],
  },
  {
    id: "p2-new-skill",
    part: 2,
    mainTopic: "learning a skill",
    subTopic: "learning outside school",
    title: "Describe a useful skill you learned outside school.",
    bullets: [
      "what the skill is",
      "who or what helped you learn it",
      "how long it took to learn",
      "how you use this skill",
    ],
    explain: "and explain why learning this skill was important to you.",
    closingQuestions: [
      "Would you like to teach this skill to someone else?",
      "Is there another skill you would like to learn?",
    ],
    relatedPart3Themes: ["education", "practical skills", "lifelong learning"],
    difficulty: "standard",
    sourceType: "original-simulation",
    createdAt: CREATED_AT,
    lastUsedAt: null,
    useCount: 0,
    part3Questions: [
      makePart3(
        "p3-skill-1",
        "p2-new-skill",
        "education",
        "Which practical skills should schools teach more often?",
      ),
      makePart3(
        "p3-skill-2",
        "p2-new-skill",
        "lifelong learning",
        "Why do some adults stop learning new things?",
      ),
      makePart3(
        "p3-skill-3",
        "p2-new-skill",
        "technology",
        "Has technology made it easier to learn independently?",
      ),
      makePart3(
        "p3-skill-4",
        "p2-new-skill",
        "education",
        "Should employers help workers learn new skills?",
      ),
    ],
  },
  {
    id: "p2-public-place",
    part: 2,
    mainTopic: "public places",
    subTopic: "community spaces",
    title:
      "Describe a public place in your town or city that you enjoy visiting.",
    bullets: [
      "where it is",
      "what it looks like",
      "what people do there",
      "when you usually visit it",
    ],
    explain: "and explain why this place is important to the community.",
    closingQuestions: [
      "Would you change anything about this place?",
      "Do you think more people will visit it in the future?",
    ],
    relatedPart3Themes: ["cities", "community", "public space"],
    difficulty: "standard",
    sourceType: "original-simulation",
    createdAt: CREATED_AT,
    lastUsedAt: null,
    useCount: 0,
    part3Questions: [
      makePart3(
        "p3-place-1",
        "p2-public-place",
        "public space",
        "What makes a public place attractive to different age groups?",
      ),
      makePart3(
        "p3-place-2",
        "p2-public-place",
        "cities",
        "Should cities spend more money on parks or on transport?",
      ),
      makePart3(
        "p3-place-3",
        "p2-public-place",
        "community",
        "How can public spaces help people feel part of a community?",
      ),
      makePart3(
        "p3-place-4",
        "p2-public-place",
        "cities",
        "Will people use public spaces differently in the future?",
      ),
    ],
  },
  {
    id: "p2-journey",
    part: 2,
    mainTopic: "journeys",
    subTopic: "memorable travel",
    title: "Describe a journey that you remember well.",
    bullets: [
      "where you went",
      "how you travelled",
      "who you travelled with",
      "what happened during the journey",
    ],
    explain: "and explain why this journey was memorable.",
    closingQuestions: [
      "Would you like to make the same journey again?",
      "Do you usually enjoy long journeys?",
    ],
    relatedPart3Themes: ["travel", "transport", "tourism"],
    difficulty: "standard",
    sourceType: "original-simulation",
    createdAt: CREATED_AT,
    lastUsedAt: null,
    useCount: 0,
    part3Questions: [
      makePart3(
        "p3-journey-1",
        "p2-journey",
        "transport",
        "Why do some people enjoy the journey as much as the destination?",
      ),
      makePart3(
        "p3-journey-2",
        "p2-journey",
        "tourism",
        "What are the disadvantages of increased tourism?",
      ),
      makePart3(
        "p3-journey-3",
        "p2-journey",
        "travel",
        "How is travel different for younger and older people?",
      ),
      makePart3(
        "p3-journey-4",
        "p2-journey",
        "transport",
        "How might long-distance travel change in the future?",
      ),
    ],
  },
  {
    id: "p2-helpful-person",
    part: 2,
    mainTopic: "helpful people",
    subTopic: "guidance",
    title: "Describe a person who gave you useful advice.",
    bullets: [
      "who the person is",
      "when they gave you the advice",
      "what the advice was",
      "what you did afterwards",
    ],
    explain: "and explain why the advice was useful to you.",
    closingQuestions: [
      "Do you still ask this person for advice?",
      "Are you good at giving advice to others?",
    ],
    relatedPart3Themes: ["mentoring", "role models", "education"],
    difficulty: "standard",
    sourceType: "original-simulation",
    createdAt: CREATED_AT,
    lastUsedAt: null,
    useCount: 0,
    part3Questions: [
      makePart3(
        "p3-advice-1",
        "p2-helpful-person",
        "mentoring",
        "Why do young people sometimes prefer advice from friends rather than family?",
      ),
      makePart3(
        "p3-advice-2",
        "p2-helpful-person",
        "role models",
        "What qualities make someone a good role model?",
      ),
      makePart3(
        "p3-advice-3",
        "p2-helpful-person",
        "technology",
        "Has the internet changed where people look for advice?",
      ),
      makePart3(
        "p3-advice-4",
        "p2-helpful-person",
        "education",
        "Should schools provide more guidance about future careers?",
      ),
    ],
  },
];

const TRANSITIONS = {
  SETUP: { START: "INTRODUCTION" },
  INTRODUCTION: { INTRO_COMPLETE: "PART1" },
  PART1: { PART1_COMPLETE: "PART2_INSTRUCTIONS" },
  PART2_INSTRUCTIONS: { INSTRUCTIONS_COMPLETE: "PART2_PREPARATION" },
  PART2_PREPARATION: { PREPARATION_COMPLETE: "PART2_SPEAKING" },
  PART2_SPEAKING: { SPEAKING_COMPLETE: "PART2_FOLLOW_UP" },
  PART2_FOLLOW_UP: { FOLLOW_UP_COMPLETE: "PART3" },
  PART3: { PART3_COMPLETE: "FINISHED" },
  FINISHED: { ANALYSE: "ANALYSING" },
  ANALYSING: { ANALYSIS_COMPLETE: "RESULTS" },
  RESULTS: { RESET: "SETUP" },
};

export function transitionExam(state, event) {
  const next = TRANSITIONS[state]?.[event];
  if (!next) throw new Error(`Invalid exam transition: ${state} -> ${event}`);
  return next;
}

function hashSeed(value) {
  let hash = 2166136261;
  for (const char of String(value)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed) {
  let current = hashSeed(seed) || 1;
  return () => {
    current += 0x6d2b79f5;
    let t = current;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled(items, random) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function weightedPick(items, getWeight, random) {
  const weighted = items.map((item) => ({
    item,
    weight: Math.max(0, Number(getWeight(item)) || 0),
  }));
  const total = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  if (!weighted.length) return null;
  if (total <= 0)
    return (
      weighted[Math.floor(random() * weighted.length)]?.item ?? weighted[0].item
    );
  let cursor = random() * total;
  for (const entry of weighted) {
    cursor -= entry.weight;
    if (cursor <= 0) return entry.item;
  }
  return weighted.at(-1).item;
}

const ACCENTS_BY_MODE = {
  all: ["en-GB", "en-US", "en-AU", "en-IN"],
  familiar: ["en-GB", "en-US"],
  british: ["en-GB"],
};

export function createExaminerProfile({
  seed = Date.now(),
  availableVoiceIds = [],
  recentProfileIds = [],
  recentAccents = [],
  randomEnabled = true,
  accentMode = "all",
  fixedVoiceId = "gb-female",
  excludedAccents = [],
  forcedAccent = null,
  avoidAccent = null,
} = {}) {
  const random = seededRandom(`examiner:${seed}`);
  const available = new Set(availableVoiceIds);
  const enabledVoices = EXAMINER_VOICE_PRESETS.filter(
    (voice) => voice.enabled && voice.qualityLevel === "high",
  );
  let deviceVoices = available.size
    ? enabledVoices.filter((voice) => available.has(voice.id))
    : enabledVoices;
  if (!deviceVoices.length)
    deviceVoices = enabledVoices.filter((voice) => voice.accent === "en-GB");

  const modeAccents = forcedAccent
    ? [forcedAccent]
    : ACCENTS_BY_MODE[accentMode] || ACCENTS_BY_MODE.all;
  const excluded = new Set(excludedAccents);
  let voicePool = deviceVoices.filter(
    (voice) =>
      modeAccents.includes(voice.accent) &&
      !excluded.has(voice.accent) &&
      voice.accent !== avoidAccent,
  );
  if (!voicePool.length)
    voicePool = deviceVoices.filter(
      (voice) => voice.accent === "en-GB" && !excluded.has(voice.accent),
    );
  if (!voicePool.length) voicePool = deviceVoices;

  let voice;
  if (!randomEnabled) {
    const requested =
      enabledVoices.find((candidate) => candidate.id === fixedVoiceId) ||
      enabledVoices[0];
    voice =
      voicePool.find((candidate) => candidate.id === requested.id) ||
      voicePool.find(
        (candidate) =>
          candidate.accent === requested.accent &&
          candidate.genderPresentation === requested.genderPresentation,
      ) ||
      voicePool.find((candidate) => candidate.accent === requested.accent) ||
      voicePool.find(
        (candidate) =>
          candidate.accent === "en-GB" &&
          candidate.genderPresentation === requested.genderPresentation,
      ) ||
      voicePool[0];
  } else {
    voice =
      weightedPick(
        voicePool,
        (candidate) => {
          const mostRecentAccent = recentAccents[0];
          if (candidate.accent === mostRecentAccent)
            return candidate.baseWeight * 0.28;
          if (recentAccents.slice(0, 3).includes(candidate.accent))
            return candidate.baseWeight * 0.62;
          return candidate.baseWeight;
        },
        random,
      ) || voicePool[0];
  }

  const avatarPool = EXAMINER_AVATARS.filter(
    (avatar) =>
      avatar.enabled && avatar.genderPresentation === voice.genderPresentation,
  );
  const recent = new Set(recentProfileIds.slice(0, 3));
  const avatar =
    weightedPick(
      avatarPool,
      (candidate) => (recent.has(`${candidate.id}--${voice.id}`) ? 0.08 : 1),
      random,
    ) ||
    avatarPool[0] ||
    EXAMINER_AVATARS[0];
  const profileId = `${avatar.id}--${voice.id}`;
  return {
    id: profileId,
    sessionId: `examiner-${hashSeed(`${seed}:${profileId}`).toString(36)}`,
    displayName: avatar.displayName,
    avatarId: avatar.id,
    appearanceProfile: avatar.appearanceProfile,
    voiceProvider: "adaptive",
    voiceId: voice.id,
    accent: voice.accent,
    locale: voice.locale,
    genderPresentation: avatar.genderPresentation,
    estimatedAgeRange: avatar.estimatedAgeRange,
    speakingRate: voice.speakingRate,
    pitch: voice.pitch,
    volume: voice.volume,
    qualityLevel: voice.qualityLevel,
    enabled: true,
    supportedModes: [...voice.supportedModes],
    fallbackVoiceId: voice.fallbackVoiceId,
    createdAt: new Date().toISOString(),
  };
}

export function createExamPlan({
  seed = Date.now(),
  recentTopicIds = [],
} = {}) {
  const random = seededRandom(seed);
  const recent = new Set(recentTopicIds);
  const availableP1 = PART1_TOPICS.filter((topic) => !recent.has(topic.id));
  const p1Pool = availableP1.length >= 2 ? availableP1 : PART1_TOPICS;
  const part1 = shuffled(p1Pool, random)
    .slice(0, 2)
    .map((topic) => ({
      ...topic,
      questions: shuffled(topic.questions, random).slice(0, 3),
    }));
  const availableP2 = PART2_SETS.filter((topic) => !recent.has(topic.id));
  const p2Pool = availableP2.length ? availableP2 : PART2_SETS;
  const part2 = shuffled(p2Pool, random)[0];
  const part3 = shuffled(part2.part3Questions, random).slice(0, 4);
  return {
    comboId: `exam-${hashSeed(`${seed}-${part1.map((t) => t.id).join("-")}-${part2.id}`).toString(36)}`,
    createdAt: new Date().toISOString(),
    part1,
    part2,
    part3,
  };
}

export function formatTime(totalSeconds) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

export function nextCountdown(seconds) {
  return Math.max(0, Math.floor(Number(seconds) || 0) - 1);
}

export function timerReachedLimit(elapsedSeconds, limitSeconds) {
  return (
    Math.max(0, Number(elapsedSeconds) || 0) >=
    Math.max(0, Number(limitSeconds) || 0)
  );
}

export function calculateSpeechMetrics(segments = []) {
  const allText = segments
    .map((segment) => segment.text || "")
    .join(" ")
    .trim();
  const words = allText.toLowerCase().match(/[a-z]+(?:'[a-z]+)?/g) || [];
  const totalSpeakingSeconds = segments.reduce(
    (sum, segment) => sum + Math.max(0, Number(segment.durationSec) || 0),
    0,
  );
  const uniqueWords = new Set(words);
  const fillerPattern =
    /\b(um|uh|erm|like|you know|i mean|sort of|kind of)\b/gi;
  const fillers =
    allText.match(fillerPattern)?.map((item) => item.toLowerCase()) || [];
  const selfCorrections = (
    allText.match(
      /\b(i mean|rather|sorry|let me rephrase|what i mean is)\b/gi,
    ) || []
  ).length;
  const longPauses = segments.reduce(
    (sum, segment) => sum + (segment.longPauses || 0),
    0,
  );
  const frequency = new Map();
  for (const word of words.filter((word) => word.length > 3))
    frequency.set(word, (frequency.get(word) || 0) + 1);
  const repeatedWords = [...frequency.entries()]
    .filter(([, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word, count]) => ({ word, count }));
  const part2SpeakingSeconds = segments
    .filter((segment) => segment.part === 2)
    .reduce(
      (sum, segment) => sum + Math.max(0, Number(segment.durationSec) || 0),
      0,
    );
  return {
    wordCount: words.length,
    totalSpeakingSeconds: Math.round(totalSpeakingSeconds),
    wordsPerMinute:
      totalSpeakingSeconds > 0
        ? Math.round((words.length / totalSpeakingSeconds) * 60)
        : 0,
    averageAnswerWords: segments.length
      ? Math.round(words.length / segments.length)
      : 0,
    longPauses,
    fillers: [...new Set(fillers)].map((word) => ({
      word,
      count: fillers.filter((item) => item === word).length,
    })),
    fillerCount: fillers.length,
    repeatedWords,
    selfCorrections,
    part2SpeakingSeconds: Math.round(part2SpeakingSeconds),
    lexicalDiversity: words.length
      ? Math.round((uniqueWords.size / words.length) * 100)
      : 0,
  };
}

const clampBand = (value) =>
  Math.max(1, Math.min(9, Math.round(value * 2) / 2));

export function estimateMockScores(metrics) {
  const hasSpeech = metrics.totalSpeakingSeconds > 0;
  const fluency = clampBand(
    hasSpeech
      ? 4.5 +
          Math.min(1.5, metrics.wordCount / 220) +
          (metrics.wordsPerMinute >= 90 && metrics.wordsPerMinute <= 170
            ? 0.5
            : 0) -
          Math.min(0.5, metrics.longPauses / 12)
      : 4,
  );
  const lexical = clampBand(
    hasSpeech
      ? 4.5 +
          Math.min(1.5, metrics.lexicalDiversity / 55) +
          Math.min(0.5, metrics.wordCount / 500)
      : 4,
  );
  const grammar = clampBand(
    hasSpeech
      ? 4.5 +
          Math.min(1.5, metrics.averageAnswerWords / 35) +
          Math.min(0.5, metrics.selfCorrections / 5)
      : 4,
  );
  const pronunciation = clampBand(
    hasSpeech
      ? 5 +
          (metrics.wordsPerMinute >= 75 && metrics.wordsPerMinute <= 185
            ? 0.5
            : 0)
      : 4,
  );
  const dimensions = [
    {
      key: "fluency",
      label: "Fluency and Coherence",
      band: fluency,
      confidence: hasSpeech ? "medium" : "low",
      explanation: "根据回答长度、语速、停顿与话题展开情况作保守估算。",
      evidence: [
        `语速约 ${metrics.wordsPerMinute} 词/分钟`,
        `检测到 ${metrics.longPauses} 次较长停顿`,
      ],
      priority: "用观点—原因—例子的自然链条持续展开，减少无信息停顿。",
    },
    {
      key: "lexical",
      label: "Lexical Resource",
      band: lexical,
      confidence: metrics.wordCount >= 80 ? "medium" : "low",
      explanation: "根据词汇范围、重复词与语境中的表达变化作估算。",
      evidence: [
        `不同词汇比例约 ${metrics.lexicalDiversity}%`,
        `总词数 ${metrics.wordCount}`,
      ],
      priority: "围绕常见主题积累可主动使用的搭配，而不是孤立背诵难词。",
    },
    {
      key: "grammar",
      label: "Grammatical Range and Accuracy",
      band: grammar,
      confidence: metrics.wordCount >= 80 ? "medium" : "low",
      explanation:
        "Mock 模式只能从浏览器转写中观察句子长度与自我修正，不能替代逐句人工判断。",
      evidence: [
        `平均每个回答约 ${metrics.averageAnswerWords} 词`,
        `自我修正约 ${metrics.selfCorrections} 次`,
      ],
      priority:
        "稳定使用过去、现在和将来时，并把从句控制在自己能准确完成的范围内。",
    },
    {
      key: "pronunciation",
      label: "Pronunciation",
      band: pronunciation,
      confidence: "low",
      explanation:
        "Mock 模式没有声学发音模型，只参考可转写度、语速和停顿；具体音素判断均为低置信度。",
      evidence: [
        "未进行音素级分析",
        `浏览器记录到约 ${metrics.totalSpeakingSeconds} 秒语音`,
      ],
      priority: "优先练习句子重音、意群停顿和结尾音清晰度，并用录音回听验证。",
    },
  ].map((item) => ({
    ...item,
    range: [Math.max(1, item.band - 0.5), Math.min(9, item.band + 0.5)],
  }));
  const overall = clampBand(
    dimensions.reduce((sum, item) => sum + item.band, 0) / 4,
  );
  return {
    overall,
    range: [Math.max(1, overall - 0.5), Math.min(9, overall + 0.5)],
    dimensions,
    mode: "mock",
    generatedAt: new Date().toISOString(),
  };
}

export function buildPracticeFeedback(text = "", durationSec = 0, part = 1) {
  const words = text.trim().match(/[A-Za-z]+(?:'[A-Za-z]+)?/g) || [];
  const target = part === 1 ? 25 : part === 2 ? 110 : 45;
  const tooShort = words.length < target * 0.55;
  const hasReason = /\b(because|since|the reason|that's why)\b/i.test(text);
  const hasExample = /\b(for example|for instance|such as)\b/i.test(text);
  const band = clampBand(
    4.5 +
      Math.min(1.5, words.length / target) +
      (hasReason ? 0.5 : 0) +
      (hasExample ? 0.5 : 0),
  );
  return {
    band,
    tooShort,
    wordCount: words.length,
    durationSec,
    strengths: [
      hasReason ? "给出了原因" : "表达了基本观点",
      hasExample ? "使用了例子" : "回答与题目相关",
    ],
    focus: tooShort
      ? "回答偏短；补充一个原因和一个具体例子。"
      : hasExample
        ? "继续提高连接词的自然度。"
        : "加入一个具体例子，让观点更有支撑。",
    naturalExpression: hasReason
      ? "One reason I feel this way is that..."
      : "I’d say... mainly because...",
    improvedAnswer: text.trim()
      ? `${text.trim()} ${hasExample ? "That is why it matters to me." : "For example, I can think of a recent situation that clearly shows this."}`
      : "Try answering with a clear opinion, one reason, and a brief real example.",
  };
}

export function movingAverage(values, windowSize = 3) {
  return values.map((_, index) => {
    const start = Math.max(0, index - windowSize + 1);
    const slice = values.slice(start, index + 1);
    return (
      Math.round(
        (slice.reduce((sum, value) => sum + value, 0) / slice.length) * 100,
      ) / 100
    );
  });
}

export function prependHistoryRecord(records, record, limit = 50) {
  return [record, ...records.filter((item) => item.id !== record.id)].slice(
    0,
    limit,
  );
}

export function providerErrorStatus(status) {
  if (status === 401 || status === 403)
    return "AI 服务认证失败，请检查服务端 API 密钥。";
  if (status === 402 || status === 429)
    return "AI 服务额度不足或请求过于频繁，请稍后重试或切换 Mock 模式。";
  if (status >= 500) return "AI 服务暂时不可用，当前内容已保留，请稍后重试。";
  return "AI 服务请求失败，当前内容已保留。";
}

export function microphoneErrorMessage(name) {
  const messages = {
    NotAllowedError:
      "麦克风权限被拒绝。请在 Chrome 地址栏左侧的网站设置中允许麦克风。",
    NotFoundError: "没有找到可用麦克风，请连接设备后重试。",
    NotReadableError: "麦克风正被其他程序占用，关闭占用程序后重试。",
    OverconstrainedError: "当前麦克风不支持请求的音频设置，请更换设备后重试。",
    AbortError: "麦克风启动被中断，请重新检测。",
  };
  return messages[name] || "无法使用麦克风，请检查 Chrome 权限和音频设备。";
}
