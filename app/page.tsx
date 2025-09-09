'use client';

import React, { useState, useEffect } from 'react';
import { Users, Play, Send, Trophy, Eye, EyeOff } from 'lucide-react';

export default function PasswordGuessingGame() {
  const [gameState, setGameState] = useState('setup'); // setup, playing, finished
  const [players, setPlayers] = useState<string[]>([]);
  const [currentPlayer, setCurrentPlayer] = useState('');
  const [passwordPool, setPasswordPool] = useState('');
  const [passwords, setPasswords] = useState<string[]>([]);
  const [assignedPasswords, setAssignedPasswords] = useState<{[key: string]: string}>({});
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [conversation, setConversation] = useState<any[]>([]);
  const [activePlayerIndex, setActivePlayerIndex] = useState(0);
  const [winner, setWinner] = useState<string | null>(null);
  const [showPasswords, setShowPasswords] = useState<{[key: string]: boolean}>({});

  const addPlayer = () => {
    if (currentPlayer.trim() && !players.includes(currentPlayer.trim())) {
      setPlayers([...players, currentPlayer.trim()]);
      setCurrentPlayer('');
    }
  };

  const removePlayer = (playerToRemove: string) => {
    setPlayers(players.filter(player => player !== playerToRemove));
  };

  const startGame = () => {
    if (players.length < 2) {
      alert('Potrzebujesz co najmniej 2 graczy!');
      return;
    }
    
    const passwordList = passwordPool
      .split('\n')
      .map(p => p.trim())
      .filter(p => p.length > 0);
    
    if (passwordList.length < players.length) {
      alert('Potrzebujesz co najmniej tyle haseł ile masz graczy!');
      return;
    }

    // Losowe przypisanie haseł
    const shuffledPasswords = [...passwordList].sort(() => Math.random() - 0.5);
    const assigned: {[key: string]: string} = {};
    players.forEach((player, index) => {
      assigned[player] = shuffledPasswords[index];
    });

    setPasswords(passwordList);
    setAssignedPasswords(assigned);
    setGameState('playing');
    setActivePlayerIndex(0);
  };

  const submitQuestion = () => {
    if (!currentQuestion.trim()) return;

    const askingPlayer = players[activePlayerIndex];
    const targetPlayer = players[(activePlayerIndex + 1) % players.length];
    const targetPassword = assignedPasswords[targetPlayer];

    // Sprawdź czy pytanie zawiera słowo z hasła
    const passwordWords = targetPassword.toLowerCase().split(/\s+/);
    const questionWords = currentQuestion.toLowerCase().split(/\s+/);
    const foundWord = passwordWords.find(pw => questionWords.includes(pw));

    if (foundWord) {
      setWinner(askingPlayer);
      setGameState('finished');
      setConversation([...conversation, {
        player: askingPlayer,
        question: currentQuestion,
        answer: `WYGRANA! Trafiłeś słowo "${foundWord}" z hasła "${targetPassword}"!`,
        type: 'win'
      }]);
    } else {
      setConversation([...conversation, {
        player: askingPlayer,
        target: targetPlayer,
        question: currentQuestion,
        password: targetPassword,
        type: 'question'
      }]);
    }

    setCurrentQuestion('');
  };

  const answerQuestion = (answer: string) => {
    const lastQuestion = conversation[conversation.length - 1];
    if (lastQuestion && lastQuestion.type === 'question') {
      setConversation([...conversation.slice(0, -1), {
        ...lastQuestion,
        answer: answer,
        type: 'answered'
      }]);
      setActivePlayerIndex((activePlayerIndex + 1) % players.length);
    }
  };

  const togglePasswordVisibility = (player: string) => {
    setShowPasswords({
      ...showPasswords,
      [player]: !showPasswords[player]
    });
  };

  const resetGame = () => {
    setGameState('setup');
    setPlayers([]);
    setPasswordPool('');
    setPasswords([]);
    setAssignedPasswords({});
    setConversation([]);
    setActivePlayerIndex(0);
    setWinner(null);
    setShowPasswords({});
  };

  if (gameState === 'setup') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-blue-600 to-teal-500 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-4">🎯 Gra w Zgadywanie Haseł</h1>
            <p className="text-blue-100 text-lg">Dodaj graczy i hasła, a następnie rozpocznij zabawę!</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Sekcja graczy */}
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
              <div className="flex items-center gap-2 mb-6">
                <Users className="text-white" size={24} />
                <h2 className="text-2xl font-semibold text-white">Gracze</h2>
              </div>
              
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={currentPlayer}
                  onChange={(e) => setCurrentPlayer(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addPlayer()}
                  placeholder="Wpisz nick gracza..."
                  className="flex-1 px-4 py-3 rounded-xl bg-white/20 text-white placeholder-blue-200 border border-white/30 focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
                <button
                  onClick={addPlayer}
                  className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl transition-colors font-medium"
                >
                  Dodaj
                </button>
              </div>

              <div className="space-y-2">
                {players.map((player, index) => (
                  <div key={player} className="flex items-center justify-between bg-white/20 rounded-lg px-4 py-2">
                    <span className="text-white font-medium">{index + 1}. {player}</span>
                    <button
                      onClick={() => removePlayer(player)}
                      className="text-red-300 hover:text-red-100 text-sm"
                    >
                      Usuń
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Sekcja haseł */}
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
            </div>
          </div>

          <div className="text-center mt-8">
            <button
              onClick={startGame}
              disabled={players.length < 2}
              className="inline-flex items-center gap-2 px-8 py-4 bg-green-500 hover:bg-green-600 disabled:bg-gray-500 disabled:cursor-not-allowed text-white rounded-2xl text-xl font-bold transition-colors"
            >
              <Play size={24} />
              Rozpocznij Grę!
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (gameState === 'finished') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-400 via-orange-500 to-red-500 p-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
            <Trophy className="mx-auto text-yellow-300 mb-4" size={64} />
            <h1 className="text-4xl font-bold text-white mb-4">🎉 Koniec Gry!</h1>
            <h2 className="text-3xl font-semibold text-yellow-300 mb-6">
              Wygrał: {winner}!
            </h2>
            
            <div className="bg-white/20 rounded-xl p-6 mb-6">
              <h3 className="text-xl font-semibold text-white mb-4">Historia Gry</h3>
              <div className="space-y-3 text-left">
                {conversation.map((entry, index) => (
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

  // Stan gry
  const currentActivePlayer = players[activePlayerIndex];
  const lastQuestion = conversation[conversation.length - 1];
  const waitingForAnswer = lastQuestion && lastQuestion.type === 'question';

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-600 via-blue-600 to-purple-600 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">🎯 Gra w Toku</h1>
          <p className="text-blue-100">
            {waitingForAnswer 
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
              {players.map((player) => (
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
                      <span className="text-yellow-300 font-medium">Hasło: {assignedPasswords[player]}</span>
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
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Interface zadawania pytań lub odpowiadania */}
            {waitingForAnswer ? (
              <div className="space-y-4">
                <p className="text-white text-center">
                  <strong>{lastQuestion.target}</strong>, odpowiedz na pytanie: 
                  <em className="text-yellow-300"> "{lastQuestion.question}"</em>
                </p>
                <p className="text-blue-200 text-center text-sm">
                  Twoje hasło: <strong>{lastQuestion.password}</strong>
                </p>
                <div className="flex gap-2 justify-center">
                  <button
                    onClick={() => answerQuestion('Tak')}
                    className="px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-medium transition-colors"
                  >
                    Tak
                  </button>
                  <button
                    onClick={() => answerQuestion('Nie')}
                    className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium transition-colors"
                  >
                    Nie
                  </button>
                  <button
                    onClick={() => answerQuestion('Możliwe')}
                    className="px-6 py-3 bg-yellow-500 hover:bg-yellow-600 text-white rounded-xl font-medium transition-colors"
                  >
                    Możliwe
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-white text-center">
                  <strong>{currentActivePlayer}</strong>, zadaj pytanie następnemu graczowi!
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={currentQuestion}
                    onChange={(e) => setCurrentQuestion(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && submitQuestion()}
                    placeholder="Wpisz swoje pytanie..."
                    className="flex-1 px-4 py-3 rounded-xl bg-white/20 text-white placeholder-blue-200 border border-white/30 focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                  <button
                    onClick={submitQuestion}
                    className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium transition-colors"
                  >
                    <Send size={20} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="text-center mt-6">
          <button
            onClick={resetGame}
            className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium transition-colors"
          >
            Zakończ Grę
          </button>
        </div>
      </div>
    </div>
  );
}