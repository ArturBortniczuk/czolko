import { initializeApp } from 'firebase/app';
import { getDatabase, ref, push, set, onValue, off, remove } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyCeQsssq4VH0kuHlgIw6htXlZ-pOLiiX4g",
  authDomain: "czolko-60cb1.firebaseapp.com",
  databaseURL: "https://czolko-60cb1-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "czolko-60cb1",
  storageBucket: "czolko-60cb1.firebasestorage.app",
  messagingSenderId: "919939205423",
  appId: "1:919939205423:web:ffa3aa3732ce47cf4eb9da"
};

const app = initializeApp(firebaseConfig);
export const database = getDatabase(app);

// Funkcje pomocnicze dla gry
export const gameUtils = {
  // Tworzy nowy pokój gry
  createGame: async (hostName) => {
    const gameCode = Math.random().toString(36).substr(2, 6).toUpperCase();
    const gameRef = ref(database, `games/${gameCode}`);
    
    await set(gameRef, {
      host: hostName,
      state: 'lobby',
      players: {
        [hostName]: {
          name: hostName,
          isHost: true,
          joinedAt: Date.now(),
          passwords: [],
          setupComplete: false
        }
      },
      questions: {},
      activePlayerIndex: 0,
      winner: null,
      createdAt: Date.now()
    });
    
    return gameCode;
  },

  // Dołącza gracza do pokoju
  joinGame: async (gameCode, playerName) => {
    const gameRef = ref(database, `games/${gameCode}`);
    const playerRef = ref(database, `games/${gameCode}/players/${playerName}`);
    
    await set(playerRef, {
      name: playerName,
      isHost: false,
      joinedAt: Date.now(),
      passwords: [],
      setupComplete: false
    });
    
    return gameRef;
  },

  // Aktualizuje stan gry
  updateGameState: async (gameCode, updates) => {
    const gameRef = ref(database, `games/${gameCode}`);
    await set(gameRef, updates);
  },

  // Aktualizuje gracza (np. dodaje hasła)
  updatePlayer: async (gameCode, playerName, updates) => {
    const playerRef = ref(database, `games/${gameCode}/players/${playerName}`);
    await set(playerRef, updates);
  },

  // Dodaje pytanie do gry
  addQuestion: async (gameCode, question) => {
    const questionRef = ref(database, `games/${gameCode}/questions/${question.id}`);
    await set(questionRef, question);
  },

  // Aktualizuje pytanie (np. dodaje odpowiedź)
  updateQuestion: async (gameCode, questionId, updates) => {
    const questionRef = ref(database, `games/${gameCode}/questions/${questionId}`);
    await set(questionRef, updates);
  },

  // Usuwa grę
  deleteGame: async (gameCode) => {
    const gameRef = ref(database, `games/${gameCode}`);
    await remove(gameRef);
  }
};