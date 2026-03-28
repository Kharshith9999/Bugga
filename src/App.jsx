import { useState, useEffect, useCallback, useRef } from 'react';
import './index.css';

const GRAVITY = 0.6;
const JUMP_STRENGTH = -9;
const PIPE_SPEED = 4;
const PIPE_WIDTH = 180; // Doubled size to better display custom photos
const PIPE_GAP = 280; // MUCH Larger gap for easier play
const BIRD_WIDTH = 50;
const BIRD_HEIGHT = 40;

function App() {
  const [dimensions, setDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  const [gameState, setGameState] = useState('START'); // START, PLAYING, DYING, GAME_OVER
  const [birdPos, setBirdPos] = useState(dimensions.height / 2);
  const [birdVelocity, setBirdVelocity] = useState(0);
  const [pipes, setPipes] = useState([]);
  const [score, setScore] = useState(0);
  const [flash, setFlash] = useState(false);
  const requestRef = useRef();
  
  // Audio setup
  const loseSound = useRef(null);

  useEffect(() => {
    // Look for user's sound
    loseSound.current = new Audio('/voice_when_lose.ogg');

    // Handle full screen resizing dynamically
    const handleResize = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const triggerCrash = () => {
    if (loseSound.current) {
      loseSound.current.currentTime = 0;
      loseSound.current.play().catch(e => console.log('Audio play failed: ', e));
    }
    // Visually flash the screen white
    setFlash(true);
    setTimeout(() => setFlash(false), 150);
  };

  const resetGame = () => {
    setBirdPos(dimensions.height / 2);
    setBirdVelocity(0);
    setPipes([]);
    setScore(0);
    setGameState('PLAYING');
  };

  const jump = useCallback((e) => {
    if (e && e.preventDefault) e.preventDefault(); 
    
    if (gameState === 'PLAYING') {
      setBirdVelocity(JUMP_STRENGTH);
    } else if (gameState === 'START' || gameState === 'GAME_OVER') {
      resetGame();
    }
  }, [gameState, dimensions]);

  // Handle Spacebar
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        jump(e);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [jump]);

  // Game Loop
  const gameLoop = useCallback(() => {
    // If we are completely dead or not playing, do nothing
    if (gameState !== 'PLAYING' && gameState !== 'DYING') return;

    setBirdVelocity((prevVel) => prevVel + GRAVITY);

    setBirdPos((prevPos) => {
      const newPos = prevPos + birdVelocity;
      
      // Floor collision - immediate game over
      if (newPos > dimensions.height - BIRD_HEIGHT) {
        if (gameState === 'PLAYING') triggerCrash();
        setGameState('GAME_OVER');
        return dimensions.height - BIRD_HEIGHT;
      }
      
      // Ceiling collision - starts dying sequence
      if (newPos < 0 && gameState === 'PLAYING') {
        triggerCrash();
        setGameState('DYING');
        return 0;
      }
      return newPos;
    });

    // Only move the pipes forwards if we haven't crashed yet
    if (gameState === 'PLAYING') {
      setPipes((prevPipes) => {
        let newPipes = prevPipes
          .map(pipe => ({ ...pipe, x: pipe.x - PIPE_SPEED }))
          .filter(pipe => pipe.x + PIPE_WIDTH > 0);

        // Spawn new pipes, scaled for responsive widths
        if (newPipes.length === 0 || newPipes[newPipes.length - 1].x < dimensions.width - 400) {
          const minHeight = 80;
          const maxHeight = dimensions.height - PIPE_GAP - minHeight;
          const topHeight = Math.floor(Math.random() * (maxHeight - minHeight + 1)) + minHeight;

          newPipes.push({
            x: dimensions.width,
            topHeight: topHeight,
            passed: false
          });
        }

        return newPipes;
      });
    }

  }, [birdVelocity, gameState, dimensions]);

  // Loop request
  useEffect(() => {
    if (gameState === 'PLAYING' || gameState === 'DYING') {
      requestRef.current = requestAnimationFrame(gameLoop);
    }
    return () => cancelAnimationFrame(requestRef.current);
  }, [gameLoop, gameState]);

  // Collision logic
  useEffect(() => {
    if (gameState !== 'PLAYING') return;

    pipes.forEach((pipe) => {
      const birdLeft = dimensions.width / 2 - BIRD_WIDTH / 2;
      const birdRight = birdLeft + BIRD_WIDTH;
      const birdTop = birdPos;
      const birdBottom = birdPos + BIRD_HEIGHT;

      const pipeLeft = pipe.x;
      const pipeRight = pipe.x + PIPE_WIDTH;

      const topPipeBottom = pipe.topHeight;
      const bottomPipeTop = pipe.topHeight + PIPE_GAP;

      // Intersects pipe bounding box (forgiving hitbox by 6 pixels for easier play)
      if (birdRight - 6 > pipeLeft && birdLeft + 6 < pipeRight) {
        if (birdTop + 6 < topPipeBottom || birdBottom - 6 > bottomPipeTop) {
          triggerCrash();
          setGameState('DYING'); // start the death free-fall animation sequence
        }
      }

      // Passed the pipe without hitting
      if (pipe.x + PIPE_WIDTH < birdLeft && !pipe.passed) {
        setScore(prev => prev + 1);
        pipe.passed = true;
      }
    });

  }, [birdPos, pipes, gameState, dimensions]);

  // Smooth death dive or regular angle scaling
  let birdRotation = Math.min(birdVelocity * 4, 90);
  if (gameState === 'DYING') birdRotation = 90; // Point straight down during death fall

  return (
    <div className="app-container">
      <div 
        className="game-container" 
        onMouseDown={jump}
        onTouchStart={jump}
        style={{
          width: dimensions.width,
          height: dimensions.height,
        }}
      >
        <div className={`background-layer ${gameState === 'PLAYING' ? 'moving' : ''}`}></div>

        {pipes.map((pipe, index) => (
          <div key={index}>
            {/* Top Pipe */}
            <div 
              className="pipe pipe-top"
              style={{
                left: pipe.x,
                width: PIPE_WIDTH,
                height: pipe.topHeight,
              }}
            >
              <img src="/image_on_pipe.jpeg" alt="pipe" onError={(e) => e.target.style.display = 'none'} />
            </div>

            {/* Bottom Pipe */}
            <div 
              className="pipe pipe-bottom"
              style={{
                left: pipe.x,
                width: PIPE_WIDTH,
                top: pipe.topHeight + PIPE_GAP,
                height: dimensions.height - (pipe.topHeight + PIPE_GAP),
              }}
            >
              <img src="/image_on_pipe.jpeg" alt="pipe" onError={(e) => e.target.style.display = 'none'} />
            </div>
          </div>
        ))}

        {/* Bird Component */}
        <div 
          className="bird"
          style={{
            top: birdPos,
            left: dimensions.width / 2 - BIRD_WIDTH / 2,
            width: BIRD_WIDTH,
            height: BIRD_HEIGHT,
            transform: `rotate(${birdRotation}deg)`,
            transition: gameState === 'DYING' ? 'transform 0.4s ease-in' : 'transform 0.05s ease-out'
          }}
        >
          <img src="/bird.png" alt="bird" onError={(e) => e.target.style.display = 'none'} />
        </div>

        {/* Camera Flash effect when dying */}
        {flash && <div className="flash-overlay"></div>}

        {/* HUD UI Layer */}
        <div className="ui-layer">
          {(gameState === 'START' || gameState === 'PLAYING' || gameState === 'DYING') && (
            <h1 className="score-text">{score}</h1>
          )}

          {gameState === 'START' && (
            <div className="menu-card" onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
              <h2>Flappy Clone</h2>
              <p>Tap, Click, or press Space to jump</p>
              <button onMouseDown={jump} onTouchStart={jump}>Start Game</button>
            </div>
          )}

          {gameState === 'GAME_OVER' && (
            <div className="menu-card anim-slide-down" onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
              <h2 className="text-red">Game Over</h2>
              
              <div className="score-board">
                <p>SCORE</p>
                <h3>{score}</h3>
              </div>

              <button onMouseDown={jump} onTouchStart={jump}>Play Again</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
