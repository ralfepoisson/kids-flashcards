import { DOCUMENT } from '@angular/common';
import { inject, Injectable, signal } from '@angular/core';

const messages = {
  login: { en: 'Log in', fr: 'Se connecter' },
  logout: { en: 'Log out', fr: 'Se déconnecter' },
  authLoading: { en: 'Please wait…', fr: 'Patiente un instant…' },
  loginFailed: {
    en: 'Login could not be completed. Please try logging in again.',
    fr: 'La connexion a échoué. Essaie de te connecter à nouveau.',
  },
  loginUnavailable: {
    en: 'Life2 login is unavailable. Please try again shortly.',
    fr: 'La connexion Life2 est indisponible. Réessaie dans un instant.',
  },
  sessionUnavailable: {
    en: 'Your login status could not be checked. Public series remain available.',
    fr: 'Impossible de vérifier ta connexion. Les séries publiques restent disponibles.',
  },
  logoutFailed: {
    en: 'Logout could not be confirmed. Please try again before leaving this browser.',
    fr: 'Impossible de confirmer la déconnexion. Réessaie avant de quitter ce navigateur.',
  },
  signInAgain: {
    en: 'Your session expired. Please log in again to make changes.',
    fr: 'Ta session a expiré. Reconnecte-toi pour modifier les séries.',
  },
  public: { en: 'Public', fr: 'Publique' },
  private: { en: 'Private', fr: 'Privée' },
  publicSet: { en: 'Make this series public', fr: 'Rendre cette série publique' },
  publicHelp: {
    en: 'Public series can be viewed and practised by everyone. Private series are visible only to you. Only you can edit your series.',
    fr: 'Tout le monde peut voir les séries publiques et s’entraîner. Les séries privées sont visibles uniquement par toi. Toi seul peux modifier tes séries.',
  },
  publicSets: { en: 'Public flashcard sets', fr: 'Séries de cartes publiques' },
  availableSets: { en: 'AVAILABLE SERIES', fr: 'SÉRIES DISPONIBLES' },
  noPublicSets: {
    en: 'No public series are available yet.',
    fr: 'Aucune série publique n’est encore disponible.',
  },
  guestCuriosity: {
    en: 'Choose a public series and start practising.',
    fr: 'Choisis une série publique et commence à t’entraîner.',
  },
  emptyReadOnlyPractice: {
    en: 'This series has no cards to practise yet.',
    fr: 'Cette série ne contient pas encore de cartes pour s’entraîner.',
  },
  brand: {
    en: 'little by little',
    fr: 'petit à petit',
  },
  brandHome: {
    en: 'Little by Little home',
    fr: 'Accueil Petit à Petit',
  },
  tagline: {
    en: 'A little practice. A big difference.',
    fr: 'Un peu de pratique. Une grande différence.',
  },
  learningSpace: {
    en: 'YOUR LEARNING SPACE',
    fr: 'TON ESPACE POUR APPRENDRE',
  },
  mySets: {
    en: 'My flashcard sets',
    fr: 'Mes séries de cartes',
  },
  yourSets: {
    en: 'YOUR SETS',
    fr: 'TES SÉRIES',
  },
  discoveryStarts: {
    en: 'Your next discovery starts',
    fr: 'Ta prochaine découverte commence',
  },
  withSet: {
    en: 'with a new set.',
    fr: 'avec une nouvelle série.',
  },
  createSet: {
    en: 'Create a set',
    fr: 'Créer une série',
  },
  smallSteps: {
    en: 'Small steps, every day',
    fr: 'De petits pas, chaque jour',
  },
  tip: {
    en: 'Just a few minutes of practice can make a lesson stick.',
    fr: 'Quelques minutes de pratique suffisent pour retenir une leçon.',
  },
  curiousMinds: {
    en: 'Made for curious minds',
    fr: 'Pour les esprits curieux',
  },
  learnGrow: {
    en: 'A place to learn & grow',
    fr: 'Un espace pour apprendre et grandir',
  },
  oneAtTime: {
    en: 'ONE CARD AT A TIME',
    fr: 'UNE CARTE À LA FOIS',
  },
  lessonCloser: {
    en: 'A little practice brings every lesson closer.',
    fr: 'Un peu de pratique pour mieux comprendre chaque leçon.',
  },
  editSet: {
    en: 'Edit set',
    fr: 'Modifier la série',
  },
  deleteSet: {
    en: 'Delete set',
    fr: 'Supprimer la série',
  },
  chooseMode: {
    en: 'Choose mode',
    fr: 'Choisir le mode',
  },
  editMode: {
    en: 'Edit Mode',
    fr: 'Mode édition',
  },
  practiceMode: {
    en: 'Practice Mode',
    fr: 'Mode entraînement',
  },
  card: {
    en: 'card',
    fr: 'carte',
  },
  cards: {
    en: 'cards',
    fr: 'cartes',
  },
  yourCards: {
    en: 'Your flashcards',
    fr: 'Tes cartes',
  },
  buildLesson: {
    en: 'Build your lesson, front and back.',
    fr: 'Crée ta leçon, recto et verso.',
  },
  addCard: {
    en: 'Add flashcard',
    fr: 'Ajouter une carte',
  },
  freshStart: {
    en: 'A fresh start for a new lesson',
    fr: 'Une nouvelle leçon commence ici',
  },
  firstCardHelp: {
    en: 'Add your first card with a question, a word, or a picture.',
    fr: 'Ajoute ta première carte avec une question, un mot ou une image.',
  },
  otherSide: {
    en: 'Put the answer on the other side.',
    fr: 'Mets la réponse de l’autre côté.',
  },
  createFirstCard: {
    en: 'Create your first flashcard',
    fr: 'Créer ta première carte',
  },
  front: {
    en: 'FRONT',
    fr: 'RECTO',
  },
  back: {
    en: 'BACK',
    fr: 'VERSO',
  },
  editCard: {
    en: 'Edit card',
    fr: 'Modifier la carte',
  },
  frontAlt: {
    en: 'Front of flashcard',
    fr: 'Recto de la carte',
  },
  instructionHint: {
    en: 'Click Edit to add an instruction',
    fr: 'Clique sur Modifier pour ajouter une consigne',
  },
  backAlt: {
    en: 'Back of flashcard',
    fr: 'Verso de la carte',
  },
  moveUp: {
    en: 'Move card up',
    fr: 'Déplacer la carte vers le haut',
  },
  moveDown: {
    en: 'Move card down',
    fr: 'Déplacer la carte vers le bas',
  },
  deleteCard: {
    en: 'Delete card',
    fr: 'Supprimer la carte',
  },
  pictureCard: {
    en: 'Picture card',
    fr: 'Carte illustrée',
  },
  answer: {
    en: 'THE ANSWER',
    fr: 'LA RÉPONSE',
  },
  try: {
    en: 'GIVE IT A TRY',
    fr: 'À TOI DE JOUER',
  },
  progress: {
    en: 'Practice progress',
    fr: 'Progression de l’entraînement',
  },
  flip: {
    en: 'Flip flashcard',
    fr: 'Retourner la carte',
  },
  reveal: {
    en: 'Click to reveal the answer',
    fr: 'Clique pour voir la réponse',
  },
  seeQuestion: {
    en: 'Click to see the question',
    fr: 'Clique pour voir la question',
  },
  previous: {
    en: 'Previous',
    fr: 'Précédente',
  },
  shuffle: {
    en: 'Shuffle again',
    fr: 'Mélanger à nouveau',
  },
  next: {
    en: 'Next card',
    fr: 'Carte suivante',
  },
  complete: {
    en: 'You made it through! Shuffle again for another round.',
    fr: 'Bravo, tu as terminé ! Mélange les cartes pour recommencer.',
  },
  keyboard: {
    en: 'You can also use ← → to move and Space to flip.',
    fr: 'Utilise aussi ← → pour changer de carte et Espace pour la retourner.',
  },
  ready: {
    en: 'Ready when your cards are',
    fr: 'Tout sera prêt avec tes cartes',
  },
  emptyPractice: {
    en: 'Add some flashcards in Edit Mode, then come back to practise.',
    fr: 'Ajoute des cartes en mode édition, puis reviens t’entraîner.',
  },
  goEdit: {
    en: 'Go to Edit Mode',
    fr: 'Passer en mode édition',
  },
  bigIdeas: {
    en: 'BIG IDEAS START SMALL',
    fr: 'LES GRANDES IDÉES COMMENCENT PETIT',
  },
  learnNew: {
    en: 'Let’s learn something new.',
    fr: 'Apprenons quelque chose de nouveau.',
  },
  discoveries: {
    en: 'Your lessons, your pictures, your own little moments of discovery.',
    fr: 'Tes leçons, tes images, tes petits moments de découverte.',
  },
  feelsPlay: {
    en: 'LEARNING THAT FEELS LIKE PLAY',
    fr: 'APPRENDRE EN S’AMUSANT',
  },
  littlePractice: {
    en: 'A little practice.',
    fr: 'Un peu de pratique.',
  },
  possibility: {
    en: 'A lot of possibility.',
    fr: 'Un monde de possibilités.',
  },
  biteSized: {
    en: 'Turn school lessons into bite-sized discoveries.',
    fr: 'Transforme tes leçons en petites découvertes.',
  },
  curiosity: {
    en: 'Create a set, add your cards, and let curiosity take over.',
    fr: 'Crée une série, ajoute tes cartes et laisse ta curiosité te guider.',
  },
  firstDiscovery: {
    en: 'Make your first discovery',
    fr: 'Fais ta première découverte',
  },
  growLittle: {
    en: 'grow a little',
    fr: 'grandis un peu',
  },
  everyDay: {
    en: 'every day',
    fr: 'chaque jour',
  },
  search: {
    en: 'Search sets',
    fr: 'Rechercher des séries',
  },
  findSet: {
    en: 'Find a set…',
    fr: 'Trouver une série…',
  },
  loading: {
    en: 'Loading your flashcard sets…',
    fr: 'Chargement de tes séries de cartes…',
  },
  loadFailed: {
    en: 'We couldn’t load your sets',
    fr: 'Impossible de charger tes séries',
  },
  checkServer: {
    en: 'Check the backend is running, then try again.',
    fr: 'Vérifie que le serveur fonctionne, puis réessaie.',
  },
  retry: {
    en: 'Try again',
    fr: 'Réessayer',
  },
  adventure: {
    en: 'Your learning adventure starts here',
    fr: 'Ton aventure commence ici',
  },
  setHome: {
    en: 'A set is a home for your flashcards.',
    fr: 'Une série rassemble tes cartes.',
  },
  nameLesson: {
    en: 'Give your first lesson a name and start creating.',
    fr: 'Donne un nom à ta première leçon et commence à créer.',
  },
  createFirstSet: {
    en: 'Create your first set',
    fr: 'Créer ta première série',
  },
  anything: {
    en: 'Words, numbers, science… anything you’re curious about.',
    fr: 'Mots, nombres, sciences… tout ce qui éveille ta curiosité.',
  },
  newLesson: {
    en: 'A new lesson waiting to be explored.',
    fr: 'Une nouvelle leçon à découvrir.',
  },
  flashcard: {
    en: 'flashcard',
    fr: 'carte',
  },
  flashcards: {
    en: 'flashcards',
    fr: 'cartes',
  },
  noMatches: {
    en: 'No sets match your search.',
    fr: 'Aucune série ne correspond à ta recherche.',
  },
  footer: {
    en: 'Every small step is a step forward.',
    fr: 'Chaque petit pas te fait avancer.',
  },
  yourOwn: {
    en: 'MAKE IT YOUR OWN',
    fr: 'À TOI DE CRÉER',
  },
  closeEditor: {
    en: 'Close editor',
    fr: 'Fermer l’éditeur',
  },
  setName: {
    en: 'Set name',
    fr: 'Nom de la série',
  },
  example: {
    en: 'For example, French vocabulary',
    fr: 'Par exemple, vocabulaire français',
  },
  description: {
    en: 'Description',
    fr: 'Description',
  },
  optional: {
    en: 'optional',
    fr: 'facultatif',
  },
  setQuestion: {
    en: 'What will we discover in this set?',
    fr: 'Que découvrirons-nous dans cette série ?',
  },
  cancel: {
    en: 'Cancel',
    fr: 'Annuler',
  },
  saving: {
    en: 'Saving…',
    fr: 'Enregistrement…',
  },
  saveSet: {
    en: 'Save set',
    fr: 'Enregistrer la série',
  },
  frontFace: {
    en: 'Front face',
    fr: 'Recto',
  },
  frontShow: {
    en: 'Show on the front',
    fr: 'Afficher au recto',
  },
  text: {
    en: 'Text',
    fr: 'Texte',
  },
  picture: {
    en: 'Picture',
    fr: 'Image',
  },
  frontText: {
    en: 'Front text',
    fr: 'Texte du recto',
  },
  questionIdea: {
    en: 'A question, word, or idea…',
    fr: 'Une question, un mot ou une idée…',
  },
  frontPicture: {
    en: 'Front picture',
    fr: 'Image du recto',
  },
  frontPreview: {
    en: 'Front picture preview',
    fr: 'Aperçu de l’image du recto',
  },
  formats: {
    en: 'PNG, JPEG, WebP or GIF · up to 10 MB',
    fr: 'PNG, JPEG, WebP ou GIF · jusqu’à 10 Mo',
  },
  instruction: {
    en: 'Instruction below card',
    fr: 'Consigne sous la carte',
  },
  aloud: {
    en: 'Try saying the answer aloud.',
    fr: 'Essaie de dire la réponse à voix haute.',
  },
  backFace: {
    en: 'Back face',
    fr: 'Verso',
  },
  backShow: {
    en: 'Show on the back',
    fr: 'Afficher au verso',
  },
  backText: {
    en: 'Back text',
    fr: 'Texte du verso',
  },
  answerExplanation: {
    en: 'The answer or explanation…',
    fr: 'La réponse ou l’explication…',
  },
  backPicture: {
    en: 'Back picture',
    fr: 'Image du verso',
  },
  backPreview: {
    en: 'Back picture preview',
    fr: 'Aperçu de l’image du verso',
  },
  explanation: {
    en: 'Explanation below card',
    fr: 'Explication sous la carte',
  },
  helpStick: {
    en: 'A little more to help it stick.',
    fr: 'Quelques mots pour mieux retenir.',
  },
  uploading: {
    en: 'Uploading picture…',
    fr: 'Envoi de l’image…',
  },
  questionDiscovery: {
    en: 'A question on one side. A discovery on the other.',
    fr: 'Une question d’un côté. Une découverte de l’autre.',
  },
  saveCard: {
    en: 'Save card',
    fr: 'Enregistrer la carte',
  },
  keep: {
    en: 'Keep it',
    fr: 'Conserver',
  },
  deleting: {
    en: 'Deleting…',
    fr: 'Suppression…',
  },
  setReady: {
    en: 'Your set is ready.',
    fr: 'Ta série est prête.',
  },
  setSaved: {
    en: 'Set saved',
    fr: 'Série enregistrée',
  },
  changesSaved: {
    en: 'Your changes have been saved.',
    fr: 'Tes modifications ont été enregistrées.',
  },
  cardSaved: {
    en: 'Card saved',
    fr: 'Carte enregistrée',
  },
  smallerPicture: {
    en: 'Choose a picture smaller than 10 MB.',
    fr: 'Choisis une image de moins de 10 Mo.',
  },
  pictureUploaded: {
    en: 'Picture uploaded. Save the card to keep it.',
    fr: 'Image envoyée. Enregistre la carte pour la conserver.',
  },
  orderUpdated: {
    en: 'Card order updated.',
    fr: 'Ordre des cartes mis à jour.',
  },
  setDeleted: {
    en: 'Set and its cards deleted.',
    fr: 'Série et cartes supprimées.',
  },
  cardDeleted: {
    en: 'Card deleted.',
    fr: 'Carte supprimée.',
  },
  serverUnreachable: {
    en: 'Could not reach the app server. Please check it is running and try again.',
    fr: 'Impossible de joindre le serveur. Vérifie qu’il fonctionne et réessaie.',
  },
  errorTitle: {
    en: 'Something went wrong',
    fr: 'Une erreur est survenue',
  },
  cardsInSet: {
    en: '{count} {noun} in this set',
    fr: '{count} {noun} dans cette série',
  },
  totalCards: {
    en: '{count} cards. Endless things to discover.',
    fr: '{count} cartes. Tant de choses à découvrir.',
  },
  cardPosition: {
    en: 'Card {index} of {count}',
    fr: 'Carte {index} sur {count}',
  },
  createSetTitle: {
    en: 'Create flashcard set',
    fr: 'Créer une série de cartes',
  },
  editSetTitle: {
    en: 'Edit flashcard set',
    fr: 'Modifier la série de cartes',
  },
  createCardTitle: {
    en: 'Create flashcard',
    fr: 'Créer une carte',
  },
  editCardTitle: {
    en: 'Edit flashcard',
    fr: 'Modifier la carte',
  },
  deleteSetTitle: {
    en: 'Delete this set?',
    fr: 'Supprimer cette série ?',
  },
  deleteCardTitle: {
    en: 'Delete this card?',
    fr: 'Supprimer cette carte ?',
  },
  deleteSetMessage: {
    en: '“{name}” will be deleted along with all its flashcards. This can’t be undone.',
    fr: '« {name} » sera supprimée avec toutes ses cartes. Cette action est irréversible.',
  },
  deleteCardMessage: {
    en: '“{name}” will be deleted. This can’t be undone.',
    fr: '« {name} » sera supprimée. Cette action est irréversible.',
  },
  invalidInput: {
    en: 'Please check the entered values and try again.',
    fr: 'Vérifie les valeurs saisies et réessaie.',
  },
  requestFailed: {
    en: 'The request failed. Please try again.',
    fr: 'La demande a échoué. Réessaie.',
  },
  missingSet: {
    en: 'Flashcard set not found',
    fr: 'Série de cartes introuvable',
  },
  missingCard: {
    en: 'Flashcard not found in this set',
    fr: 'Carte introuvable dans cette série',
  },
  frontUpload: {
    en: 'Front image must be an uploaded picture',
    fr: 'L’image du recto doit être une image envoyée',
  },
  backUpload: {
    en: 'Back image must be an uploaded picture',
    fr: 'L’image du verso doit être une image envoyée',
  },
  reorderError: {
    en: 'Include every card in this set exactly once',
    fr: 'Inclus chaque carte de cette série une seule fois',
  },
  uploadSize: {
    en: 'Pictures must be 10 MiB or smaller',
    fr: 'Les images ne doivent pas dépasser 10 Mio',
  },
  uploadFormat: {
    en: 'Choose a PNG, JPEG, WebP, or GIF picture',
    fr: 'Choisis une image PNG, JPEG, WebP ou GIF',
  },
  invalidPicture: {
    en: 'The upload is not a valid picture',
    fr: 'Le fichier envoyé n’est pas une image valide',
  },
  databaseError: {
    en: 'Database unavailable. Check local PostgreSQL and try again.',
    fr: 'Base de données indisponible. Vérifie PostgreSQL et réessaie.',
  },
} as const;

