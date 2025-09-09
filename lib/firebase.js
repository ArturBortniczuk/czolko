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
          password: '',
          isHost: true,
          joinedAt: Date.now()
        }
      },
      passwords: [],
      conversation: [],
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
      password: '',
      isHost: false,
      joinedAt: Date.now()
    });
    
    return gameRef;
  },

  // Aktualizuje stan gry
  updateGameState: async (gameCode, updates) => {
    const gameRef = ref(database, `games/${gameCode}`);
    await set(gameRef, updates);
  },

  // Dodaje wiadomość do konwersacji
  addMessage: async (gameCode, message) => {
    const messagesRef = ref(database, `games/${gameCode}/conversation`);
    await push(messagesRef, {
      ...message,
      timestamp: Date.now()
    });
  },

  // Usuwa grę
  deleteGame: async (gameCode) => {
    const gameRef = ref(database, `games/${gameCode}`);
    await remove(gameRef);
  }
};