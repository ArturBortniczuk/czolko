'use client';

import { useState, useEffect } from 'react';
import { database, gameUtils } from '../lib/firebase';
import { ref, onValue, off, push, set } from 'firebase/database';
import { 
  Play, Users, Eye, EyeOff, Trophy, Copy, Check, 
  MessageCircle, Send, Crown, UserPlus, Plus, History, Target
} from 'lucide-react';

type GameState = 'lobby' | 'setup' | 'playing' | 'finished';

interface Player {
  name: string;
  isHost: boolean;
  joinedAt: number;
  passwords: string[];
  assignedPassword?: string;
  setupComplete?: boolean;
}

interface Question {
  id: string;
  player: string;
  question: string;
  answers: { [playerName: string]: string };
  timestamp: number;
  isComplete: boolean;
}

interface GameData {
  host: string;
  state: GameState;
  players: { [key: string]: Player };
  questions: { [id: string]: Question };
  activePlayerIndex: number;
  winner: string | null;
  currentQuestionId?: string;
}

export default function MultiplayerGame() {
  // Stan lokalny
  const [gameCode, setGameCode] = useState<string>('');
  const [playerName, setPlayerName] = useState<string>('');
  const [joinCode, setJoinCode] = useState<string>('');
  const [isHost, setIsHost] = useState<boolean>(false);
  const [gameData, setGameData] = useState<GameData | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  
  // Stan setup
  const [myPasswords, setMyPasswords] = useState<string>('');
  
  // Stan gry - zmieniono nazwę na questionInput żeby uniknąć konfliktu
  const [questionInput, setQuestionInput] = useState<string>('');
  const [answerText, setAnswerText] = useState<string>('');
  const [showPasswords, setShowPasswords] = useState<{ [key: string]: boolean }>({});
  const [activeTab, setActiveTab] = useState<'game' | 'passwords' | 'history'>('game');

  // Nasłuchiwanie zmian w grze
  useEffect(() => {
    if (!gameCode) return;

    const gameRef = ref(database, `games/${gameCode}`);
    const unsubscribe = onValue(gameRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setGameData(data);
      }
    });

    return () => off(gameRef, 'value', unsubscribe);
  }, [gameCode]);

  // Tworzenie nowej gry
  const createGame = async () => {
    if (!playerName.trim()) {
      alert('Wpisz swój nick!');
      return;
    }

    try {
      const newGameCode = await gameUtils.createGame(playerName.trim());
      setGameCode(newGameCode);
      setIsHost(true);
    } catch (error) {
      console.error('Błąd tworzenia gry:', error);
      alert('Błąd tworzenia gry!');
    }
  };

  // Dołączanie do gry
  const joinGame = async () => {
    if (!playerName.trim() || !joinCode.trim()) {
      alert('Wpisz nick i kod gry!');
      return;
    }

    try {
      await gameUtils.joinGame(joinCode.toUpperCase(), playerName.trim());
      setGameCode(joinCode.toUpperCase());
      setIsHost(false);
    } catch (error) {
      console.error('Błąd dołączania do gry:', error);
      alert('Błąd dołączania do gry! Sprawdź kod.');
    }
  };

  // Kopiowanie kodu gry
  const copyGameCode = async () => {
    await navigator.clipboard.writeText(gameCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Przejście do fazy setup
  const moveToSetup = async () => {
    if (!gameData || !isHost) return;
    
    if (Object.keys(gameData.players).length < 2) {
      alert('Potrzeba przynajmniej 2 graczy!');
      return;
    }

    const updatedGameData = {
      ...gameData,
      state: 'setup' as GameState
    };

    await gameUtils.updateGameState(gameCode, updatedGameData);
  };

  // Zapisywanie haseł gracza
  const saveMyPasswords = async () => {
    if (!gameData || !myPasswords.trim()) {
      alert('Wpisz przynajmniej jedno hasło!');
      return;
    }

    const passwords = myPasswords
      .split('\n')
      .map(p => p.trim())
      .filter(p => p.length > 0);

    if (passwords.length === 0) {
      alert('Wpisz przynajmniej jedno hasło!');
      return;
    }

    const playerRef = ref(database, `games/${gameCode}/players/${playerName}`);
    await set(playerRef, {
      ...gameData.players[playerName],
      passwords: passwords,
      setupComplete: true
    });
  };

  // Rozpoczęcie gry (gdy wszyscy skończyli setup)
  const startGame = async () => {
    if (!gameData || !isHost) return;

    // Sprawdź czy wszyscy gracze skończyli setup
    const players = Object.values(gameData.players);
    const allComplete = players.every(p => p.setupComplete);
    
    if (!allComplete) {
      alert('Nie wszyscy gracze skończyli dodawanie haseł!');
      return;
    }

    // Zbierz wszystkie hasła
    const allPasswords: string[] = [];
    const passwordOwners: { [password: string]: string } = {};
    
    players.forEach(player => {
      if (player.passwords) {
        player.passwords.forEach(password => {
          allPasswords.push(password);
          passwordOwners[password] = player.name;
        });
      }
    });

    if (allPasswords.length < players.length) {
      alert('Za mało haseł! Każdy gracz powinien dodać przynajmniej jedno hasło.');
      return;
    }

    // Przypisz hasła graczom (każdy dostaje hasło innego gracza)
    const playerNames = Object.keys(gameData.players);
    const updatedPlayers = { ...gameData.players };
    
    playerNames.forEach(playerName => {
      // Znajdź hasła które NIE należą do tego gracza
      const availablePasswords = allPasswords.filter(password => 
        passwordOwners[password] !== playerName
      );
      
      if (availablePasswords.length > 0) {
        // Losuj hasło
        const randomPassword = availablePasswords[Math.floor(Math.random() * availablePasswords.length)];
        updatedPlayers[playerName] = {
          ...updatedPlayers[playerName],
          assignedPassword: randomPassword
        };
        
        // Usuń to hasło z dostępnych
        const passwordIndex = allPasswords.indexOf(randomPassword);
        allPasswords.splice(passwordIndex, 1);
      }
    });

    const updatedGameData = {
      ...gameData,
      state: 'playing' as GameState,
      players: updatedPlayers,
      questions: {},
      activePlayerIndex: 0
    };

    await gameUtils.updateGameState(gameCode, updatedGameData);
  };

  // Zadawanie pytania
  const askQuestion = async () => {
    if (!questionInput.trim() || !gameData) return;

    const questionId = Date.now().toString();
    const playerNames = Object.keys(gameData.players);
    
    // Sprawdź czy gracz zgadł hasło
    const myPassword = gameData.players[playerName]?.assignedPassword || '';
    const foundWords = myPassword.toLowerCase().split(' ');
    const questionWords = questionInput.toLowerCase().split(' ');
    const foundWord = foundWords.find(word => 
      questionWords.some(qWord => qWord.includes(word) && word.length > 2)
    );

    if (foundWord) {
      // Gracz wygrał!
      const updatedGameData = {
        ...gameData,
        state: 'finished' as GameState,
        winner: playerName
      };
      await gameUtils.updateGameState(gameCode, updatedGameData);
      return;
    }

    // Stwórz nowe pytanie
    const newQuestion: Question = {
      id: questionId,
      player: playerName,
      question: questionInput,
      answers: {},
      timestamp: Date.now(),
      isComplete: false
    };

    const updatedQuestions = {
      ...gameData.questions,
      [questionId]: newQuestion
    };

    const updatedGameData = {
      ...gameData,
      questions: updatedQuestions,
      currentQuestionId: questionId
    };

    await gameUtils.updateGameState(gameCode, updatedGameData);
    setQuestionInput('');
  };

  // Odpowiadanie na pytanie
  const answerQuestion = async (questionId: string, answer: string) => {
    if (!gameData || !answer.trim()) return;

    const question = gameData.questions[questionId];
    if (!question) return;

    const updatedAnswers = {
      ...question.answers,
      [playerName]: answer
    };

    const playerNames = Object.keys(gameData.players);
    const expectedAnswerers = playerNames.filter(name => name !== question.player);
    const isComplete = expectedAnswerers.every(name => updatedAnswers[name]);

    const updatedQuestion = {
      ...question,
      answers: updatedAnswers,
      isComplete
    };

    const updatedQuestions = {
      ...gameData.questions,
      [questionId]: updatedQuestion
    };

    let updatedGameData = {
      ...gameData,
      questions: updatedQuestions
    };

    // Jeśli wszyscy odpowiedzieli, przejdź do następnego gracza
    if (isComplete) {
      const currentIndex = gameData.activePlayerIndex;
      const nextIndex = (currentIndex + 1) % playerNames.length;
      updatedGameData = {
        ...updatedGameData,
        activePlayerIndex: nextIndex,
        currentQuestionId: undefined
      };
    }

    await gameUtils.updateGameState(gameCode, updatedGameData);
    setAnswerText('');
  };

  // Przełączanie widoczności hasła
  const togglePasswordVisibility = (player: string) => {
    setShowPasswords(prev => ({
      ...prev,
      [player]: !prev[player]
    }));
  };

  // Reset gry
  const resetGame = () => {
    setGameCode('');
    setGameData(null);
    setIsHost(false);
    setMyPasswords('');
    setShowPasswords({});
    setActiveTab('game');
    setQuestionInput('');
  };

  if (!gameCode) {
    // Ekran lobby
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-blue-600 to-teal-500 p-6">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-4">🎯 Gra Online</h1>
            <p className="text-blue-100">Multiplayer w zgadywanie haseł</p>
          </div>

          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 space-y-6">
            <div>
              <label className="block text-white font-medium mb-2">Twój nick:</label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Wpisz swój nick..."
                className="w-full px-4 py-3 rounded-xl bg-white/20 text-white placeholder-blue-200 border border-white/30 focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>

            <div className="space-y-4">
              <button
                onClick={createGame}
                className="w-full px-6 py-4 bg-green-500 hover:bg-green-600 text-white rounded-xl font-bold text-lg transition-colors flex items-center justify-center gap-2"
              >
                <Crown size={20} />
                Stwórz Nową Grę
              </button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/30"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-gradient-to-br from-purple-600 via-blue-600 to-teal-500 text-white">lub</span>
                </div>
              </div>

              <div>
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="Kod gry..."
                  className="w-full px-4 py-3 rounded-xl bg-white/20 text-white placeholder-blue-200 border border-white/30 focus:outline-none focus:ring-2 focus:ring-blue-300 mb-3"
                />
                <button
                  onClick={joinGame}
                  className="w-full px-6 py-4 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-bold text-lg transition-colors flex items-center justify-center gap-2"
                >
                  <UserPlus size={20} />
                  Dołącz do Gry
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!gameData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-blue-600 to-teal-500 flex items-center justify-center">
        <div className="text-white text-xl">Ładowanie gry...</div>
      </div>
    );
  }

  if (gameData.state === 'lobby') {
    // Lobby - czekanie na graczy
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-blue-600 to-teal-500 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-4">🎯 Lobby Gry</h1>
            <div className="flex items-center justify-center gap-2 mb-4">
              <span className="text-blue-100">Kod gry:</span>
              <span className="text-2xl font-bold text-yellow-300">{gameCode}</span>
              <button
                onClick={copyGameCode}
                className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors flex items-center gap-1"
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? 'Skopiowano!' : 'Kopiuj'}
              </button>
            </div>
            <p className="text-blue-100">Podeślij kod znajomym żeby dołączyli!</p>
          </div>

          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
            <div className="flex items-center gap-2 mb-6">
              <Users className="text-white" size={24} />
              <h2 className="text-2xl font-semibold text-white">Gracze ({Object.keys(gameData.players).length})</h2>
            </div>

            <div className="space-y-3 mb-6">
              {Object.values(gameData.players).map((player) => (
                <div key={player.name} className="flex items-center justify-between bg-white/20 rounded-lg px-4 py-3">
                  <span className="text-white font-medium flex items-center gap-2">
                    {player.isHost && <Crown size={16} className="text-yellow-300" />}
                    {player.name}
                    {player.isHost && <span className="text-yellow-300 text-sm">(Host)</span>}
                  </span>
                </div>
              ))}
            </div>

            {isHost && (
              <button
                onClick={moveToSetup}
                disabled={Object.keys(gameData.players).length < 2}
                className="w-full px-6 py-4 bg-green-500 hover:bg-green-600 disabled:bg-gray-500 disabled:cursor-not-allowed text-white rounded-xl font-bold text-lg transition-colors flex items-center justify-center gap-2"
              >
                <Play size={20} />
                Przejdź do Dodawania Haseł
              </button>
            )}

            {!isHost && (
              <div className="text-center">
                <Crown className="mx-auto text-yellow-300 mb-4" size={48} />
                <h3 className="text-xl font-semibold text-white mb-2">Czekamy na hosta</h3>
                <p className="text-blue-200">{gameData.host} rozpocznie dodawanie haseł...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (gameData.state === 'setup') {
    // Faza dodawania haseł
    const myPlayer = gameData.players[playerName];
    const allPlayers = Object.values(gameData.players);
    const completedPlayers = allPlayers.filter(p => p.setupComplete).length;
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-4">📝 Dodawanie Haseł</h1>
            <p className="text-blue-100">Każdy gracz dodaje swoje hasła do wspólnej puli</p>
            <div className="text-yellow-300 font-semibold mt-2">
              Gotowych graczy: {completedPlayers}/{allPlayers.length}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Panel dodawania haseł */}
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
              <h2 className="text-2xl font-semibold text-white mb-6">Twoje Hasła</h2>
              
              {myPlayer?.setupComplete ? (
                <div className="text-center py-8">
                  <Check className="mx-auto text-green-400 mb-4" size={48} />
                  <h3 className="text-xl font-semibold text-green-300 mb-2">Hasła Zapisane!</h3>
                  <p className="text-blue-200">Dodałeś {myPlayer.passwords?.length || 0} haseł</p>
                  <div className="mt-4 space-y-2">
                    {myPlayer.passwords?.map((password, index) => (
                      <div key={index} className="bg-white/20 rounded-lg px-3 py-2 text-white">
                        {password}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  <textarea
                    value={myPasswords}
                    onChange={(e) => setMyPasswords(e.target.value)}
                    placeholder="Wpisz swoje hasła, każde w nowej linii:&#10;Samochód&#10;Książka&#10;Telefon&#10;..."
                    rows={10}
                    className="w-full px-4 py-3 rounded-xl bg-white/20 text-white placeholder-blue-200 border border-white/30 focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none mb-4"
                  />
                  <p className="text-blue-200 text-sm mb-4">
                    {myPasswords.split('\n').filter(p => p.trim()).length} haseł
                  </p>
                  <button
                    onClick={saveMyPasswords}
                    className="w-full px-6 py-4 bg-green-500 hover:bg-green-600 text-white rounded-xl font-bold text-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <Plus size={20} />
                    Zapisz Hasła
                  </button>
                </>
              )}
            </div>

            {/* Status innych graczy */}
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
              <h2 className="text-2xl font-semibold text-white mb-6">Status Graczy</h2>
              
              <div className="space-y-3 mb-6">
                {allPlayers.map((player) => (
                  <div key={player.name} className="flex items-center justify-between bg-white/20 rounded-lg px-4 py-3">
                    <span className="text-white font-medium flex items-center gap-2">
                      {player.isHost && <Crown size={16} className="text-yellow-300" />}
                      {player.name}
                    </span>
                    <div className="flex items-center gap-2">
                      {player.setupComplete ? (
                        <>
                          <Check className="text-green-400" size={16} />
                          <span className="text-green-300 text-sm">
                            {player.passwords?.length || 0} haseł
                          </span>
                        </>
                      ) : (
                        <span className="text-yellow-300 text-sm">Dodaje hasła...</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {isHost && completedPlayers === allPlayers.length && (
                <button
                  onClick={startGame}
                  className="w-full px-6 py-4 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-bold text-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Play size={20} />
                  Rozpocznij Grę!
                </button>
              )}

              {!isHost && (
                <div className="text-center">
                  <p className="text-blue-200">
                    Gdy wszyscy skończą, host rozpocznie grę
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (gameData.state === 'playing') {
    // Gra w toku
    const playerNames = Object.keys(gameData.players);
    const currentActivePlayer = playerNames[gameData.activePlayerIndex];
    const questions = Object.values(gameData.questions || {}).sort((a, b) => b.timestamp - a.timestamp);
    const activeQuestion = gameData.currentQuestionId ? gameData.questions[gameData.currentQuestionId] : null;
    const isMyTurn = currentActivePlayer === playerName;
    const needsToAnswer = activeQuestion && !activeQuestion.answers[playerName] && activeQuestion.player !== playerName;
    const myQuestions = questions.filter(q => q.player === playerName);

    return (
      <div className="min-h-screen bg-gradient-to-br from-green-600 via-blue-600 to-purple-600 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-white mb-2">🎯 Gra w Toku</h1>
            <p className="text-blue-100">
              {needsToAnswer 
                ? `Odpowiedz na pytanie od ${activeQuestion.player}`
                : activeQuestion && !activeQuestion.isComplete
                ? `Czekamy na odpowiedzi...`
                : `Kolej gracza: ${currentActivePlayer}`
              }
            </p>
          </div>

          {/* Tabs */}
          <div className="flex justify-center mb-6">
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-2 border border-white/20">
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveTab('game')}
                  className={`px-4 py-2 rounded-xl transition-colors flex items-center gap-2 ${
                    activeTab === 'game' 
                      ? 'bg-blue-500 text-white' 
                      : 'text-blue-200 hover:text-white'
                  }`}
                >
                  <Target size={16} />
                  Gra
                </button>
                <button
                  onClick={() => setActiveTab('passwords')}
                  className={`px-4 py-2 rounded-xl transition-colors flex items-center gap-2 ${
                    activeTab === 'passwords' 
                      ? 'bg-blue-500 text-white' 
                      : 'text-blue-200 hover:text-white'
                  }`}
                >
                  <Eye size={16} />
                  Hasła
                </button>
                <button
                  onClick={() => setActiveTab('history')}
                  className={`px-4 py-2 rounded-xl transition-colors flex items-center gap-2 ${
                    activeTab === 'history' 
                      ? 'bg-blue-500 text-white' 
                      : 'text-blue-200 hover:text-white'
                  }`}
                >
                  <History size={16} />
                  Moje Pytania ({myQuestions.length})
                </button>
              </div>
            </div>
          </div>

          {activeTab === 'game' && (
            <div className="space-y-6">
              {/* Aktualne pytanie */}
              {activeQuestion && (
                <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                  <h2 className="text-xl font-semibold text-white mb-4">
                    Pytanie od {activeQuestion.player}:
                  </h2>
                  <div className="bg-blue-500/20 border border-blue-500/50 rounded-xl p-4 mb-4">
                    <p className="text-white text-lg">{activeQuestion.question}</p>
                  </div>

                  {needsToAnswer ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={answerText}
                        onChange={(e) => setAnswerText(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && answerQuestion(activeQuestion.id, answerText)}
                        placeholder="Twoja odpowiedź..."
                        className="flex-1 px-4 py-3 rounded-xl bg-white/20 text-white placeholder-blue-200 border border-white/30 focus:outline-none focus:ring-2 focus:ring-blue-300"
                      />
                      <button
                        onClick={() => answerQuestion(activeQuestion.id, answerText)}
                        disabled={!answerText.trim()}
                        className="px-6 py-3 bg-green-500 hover:bg-green-600 disabled:bg-gray-500 text-white rounded-xl transition-colors"
                      >
                        <Send size={20} />
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <h3 className="text-white font-medium">Odpowiedzi:</h3>
                      {playerNames
                        .filter(name => name !== activeQuestion.player)
                        .map(name => (
                          <div key={name} className="bg-white/20 rounded-lg px-4 py-2 flex justify-between">
                            <span className="text-white font-medium">{name}:</span>
                            <span className="text-blue-300">
                              {activeQuestion.answers[name] || 'Jeszcze nie odpowiedział...'}
                            </span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )}

              {/* Interface zadawania pytań */}
              {!activeQuestion && isMyTurn && (
                <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                  <h2 className="text-xl font-semibold text-white mb-4">Twoja kolej! Zadaj pytanie:</h2>
                  <p className="text-blue-200 mb-4">
                    Twoje hasło: <span className="text-yellow-300 font-bold">
                      {gameData.players[playerName]?.assignedPassword}
                    </span>
                  </p>
                  
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={questionInput}
                      onChange={(e) => setQuestionInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && askQuestion()}
                      placeholder="Zadaj pytanie do wszystkich..."
                      className="flex-1 px-4 py-3 rounded-xl bg-white/20 text-white placeholder-blue-200 border border-white/30 focus:outline-none focus:ring-2 focus:ring-blue-300"
                    />
                    <button
                      onClick={askQuestion}
                      disabled={!questionInput.trim()}
                      className="px-6 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-500 text-white rounded-xl transition-colors"
                    >
                      <Send size={20} />
                    </button>
                  </div>
                </div>
              )}

              {!activeQuestion && !isMyTurn && (
                <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 text-center">
                  <MessageCircle className="mx-auto text-blue-300 mb-2" size={32} />
                  <p className="text-blue-200">Czekaj na swoją kolej...</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'passwords' && (
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
              <h2 className="text-xl font-semibold text-white mb-6">🔍 Hasła Przeciwników</h2>
              <div className="grid md:grid-cols-2 gap-4">
                {playerNames
                  .filter(name => name !== playerName)
                  .map((player) => (
                    <div key={player} className="bg-white/20 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-white font-medium">{player}</span>
                        <button
                          onClick={() => togglePasswordVisibility(player)}
                          className="text-blue-300 hover:text-blue-100"
                        >
                          {showPasswords[player] ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      <div className="text-sm">
                        {showPasswords[player] ? (
                          <span className="text-yellow-300 font-medium">
                            {gameData.players[player]?.assignedPassword}
                          </span>
                        ) : (
                          <span className="text-blue-200">Hasło ukryte</span>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
              <h2 className="text-xl font-semibold text-white mb-6">📝 Moje Pytania i Odpowiedzi</h2>
              {myQuestions.length === 0 ? (
                <p className="text-blue-200 text-center">Nie zadałeś jeszcze żadnych pytań</p>
              ) : (
                <div className="space-y-4">
                  {myQuestions.map((question) => (
                    <div key={question.id} className="bg-white/20 rounded-lg p-4">
                      <div className="text-white font-medium mb-2">
                        Pytanie: {question.question}
                      </div>
                      <div className="space-y-1">
                        {playerNames
                          .filter(name => name !== playerName)
                          .map(name => (
                            <div key={name} className="text-sm flex justify-between">
                              <span className="text-blue-300">{name}:</span>
                              <span className="text-white">
                                {question.answers[name] || 'Brak odpowiedzi'}
                              </span>
                            </div>
                          ))}
                      </div>
                      <div className="text-xs text-blue-400 mt-2">
                        Status: {question.isComplete ? 'Wszyscy odpowiedzieli' : 'Oczekuje na odpowiedzi'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (gameData.state === 'finished') {
    // Koniec gry
    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-400 via-orange-500 to-red-500 p-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
            <Trophy className="mx-auto text-yellow-300 mb-4" size={64} />
            <h1 className="text-4xl font-bold text-white mb-4">🎉 Koniec Gry!</h1>
            <h2 className="text-3xl font-semibold text-yellow-300 mb-6">
              Wygrał: {gameData.winner}!
            </h2>
            
            <div className="bg-white/20 rounded-xl p-6 mb-6">
              <h3 className="text-xl font-semibold text-white mb-4">Hasła w grze</h3>
              <div className="grid md:grid-cols-2 gap-4">
                {Object.entries(gameData.players).map(([name, player]) => (
                  <div key={name} className="bg-white/20 rounded-lg p-3">
                    <div className="text-white font-medium">{name}</div>
                    <div className="text-yellow-300">
                      Hasło: {player.assignedPassword}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={resetGame}
              className="px-8 py-4 bg-blue-500 hover:bg-blue-600 text-white rounded-2xl text-xl font-bold transition-colors"
            >
              Nowa Gra
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}