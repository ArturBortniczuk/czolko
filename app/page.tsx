'use client';

import { useState, useEffect } from 'react';
import { database, gameUtils } from '../lib/firebase';
import { ref, onValue, off, push, set } from 'firebase/database';
import { 
  Play, Users, Eye, EyeOff, Trophy, Copy, Check, 
  MessageCircle, Send, Crown, UserPlus 
} from 'lucide-react';

type GameState = 'lobby' | 'setup' | 'playing' | 'finished';

interface Player {
  name: string;
  password: string;
  isHost: boolean;
  joinedAt: number;
}

interface Message {
  player: string;
  target?: string;
  question: string;
  answer?: string;
  password?: string;
  type: 'question' | 'answered' | 'win';
  timestamp: number;
}

interface GameData {
  host: string;
  state: GameState;
  players: { [key: string]: Player };
  passwords: string[];
  conversation: Message[];
  activePlayerIndex: number;
  winner: string | null;
  assignedPasswords?: { [key: string]: string };
}

export default function MultiplayerGame() {
  // Stan lokalny
  const [gameCode, setGameCode] = useState<string>('');
  const [playerName, setPlayerName] = useState<string>('');
  const [joinCode, setJoinCode] = useState<string>('');
  const [isHost, setIsHost] = useState<boolean>(false);
  const [gameData, setGameData] = useState<GameData | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  
  // Stan setup (tylko dla hosta)
  const [passwordPool, setPasswordPool] = useState<string>('');
  
  // Stan gry
  const [currentQuestion, setCurrentQuestion] = useState<string>('');
  const [targetPlayer, setTargetPlayer] = useState<string>('');
  const [answerText, setAnswerText] = useState<string>('');
  const [showPasswords, setShowPasswords] = useState<{ [key: string]: boolean }>({});

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

  // Rozpoczęcie gry (tylko host)
  const startGame = async () => {
    if (!gameData || !isHost) return;

    const passwords = passwordPool
      .split('\n')
      .map(p => p.trim())
      .filter(p => p.length > 0);

    if (passwords.length < Object.keys(gameData.players).length) {
      alert('Za mało haseł! Dodaj więcej haseł niż graczy.');
      return;
    }

    // Przypisz hasła graczom
    const playerNames = Object.keys(gameData.players);
    const shuffledPasswords = [...passwords].sort(() => Math.random() - 0.5);
    const assignedPasswords: { [key: string]: string } = {};
    
    playerNames.forEach((name, index) => {
      assignedPasswords[name] = shuffledPasswords[index];
    });

    const updatedGameData = {
      ...gameData,
      state: 'playing' as GameState,
      passwords,
      assignedPasswords,
      activePlayerIndex: 0
    };

    await gameUtils.updateGameState(gameCode, updatedGameData);
  };

  // Zadawanie pytania
  const askQuestion = async () => {
    if (!currentQuestion.trim() || !targetPlayer || !gameData) return;

    const askingPlayer = playerName;
    const targetPassword = gameData.assignedPasswords?.[targetPlayer] || '';

    // Sprawdź czy gracz zgadł hasło
    const foundWords = targetPassword.toLowerCase().split(' ');
    const questionWords = currentQuestion.toLowerCase().split(' ');
    const foundWord = foundWords.find(word => 
      questionWords.some(qWord => qWord.includes(word) && word.length > 2)
    );

    if (foundWord) {
      // Gracz wygrał!
      const winMessage: Message = {
        player: askingPlayer,
        target: targetPlayer,
        question: currentQuestion,
        answer: `Trafiłeś słowo "${foundWord}" z hasła "${targetPassword}"!`,
        password: targetPassword,
        type: 'win',
        timestamp: Date.now()
      };

      await gameUtils.addMessage(gameCode, winMessage);
      
      const updatedGameData = {
        ...gameData,
        state: 'finished' as GameState,
        winner: askingPlayer
      };
      await gameUtils.updateGameState(gameCode, updatedGameData);
    } else {
      // Normalne pytanie
      const message: Message = {
        player: askingPlayer,
        target: targetPlayer,
        question: currentQuestion,
        type: 'question',
        timestamp: Date.now()
      };

      await gameUtils.addMessage(gameCode, message);
    }

    setCurrentQuestion('');
    setTargetPlayer('');
  };

  // Odpowiadanie na pytanie
  const answerQuestion = async (answer: string) => {
    if (!gameData) return;

    const conversation = Object.values(gameData.conversation || {});
    const lastQuestion = conversation[conversation.length - 1];
    
    if (lastQuestion && lastQuestion.type === 'question') {
      const answeredMessage: Message = {
        ...lastQuestion,
        answer: answer,
        type: 'answered'
      };

      // Usuń stare pytanie i dodaj odpowiedź
      const gameRef = ref(database, `games/${gameCode}`);
      const conversationRef = ref(database, `games/${gameCode}/conversation`);
      
      // Aktualizuj indeks aktywnego gracza
      const playerNames = Object.keys(gameData.players);
      const newActiveIndex = (gameData.activePlayerIndex + 1) % playerNames.length;
      
      const updatedGameData = {
        ...gameData,
        activePlayerIndex: newActiveIndex
      };

      await Promise.all([
        push(conversationRef, answeredMessage),
        set(gameRef, updatedGameData)
      ]);
    }

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
    setPasswordPool('');
    setShowPasswords({});
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

          <div className="grid md:grid-cols-2 gap-8">
            {/* Lista graczy */}
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
              <div className="flex items-center gap-2 mb-6">
                <Users className="text-white" size={24} />
                <h2 className="text-2xl font-semibold text-white">Gracze ({Object.keys(gameData.players).length})</h2>
              </div>

              <div className="space-y-3">
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
            </div>

            {/* Setup haseł (tylko host) */}
            {isHost && (
              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                <h2 className="text-2xl font-semibold text-white mb-6">📝 Pula Haseł</h2>
                <textarea
                  value={passwordPool}
                  onChange={(e) => setPasswordPool(e.target.value)}
                  placeholder="Wpisz hasła, każde w nowej linii:&#10;Drzewo&#10;Samochód&#10;Książka&#10;..."
                  rows={10}
                  className="w-full px-4 py-3 rounded-xl bg-white/20 text-white placeholder-blue-200 border border-white/30 focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
                />
                <p className="text-blue-200 text-sm mt-2">
                  {passwordPool.split('\n').filter(p => p.trim()).length} haseł w puli
                </p>

                <button
                  onClick={startGame}
                  disabled={Object.keys(gameData.players).length < 2 || passwordPool.split('\n').filter(p => p.trim()).length < Object.keys(gameData.players).length}
                  className="w-full mt-4 px-6 py-4 bg-green-500 hover:bg-green-600 disabled:bg-gray-500 disabled:cursor-not-allowed text-white rounded-xl font-bold text-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Play size={20} />
                  Rozpocznij Grę!
                </button>
              </div>
            )}

            {!isHost && (
              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 flex items-center justify-center">
                <div className="text-center">
                  <Crown className="mx-auto text-yellow-300 mb-4" size={48} />
                  <h3 className="text-xl font-semibold text-white mb-2">Czekamy na hosta</h3>
                  <p className="text-blue-200">{gameData.host} przygotowuje hasła...</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (gameData.state === 'playing') {
    // Gra w toku
    const playerNames = Object.keys(gameData.players);
    const currentActivePlayer = playerNames[gameData.activePlayerIndex];
    const conversation = Object.values(gameData.conversation || {}).sort((a, b) => a.timestamp - b.timestamp);
    const lastQuestion = conversation[conversation.length - 1];
    const waitingForAnswer = lastQuestion && lastQuestion.type === 'question';
    const isMyTurn = currentActivePlayer === playerName;
    const needsToAnswer = waitingForAnswer && lastQuestion.target === playerName;

    return (
      <div className="min-h-screen bg-gradient-to-br from-green-600 via-blue-600 to-purple-600 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-white mb-2">🎯 Gra w Toku</h1>
            <p className="text-blue-100">
              {needsToAnswer 
                ? `Odpowiadasz na pytanie od ${lastQuestion.player}...`
                : waitingForAnswer 
                ? `${lastQuestion.target} odpowiada na pytanie...`
                : `Kolej gracza: ${currentActivePlayer}`
              }
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Panel graczy i ich haseł */}
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
              <h2 className="text-xl font-semibold text-white mb-4">👥 Gracze i Hasła</h2>
              <div className="space-y-3">
                {playerNames.map((player) => (
                  <div key={player} className="bg-white/20 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className={`font-medium ${player === currentActivePlayer ? 'text-yellow-300' : 'text-white'}`}>
                        {player} {player === currentActivePlayer ? '(aktywny)' : ''}
                      </span>
                      <button
                        onClick={() => togglePasswordVisibility(player)}
                        className="text-blue-300 hover:text-blue-100"
                      >
                        {showPasswords[player] ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    <div className="text-sm">
                      {showPasswords[player] ? (
                        <span className="text-yellow-300 font-medium">Hasło: {gameData.assignedPasswords?.[player]}</span>
                      ) : (
                        <span className="text-blue-200">Hasło ukryte</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Panel pytań i odpowiedzi */}
            <div className="lg:col-span-2 bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
              <h2 className="text-xl font-semibold text-white mb-4">💬 Rozmowa</h2>
              
              {/* Historia rozmowy */}
              <div className="bg-white/20 rounded-xl p-4 mb-6 h-64 overflow-y-auto">
                {conversation.length === 0 ? (
                  <p className="text-blue-200 text-center">Zadaj pierwsze pytanie, aby rozpocząć grę!</p>
                ) : (
                  <div className="space-y-3">
                    {conversation.map((entry, index) => (
                      <div key={index} className="border-b border-white/20 pb-2">
                        <div className="text-white font-medium">
                          {entry.player} → {entry.target}: {entry.question}
                        </div>
                        {entry.answer && (
                          <div className="text-blue-300 ml-4 mt-1">
                            Odpowiedź: {entry.answer}
                          </div>
                        )}
                        {entry.type === 'win' && (
                          <div className="text-green-300 ml-4 mt-1 font-bold">
                            🎉 WYGRAŁ!
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Interface zadawania pytań lub odpowiadania */}
              {needsToAnswer ? (
                <div className="space-y-4">
                  <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-xl p-4">
                    <p className="text-yellow-300 font-medium mb-2">
                      Pytanie od {lastQuestion.player}:
                    </p>
                    <p className="text-white">{lastQuestion.question}</p>
                  </div>
                  
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={answerText}
                      onChange={(e) => setAnswerText(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && answerQuestion(answerText)}
                      placeholder="Twoja odpowiedź..."
                      className="flex-1 px-4 py-3 rounded-xl bg-white/20 text-white placeholder-blue-200 border border-white/30 focus:outline-none focus:ring-2 focus:ring-blue-300"
                    />
                    <button
                      onClick={() => answerQuestion(answerText)}
                      disabled={!answerText.trim()}
                      className="px-6 py-3 bg-green-500 hover:bg-green-600 disabled:bg-gray-500 text-white rounded-xl transition-colors"
                    >
                      <Send size={20} />
                    </button>
                  </div>
                </div>
              ) : !waitingForAnswer && isMyTurn ? (
                <div className="space-y-4">
                  <p className="text-yellow-300 font-medium">Twoja kolej! Zadaj pytanie:</p>
                  
                  <select
                    value={targetPlayer}
                    onChange={(e) => setTargetPlayer(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-white/20 text-white border border-white/30 focus:outline-none focus:ring-2 focus:ring-blue-300"
                  >
                    <option value="">Wybierz gracza...</option>
                    {playerNames.filter(name => name !== playerName).map(name => (
                      <option key={name} value={name} className="text-black">{name}</option>
                    ))}
                  </select>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={currentQuestion}
                      onChange={(e) => setCurrentQuestion(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && askQuestion()}
                      placeholder="Zadaj pytanie..."
                      className="flex-1 px-4 py-3 rounded-xl bg-white/20 text-white placeholder-blue-200 border border-white/30 focus:outline-none focus:ring-2 focus:ring-blue-300"
                    />
                    <button
                      onClick={askQuestion}
                      disabled={!currentQuestion.trim() || !targetPlayer}
                      className="px-6 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-500 text-white rounded-xl transition-colors"
                    >
                      <Send size={20} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <MessageCircle className="mx-auto text-blue-300 mb-2" size={32} />
                  <p className="text-blue-200">
                    {waitingForAnswer ? 'Czekamy na odpowiedź...' : 'Czekaj na swoją kolej...'}
                  </p>
                </div>
              )}
            </div>
          </div>
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
              <h3 className="text-xl font-semibold text-white mb-4">Historia Gry</h3>
              <div className="space-y-3 text-left">
                {Object.values(gameData.conversation || {}).sort((a, b) => a.timestamp - b.timestamp).map((entry, index) => (
                  <div key={index} className="bg-white/20 rounded-lg p-3">
                    {entry.type === 'win' ? (
                      <div className="text-yellow-300 font-bold">
                        {entry.player}: {entry.question}
                        <div className="text-green-300">{entry.answer}</div>
                      </div>
                    ) : (
                      <div className="text-white">
                        <div className="font-medium">{entry.player} → {entry.target}: {entry.question}</div>
                        {entry.answer && <div className="text-blue-300 ml-4">Odpowiedź: {entry.answer}</div>}
                      </div>
                    )}
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