export type MessageKey = keyof typeof messages;
export type Language = 'en' | 'fr';
const storageKey = 'kids-flashcards-language';

@Injectable({ providedIn: 'root' })
export class InterfaceLanguage {
  private document = inject(DOCUMENT);
  readonly language = signal<Language>(this.restore());

  constructor() {
    this.document.documentElement.lang = this.language();
  }

  t(key: MessageKey, values: Record<string, string | number> = {}): string {
    return messages[key][this.language()].replace(/\{(\w+)\}/g, (token, name) =>
      Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : token,
    );
  }

  toggle() {
    const next = this.language() === 'en' ? 'fr' : 'en';
    this.language.set(next);
    this.document.documentElement.lang = next;
    try {
      this.document.defaultView?.localStorage.setItem(storageKey, next);
    } catch {
      // The switch still works when browser storage is blocked.
    }
  }

  error(detail: string): string {
    const key = (Object.keys(messages) as MessageKey[]).find((key) => messages[key].en === detail);
    return key ? this.t(key) : this.language() === 'en' ? detail : this.t('requestFailed');
  }

  private restore(): Language {
    try {
      return this.document.defaultView?.localStorage.getItem(storageKey) === 'en' ? 'en' : 'fr';
    } catch {
      return 'fr';
    }
  }
}
