// Role-play scenarios for the voice dialogue (Fase 2). Static ESM data so it is
// cached offline with the module graph and importable in tests. `system` is the
// English-only priming sent to tutor.chat; `opening` is the tutor's first line
// (shown + spoken); `suggestions` are optional phrases (never block improvising).
export const SCENARIOS = [
  {
    id: 'cafe',
    title: { es: 'Pedir un café', en: 'Ordering coffee' },
    system: 'You are a friendly barista at a café talking to a customer.',
    opening: 'Hi! Welcome. What can I get for you today?',
    suggestions: [
      { en: "I'd like a coffee, please.", es: 'Quisiera un café, por favor.' },
      { en: 'How much is it?', es: '¿Cuánto cuesta?' },
      { en: 'Can I have it with milk?', es: '¿Puede ser con leche?' },
    ],
  },
  {
    id: 'intro',
    title: { es: 'Presentarte', en: 'Introduce yourself' },
    system: 'You are a friendly new coworker meeting the learner for the first time.',
    opening: "Hi, nice to meet you! I'm Sam. What's your name?",
    suggestions: [
      { en: "My name is Edgar. Nice to meet you.", es: 'Me llamo Edgar. Mucho gusto.' },
      { en: "I'm from Colombia.", es: 'Soy de Colombia.' },
      { en: 'I work in technology.', es: 'Trabajo en tecnología.' },
    ],
  },
  {
    id: 'directions',
    title: { es: 'Pedir direcciones', en: 'Asking for directions' },
    system: 'You are a helpful stranger on the street giving simple directions.',
    opening: 'Hello! You look a little lost — do you need any help?',
    suggestions: [
      { en: "Where is the train station?", es: '¿Dónde está la estación de tren?' },
      { en: 'Is it far from here?', es: '¿Está lejos de aquí?' },
      { en: 'Thank you very much!', es: '¡Muchas gracias!' },
    ],
  },
  {
    id: 'free',
    title: { es: 'Charla libre', en: 'Free chat' },
    system: 'You are a patient English tutor having a relaxed conversation with the learner.',
    opening: 'Hi! What would you like to talk about today?',
    suggestions: [
      { en: 'I want to talk about my weekend.', es: 'Quiero hablar de mi fin de semana.' },
      { en: 'Can you ask me a question?', es: '¿Puedes hacerme una pregunta?' },
    ],
  },
];
