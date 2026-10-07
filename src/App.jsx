import { useEffect } from "react";
import { useAuth } from "./context/AuthContext";
import { useGameState } from "./hooks/useGameState";
import AuthScreen from "./components/Auth/AuthScreen";
import Home    from "./components/Home/Home";
import Lobby   from "./components/Lobby/Lobby";
import Game    from "./components/Game/Game";
import Results from "./components/Results/Results";

export default function App() {
  const { user, isAuthenticated, isLoading, logout, refreshUser } = useAuth();

  const {
    // State
    screen,
    gameMode,
    questionMode,
    difficulty,
    mode,
    roomCode,
    playerName,
    playerSlots,
    players,
    currentQuestion,
    roundNumber,
    totalRounds,
    selectedAnswer,
    answerResult,
    roundResult,
    roundOver,
    timeRemaining,
    currentScore,
    singlePlayerStats,
    gameOverData,
    isHost,
    currentSocketId,
    isSelfReady,
    isSelfRematchReady,
    allRematchReady,
    error,
    toastMessage,
    // Actions
    setPlayerName,
    setDifficulty,
    clearError,
    leaveGame,
    startSinglePlayer,
    createGame,
    joinGame,
    toggleReady,
    toggleRematchReady,
    startGame,
    submitAnswer,
    playAgain,
  } = useGameState();

  // Sync authenticated user's name to player identity
  useEffect(() => {
    if (user?.name && playerName !== user.name) {
      setPlayerName(user.name);
    }
  }, [user, playerName, setPlayerName]);

  // Refresh user coin balance whenever returning to home or reaching results screen
  useEffect(() => {
    if (isAuthenticated && (screen === "home" || screen === "results")) {
      refreshUser();
    }
  }, [screen, isAuthenticated, refreshUser]);

  function handleLogout() {
    leaveGame();
    logout();
  }

  // ── Loading Screen ──
  if (isLoading) {
    return (
      <div className="screen" style={{ color: "var(--clr-text-secondary)", gap: 14 }}>
        <div
          style={{
            fontSize: "2.4rem",
            color: "var(--clr-primary)",
          }}
        >
          ⚡
        </div>
        <p style={{ fontWeight: 600, fontSize: "0.95rem", letterSpacing: "0.02em" }}>
          Authenticating Quiz Clash...
        </p>
      </div>
    );
  }

  // ── Protected Access: If unauthenticated, show Login/Register screen ──
  if (!isAuthenticated) {
    return <AuthScreen />;
  }

  return (
    <>
      {/* ── Toast Notification Banner ── */}
      {toastMessage && (
        <div
          style={{
            position: "fixed",
            top: 20,
            left: "50%",
            transform: "translateX(-50%)",
            background: "var(--clr-surface-2)",
            border: "1px solid var(--clr-border)",
            color: "#fff",
            padding: "8px 18px",
            borderRadius: "var(--radius-full)",
            fontSize: "0.85rem",
            fontWeight: 600,
            boxShadow: "var(--shadow-lg)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            gap: "8px",
            pointerEvents: "none",
            animation: "fadeIn 0.2s ease",
          }}
        >
          <span style={{ color: "var(--clr-primary)" }}>⚡</span> {toastMessage}
        </div>
      )}

      {/* ── Protected Screen Router ── */}
      {(() => {
        switch (screen) {
          case "home":
            return (
              <Home
                user={user}
                playerName={playerName || user?.name}
                difficulty={difficulty}
                onDifficultyChange={setDifficulty}
                onNameChange={setPlayerName}
                onStartSinglePlayer={startSinglePlayer}
                onCreateGame={createGame}
                onJoinGame={joinGame}
                onLogout={handleLogout}
                error={error}
                clearError={clearError}
              />
            );

          case "lobby":
            return (
              <Lobby
                mode={questionMode || mode}
                difficulty={difficulty}
                roomCode={roomCode}
                playerSlots={playerSlots}
                isHost={isHost}
                currentSocketId={currentSocketId}
                isSelfReady={isSelfReady}
                onToggleReady={toggleReady}
                onStartGame={startGame}
                onLeaveGame={leaveGame}
                error={error}
              />
            );

          case "game":
            return (
              <Game
                gameMode={gameMode}
                mode={questionMode || mode}
                difficulty={difficulty || currentQuestion?.difficulty}
                user={user}
                players={players}
                currentSocketId={currentSocketId}
                currentQuestion={currentQuestion}
                roundNumber={roundNumber}
                totalRounds={totalRounds}
                selectedAnswer={selectedAnswer}
                answerResult={answerResult}
                roundResult={roundResult}
                roundOver={roundOver}
                timeRemaining={timeRemaining}
                currentScore={currentScore}
                singlePlayerStats={singlePlayerStats}
                onSubmitAnswer={submitAnswer}
                onLeaveGame={leaveGame}
              />
            );

          case "results":
            return (
              <Results
                gameMode={gameMode}
                mode={questionMode || mode}
                difficulty={gameOverData?.difficulty || difficulty}
                user={user}
                gameOverData={gameOverData}
                singlePlayerStats={singlePlayerStats}
                players={players}
                currentSocketId={currentSocketId}
                isHost={isHost}
                isSelfRematchReady={isSelfRematchReady}
                allRematchReady={allRematchReady}
                totalRounds={totalRounds}
                onToggleRematchReady={toggleRematchReady}
                onStartRematch={startGame}
                onReturnToLobby={playAgain}
                onPlayAgain={playAgain}
                onBackToHome={leaveGame}
                onLeaveGame={leaveGame}
              />
            );

          default:
            return null;
        }
      })()}
    </>
  );
}
