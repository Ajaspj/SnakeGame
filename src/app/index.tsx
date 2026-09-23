import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  Animated,
  Dimensions,
  Easing,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// GAME CONFIGURATION

const GRID_SIZE = 20;

const BOARD_SIZE = Math.min(SCREEN_WIDTH - 16, 440);

const CELL_SIZE = BOARD_SIZE / GRID_SIZE;

const START_SPEED = 155;
const MIN_SPEED = 52;
const SPEED_STEP = 4;

const HIGH_SCORE_KEY = "SNAKE_FULL_SCREEN_HIGH_SCORE";

// TYPES

type Point = {
  x: number;
  y: number;
};

type Direction = "UP" | "DOWN" | "LEFT" | "RIGHT";

type GameStatus = "idle" | "countdown" | "playing" | "paused" | "gameover";

// CONSTANTS

const DIRECTIONS: Record<Direction, Point> = {
  UP: { x: 0, y: -1 },
  DOWN: { x: 0, y: 1 },
  LEFT: { x: -1, y: 0 },
  RIGHT: { x: 1, y: 0 },
};

const INITIAL_SNAKE: Point[] = [
  { x: 10, y: 10 },
  { x: 9, y: 10 },
  { x: 8, y: 10 },
  { x: 7, y: 10 },
];

// HELPERS

function getSpeed(score: number) {
  return Math.max(MIN_SPEED, START_SPEED - score * SPEED_STEP);
}

function getLevel(score: number) {
  return Math.floor(score / 5) + 1;
}

function isSamePoint(a: Point, b: Point) {
  return a.x === b.x && a.y === b.y;
}

function isOppositeDirection(current: Direction, next: Direction): boolean {
  return (
    (current === "UP" && next === "DOWN") ||
    (current === "DOWN" && next === "UP") ||
    (current === "LEFT" && next === "RIGHT") ||
    (current === "RIGHT" && next === "LEFT")
  );
}

function createFood(snake: Point[]): Point {
  const freeCells: Point[] = [];

  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const occupied = snake.some(
        (segment) => segment.x === x && segment.y === y,
      );

      if (!occupied) {
        freeCells.push({ x, y });
      }
    }
  }

  if (freeCells.length === 0) {
    return { x: 0, y: 0 };
  }

  return freeCells[Math.floor(Math.random() * freeCells.length)];
}

// COMPONENT

export default function SnakeGame() {
  // STATE

  const [snake, setSnake] = useState<Point[]>(INITIAL_SNAKE);

  const [food, setFood] = useState<Point>(() => createFood(INITIAL_SNAKE));

  const [direction, setDirection] = useState<Direction>("RIGHT");

  const [score, setScore] = useState(0);

  const [bestScore, setBestScore] = useState(0);

  const [gameStatus, setGameStatus] = useState<GameStatus>("idle");

  const [countdown, setCountdown] = useState(3);

  // REFS

  const snakeRef = useRef<Point[]>(INITIAL_SNAKE);

  const foodRef = useRef<Point>(food);

  const directionRef = useRef<Direction>("RIGHT");

  const nextDirectionRef = useRef<Direction>("RIGHT");

  const scoreRef = useRef(0);

  const bestScoreRef = useRef(0);

  const speedRef = useRef(START_SPEED);

  const gameStatusRef = useRef<GameStatus>("idle");

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ANIMATIONS

  const foodPulse = useRef(new Animated.Value(1)).current;

  const boardShake = useRef(new Animated.Value(0)).current;

  const screenFlash = useRef(new Animated.Value(0)).current;

  const particleOpacity = useRef(new Animated.Value(0)).current;

  const particleScale = useRef(new Animated.Value(0)).current;

  // PARTICLE POSITIONS

  const particles = useMemo(
    () =>
      Array.from({ length: 10 }, (_, index) => ({
        id: index,
        x: Math.cos((index / 10) * Math.PI * 2),
        y: Math.sin((index / 10) * Math.PI * 2),
      })),
    [],
  );

  // KEEP REFS UPDATED

  useEffect(() => {
    snakeRef.current = snake;
  }, [snake]);

  useEffect(() => {
    foodRef.current = food;
  }, [food]);

  useEffect(() => {
    directionRef.current = direction;
  }, [direction]);

  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  useEffect(() => {
    bestScoreRef.current = bestScore;
  }, [bestScore]);

  useEffect(() => {
    gameStatusRef.current = gameStatus;
  }, [gameStatus]);

  // LOAD HIGH SCORE

  useEffect(() => {
    loadHighScore();

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
    };
  }, []);

  const loadHighScore = async () => {
    try {
      const saved = await AsyncStorage.getItem(HIGH_SCORE_KEY);

      if (saved) {
        const parsed = Number(saved);

        if (!Number.isNaN(parsed)) {
          setBestScore(parsed);
          bestScoreRef.current = parsed;
        }
      }
    } catch (error) {
      console.log("Could not load high score:", error);
    }
  };

  // SAVE HIGH SCORE

  const saveHighScore = async (value: number) => {
    try {
      await AsyncStorage.setItem(HIGH_SCORE_KEY, String(value));
    } catch (error) {
      console.log("Could not save high score:", error);
    }
  };

  // FOOD ANIMATION

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(foodPulse, {
          toValue: 1.18,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),

        Animated.timing(foodPulse, {
          toValue: 1,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();

    return () => animation.stop();
  }, [foodPulse]);

  // PARTICLE EFFECT

  const playFoodEffect = useCallback(() => {
    particleOpacity.setValue(1);
    particleScale.setValue(0);

    Animated.parallel([
      Animated.timing(particleScale, {
        toValue: 1,
        duration: 350,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),

      Animated.timing(particleOpacity, {
        toValue: 0,
        duration: 350,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [particleOpacity, particleScale]);

  // GAME OVER EFFECT

  const playGameOverEffect = useCallback(() => {
    Animated.sequence([
      Animated.timing(boardShake, {
        toValue: 8,
        duration: 60,
        useNativeDriver: true,
      }),

      Animated.timing(boardShake, {
        toValue: -8,
        duration: 60,
        useNativeDriver: true,
      }),

      Animated.timing(boardShake, {
        toValue: 6,
        duration: 60,
        useNativeDriver: true,
      }),

      Animated.timing(boardShake, {
        toValue: -6,
        duration: 60,
        useNativeDriver: true,
      }),

      Animated.timing(boardShake, {
        toValue: 0,
        duration: 80,
        useNativeDriver: true,
      }),
    ]).start();

    Animated.sequence([
      Animated.timing(screenFlash, {
        toValue: 0.8,
        duration: 80,
        useNativeDriver: true,
      }),

      Animated.timing(screenFlash, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [boardShake, screenFlash]);

  // HAPTIC FOOD

  const foodHaptic = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
  };

  // HAPTIC GAME OVER

  const gameOverHaptic = async () => {
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } catch {}
  };

  // CHANGE DIRECTION

  const changeDirection = useCallback((newDirection: Direction) => {
    const currentDirection = directionRef.current;

    if (isOppositeDirection(currentDirection, newDirection)) {
      return;
    }

    nextDirectionRef.current = newDirection;
  }, []);

  // SWIPE CONTROLS

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,

        onMoveShouldSetPanResponder: () => true,

        onPanResponderRelease: (_, gesture) => {
          const { dx, dy } = gesture;

          const minimumSwipe = 20;

          if (Math.abs(dx) < minimumSwipe && Math.abs(dy) < minimumSwipe) {
            return;
          }

          if (Math.abs(dx) > Math.abs(dy)) {
            if (dx > 0) {
              changeDirection("RIGHT");
            } else {
              changeDirection("LEFT");
            }
          } else {
            if (dy > 0) {
              changeDirection("DOWN");
            } else {
              changeDirection("UP");
            }
          }
        },
      }),
    [changeDirection],
  );

  // GAME OVER

  const gameOver = useCallback(async () => {
    if (gameStatusRef.current === "gameover") {
      return;
    }

    gameStatusRef.current = "gameover";
    setGameStatus("gameover");

    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    playGameOverEffect();

    await gameOverHaptic();

    if (scoreRef.current > bestScoreRef.current) {
      bestScoreRef.current = scoreRef.current;
      setBestScore(scoreRef.current);

      await saveHighScore(scoreRef.current);
    }
  }, [playGameOverEffect]);

  // GAME TICK

  const gameTick = useCallback(() => {
    if (gameStatusRef.current !== "playing") {
      return;
    }

    const currentSnake = snakeRef.current;

    const currentFood = foodRef.current;

    const newDirection = nextDirectionRef.current;

    directionRef.current = newDirection;
    setDirection(newDirection);

    const movement = DIRECTIONS[newDirection];

    const head = currentSnake[0];

    const newHead = {
      x: head.x + movement.x,
      y: head.y + movement.y,
    };

    // WALL COLLISION

    if (
      newHead.x < 0 ||
      newHead.x >= GRID_SIZE ||
      newHead.y < 0 ||
      newHead.y >= GRID_SIZE
    ) {
      gameOver();
      return;
    }

    const eatingFood = isSamePoint(newHead, currentFood);

    // SELF COLLISION

    const bodyToCheck = eatingFood ? currentSnake : currentSnake.slice(0, -1);

    const hitSelf = bodyToCheck.some((segment) =>
      isSamePoint(segment, newHead),
    );

    if (hitSelf) {
      gameOver();
      return;
    }

    // MOVE SNAKE

    let newSnake = [newHead, ...currentSnake];

    // EAT FOOD

    if (eatingFood) {
      const newScore = scoreRef.current + 1;

      scoreRef.current = newScore;

      setScore(newScore);

      speedRef.current = getSpeed(newScore);

      const newFood = createFood(newSnake);

      foodRef.current = newFood;

      setFood(newFood);

      playFoodEffect();

      foodHaptic();
    } else {
      newSnake.pop();
    }

    snakeRef.current = newSnake;

    setSnake(newSnake);

    // NEXT TICK

    if (gameStatusRef.current === "playing") {
      timerRef.current = setTimeout(gameTick, speedRef.current);
    }
  }, [gameOver, playFoodEffect]);

  // START GAME LOOP

  const beginPlaying = useCallback(() => {
    gameStatusRef.current = "playing";
    setGameStatus("playing");

    speedRef.current = getSpeed(scoreRef.current);

    timerRef.current = setTimeout(gameTick, speedRef.current);
  }, [gameTick]);

  // COUNTDOWN

  const startCountdown = useCallback(() => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
    }

    setCountdown(3);

    gameStatusRef.current = "countdown";
    setGameStatus("countdown");

    let value = 3;

    countdownTimerRef.current = setInterval(() => {
      value--;

      if (value <= 0) {
        if (countdownTimerRef.current) {
          clearInterval(countdownTimerRef.current);
          countdownTimerRef.current = null;
        }

        beginPlaying();
      } else {
        setCountdown(value);
      }
    }, 800);
  }, [beginPlaying]);

  // RESET GAME

  const resetGame = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }

    const startingSnake = [...INITIAL_SNAKE];

    const startingFood = createFood(startingSnake);

    snakeRef.current = startingSnake;
    foodRef.current = startingFood;

    directionRef.current = "RIGHT";
    nextDirectionRef.current = "RIGHT";

    scoreRef.current = 0;

    speedRef.current = START_SPEED;

    setSnake(startingSnake);
    setFood(startingFood);
    setDirection("RIGHT");
    setScore(0);

    startCountdown();
  }, [startCountdown]);

  // PAUSE / RESUME

  const togglePause = () => {
    if (gameStatusRef.current === "playing") {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      gameStatusRef.current = "paused";
      setGameStatus("paused");

      return;
    }

    if (gameStatusRef.current === "paused") {
      gameStatusRef.current = "playing";
      setGameStatus("playing");

      timerRef.current = setTimeout(gameTick, speedRef.current);
    }
  };

  // RENDER SNAKE

  const renderSnake = () => {
    return snake.map((segment, index) => {
      const isHead = index === 0;

      return (
        <View
          key={`${segment.x}-${segment.y}-${index}`}
          style={[
            styles.snakeSegment,
            {
              left: segment.x * CELL_SIZE + 1,
              top: segment.y * CELL_SIZE + 1,
              width: CELL_SIZE - 2,
              height: CELL_SIZE - 2,
              borderRadius: isHead ? CELL_SIZE * 0.35 : CELL_SIZE * 0.25,
            },
            isHead ? styles.snakeHead : styles.snakeBody,
          ]}
        >
          {isHead && (
            <>
              <View style={[styles.eye, getEyePosition(direction, true)]} />

              <View style={[styles.eye, getEyePosition(direction, false)]} />
            </>
          )}
        </View>
      );
    });
  };

  // EYE POSITION

  const getEyePosition = (currentDirection: Direction, firstEye: boolean) => {
    const offset = CELL_SIZE * 0.23;

    if (currentDirection === "RIGHT") {
      return {
        right: offset * 0.3,
        top: firstEye ? offset : CELL_SIZE - offset * 1.7,
      };
    }

    if (currentDirection === "LEFT") {
      return {
        left: offset * 0.3,
        top: firstEye ? offset : CELL_SIZE - offset * 1.7,
      };
    }

    if (currentDirection === "UP") {
      return {
        top: offset * 0.3,
        left: firstEye ? offset : CELL_SIZE - offset * 1.7,
      };
    }

    return {
      bottom: offset * 0.3,
      left: firstEye ? offset : CELL_SIZE - offset * 1.7,
    };
  };

  // RENDER FOOD

  const renderFood = () => {
    return (
      <Animated.View
        style={[
          styles.food,
          {
            left: food.x * CELL_SIZE + 3,
            top: food.y * CELL_SIZE + 3,
            width: CELL_SIZE - 6,
            height: CELL_SIZE - 6,
            borderRadius: (CELL_SIZE - 6) / 2,
            transform: [
              {
                scale: foodPulse,
              },
            ],
          },
        ]}
      >
        <View style={styles.foodHighlight} />
      </Animated.View>
    );
  };

  // RENDER PARTICLES

  const renderParticles = () => {
    return particles.map((particle) => {
      const translateX = particleScale.interpolate({
        inputRange: [0, 1],
        outputRange: [0, particle.x * 28],
      });

      const translateY = particleScale.interpolate({
        inputRange: [0, 1],
        outputRange: [0, particle.y * 28],
      });

      return (
        <Animated.View
          key={particle.id}
          pointerEvents="none"
          style={[
            styles.particle,
            {
              opacity: particleOpacity,
              transform: [
                {
                  translateX,
                },
                {
                  translateY,
                },
              ],
            },
          ]}
        />
      );
    });
  };

  // LEVEL PROGRESS

  const level = getLevel(score);

  const levelProgress = (score % 5) / 5;

  // SPEED DISPLAY

  const speedPercent = Math.round(
    ((START_SPEED - speedRef.current) / (START_SPEED - MIN_SPEED)) * 100,
  );

  // MAIN UI

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      <StatusBar hidden />

      {/* =====================================================
          BACKGROUND
      ===================================================== */}

      <LinearGradient
        colors={["#050807", "#08110D", "#020403"]}
        style={StyleSheet.absoluteFill}
      />

      {/* =====================================================
          HEADER
      ===================================================== */}

      <View style={styles.header}>
        <View>
          <Text style={styles.gameTitle}>SNAKE</Text>

          <Text style={styles.subtitle}>ARCADE MODE</Text>
        </View>

        <View style={styles.scoreContainer}>
          <View style={styles.scoreBox}>
            <Text style={styles.scoreLabel}>SCORE</Text>

            <Text style={styles.scoreValue}>
              {String(score).padStart(4, "0")}
            </Text>
          </View>

          <View style={styles.scoreBox}>
            <Text style={styles.scoreLabel}>BEST</Text>

            <Text style={styles.bestValue}>
              {String(bestScore).padStart(4, "0")}
            </Text>
          </View>
        </View>
      </View>

      {/* =====================================================
          LEVEL BAR
      ===================================================== */}

      <View style={styles.levelRow}>
        <Text style={styles.levelText}>LEVEL {level}</Text>

        <View style={styles.levelTrack}>
          <View
            style={[
              styles.levelProgress,
              {
                width: `${Math.max(levelProgress * 100, 4)}%`,
              },
            ]}
          />
        </View>

        <Text style={styles.nextLevelText}>{5 - (score % 5)} FOOD</Text>
      </View>

      {/* =====================================================
          BOARD
      ===================================================== */}

      <Animated.View
        style={[
          styles.boardWrapper,
          {
            transform: [
              {
                translateX: boardShake,
              },
            ],
          },
        ]}
      >
        <View style={styles.board}>
          {/* Grid */}

          {Array.from({ length: GRID_SIZE + 1 }, (_, index) => (
            <View
              key={`v-${index}`}
              style={[
                styles.gridVertical,
                {
                  left: index * CELL_SIZE,
                },
              ]}
            />
          ))}

          {Array.from({ length: GRID_SIZE + 1 }, (_, index) => (
            <View
              key={`h-${index}`}
              style={[
                styles.gridHorizontal,
                {
                  top: index * CELL_SIZE,
                },
              ]}
            />
          ))}

          {/* Food */}

          {renderFood()}

          {/* Snake */}

          {renderSnake()}

          {/* Particles */}

          <View pointerEvents="none" style={styles.particleContainer}>
            {renderParticles()}
          </View>

          {/* =================================================
              IDLE OVERLAY
          ================================================= */}

          {gameStatus === "idle" && (
            <View style={styles.overlay}>
              <View style={styles.overlayCard}>
                <Text style={styles.overlayIcon}>🐍</Text>

                <Text style={styles.overlayTitle}>SNAKE</Text>

                <Text style={styles.overlayDescription}>
                  Swipe anywhere to control
                </Text>

                <TouchableOpacity
                  activeOpacity={0.8}
                  style={styles.startButton}
                  onPress={resetGame}
                >
                  <Text style={styles.startButtonText}>START GAME</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* =================================================
              COUNTDOWN OVERLAY
          ================================================= */}

          {gameStatus === "countdown" && (
            <View style={styles.overlay}>
              <Text style={styles.countdownText}>{countdown}</Text>

              <Text style={styles.countdownSubtext}>GET READY</Text>
            </View>
          )}

          {/* =================================================
              PAUSE OVERLAY
          ================================================= */}

          {gameStatus === "paused" && (
            <View style={styles.overlay}>
              <View style={styles.overlayCard}>
                <Text style={styles.pauseIcon}>II</Text>

                <Text style={styles.overlayTitle}>PAUSED</Text>

                <Text style={styles.overlayDescription}>Take a breath</Text>

                <TouchableOpacity
                  activeOpacity={0.8}
                  style={styles.startButton}
                  onPress={togglePause}
                >
                  <Text style={styles.startButtonText}>RESUME</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* =================================================
              GAME OVER OVERLAY
          ================================================= */}

          {gameStatus === "gameover" && (
            <View style={styles.overlay}>
              <View style={styles.overlayCard}>
                <Text style={styles.gameOverIcon}>×</Text>

                <Text style={styles.gameOverTitle}>GAME OVER</Text>

                <Text style={styles.finalScoreLabel}>FINAL SCORE</Text>

                <Text style={styles.finalScore}>{score}</Text>

                {score === bestScore && score > 0 && (
                  <Text style={styles.newBest}>NEW HIGH SCORE!</Text>
                )}

                <TouchableOpacity
                  activeOpacity={0.8}
                  style={styles.startButton}
                  onPress={resetGame}
                >
                  <Text style={styles.startButtonText}>PLAY AGAIN</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* Screen flash */}

        <Animated.View
          pointerEvents="none"
          style={[
            styles.flash,
            {
              opacity: screenFlash,
            },
          ]}
        />
      </Animated.View>

      {/* =====================================================
          INFORMATION
      ===================================================== */}

      <View style={styles.infoRow}>
        <View style={styles.infoBox}>
          <Text style={styles.infoLabel}>LEVEL</Text>

          <Text style={styles.infoValue}>{level}</Text>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoLabel}>LENGTH</Text>

          <Text style={styles.infoValue}>{snake.length}</Text>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoLabel}>SPEED</Text>

          <Text style={styles.infoValue}>
            {Math.min(speedPercent + 1, 100)}%
          </Text>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoLabel}>BEST</Text>

          <Text style={styles.infoValue}>{bestScore}</Text>
        </View>
      </View>

      {/* =====================================================
          PAUSE BUTTON
      ===================================================== */}

      {(gameStatus === "playing" || gameStatus === "paused") && (
        <TouchableOpacity
          activeOpacity={0.8}
          style={styles.pauseButton}
          onPress={togglePause}
        >
          <Text style={styles.pauseButtonText}>
            {gameStatus === "paused" ? "▶ RESUME" : "Ⅱ PAUSE"}
          </Text>
        </TouchableOpacity>
      )}

      {/* =====================================================
          FOOTER
      ===================================================== */}

      <View style={styles.footer}>
        <Text style={styles.footerText}>SWIPE TO MOVE</Text>

        <Text style={styles.footerDot}>•</Text>

        <Text style={styles.footerText}>EAT FOOD</Text>

        <Text style={styles.footerDot}>•</Text>

        <Text style={styles.footerText}>GROW</Text>
      </View>
    </View>
  );
}

// STYLES

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#030504",
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 20,
    overflow: "hidden",
  },

  // ----------------------------------------------------------
  // HEADER
  // ----------------------------------------------------------

  header: {
    width: "100%",
    paddingHorizontal: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },

  gameTitle: {
    color: "#A8FF78",
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: 5,
  },

  subtitle: {
    color: "#52665A",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 3,
    marginTop: 2,
  },

  scoreContainer: {
    flexDirection: "row",
    gap: 8,
  },

  scoreBox: {
    minWidth: 65,
    alignItems: "center",
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: "#0A130E",
    borderWidth: 1,
    borderColor: "#1A3021",
  },

  scoreLabel: {
    color: "#53695B",
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1,
  },

  scoreValue: {
    color: "#B6FF8A",
    fontSize: 17,
    fontWeight: "900",
    marginTop: 1,
  },

  bestValue: {
    color: "#FFD166",
    fontSize: 17,
    fontWeight: "900",
    marginTop: 1,
  },

  // ----------------------------------------------------------
  // LEVEL
  // ----------------------------------------------------------

  levelRow: {
    width: BOARD_SIZE,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 9,
  },

  levelText: {
    color: "#83C96B",
    fontSize: 10,
    fontWeight: "900",
    width: 55,
    letterSpacing: 1,
  },

  levelTrack: {
    flex: 1,
    height: 5,
    backgroundColor: "#102018",
    borderRadius: 5,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#183121",
  },

  levelProgress: {
    height: "100%",
    backgroundColor: "#79E35C",
    borderRadius: 5,
  },

  nextLevelText: {
    width: 62,
    textAlign: "right",
    color: "#425649",
    fontSize: 8,
    fontWeight: "800",
  },

  // ----------------------------------------------------------
  // BOARD
  // ----------------------------------------------------------

  boardWrapper: {
    width: BOARD_SIZE,
    height: BOARD_SIZE,
  },

  board: {
    width: BOARD_SIZE,
    height: BOARD_SIZE,
    backgroundColor: "#07100B",
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#29462F",
    overflow: "hidden",
    position: "relative",

    shadowColor: "#7DFF5C",
    shadowOpacity: 0.15,
    shadowRadius: 18,
    shadowOffset: {
      width: 0,
      height: 0,
    },

    elevation: 8,
  },

  gridVertical: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: "#0C1A11",
  },

  gridHorizontal: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "#0C1A11",
  },

  // ----------------------------------------------------------
  // SNAKE
  // ----------------------------------------------------------

  snakeSegment: {
    position: "absolute",
  },

  snakeHead: {
    backgroundColor: "#B7FF73",
    borderWidth: 1,
    borderColor: "#E1FFC1",
    zIndex: 5,
  },

  snakeBody: {
    backgroundColor: "#55C94D",
    borderWidth: 1,
    borderColor: "#78E568",
    zIndex: 4,
  },

  eye: {
    position: "absolute",
    width: 3.5,
    height: 3.5,
    borderRadius: 2,
    backgroundColor: "#07100B",
  },

  // ----------------------------------------------------------
  // FOOD
  // ----------------------------------------------------------

  food: {
    position: "absolute",
    backgroundColor: "#FF4B55",
    borderWidth: 2,
    borderColor: "#FF8990",
    zIndex: 3,

    shadowColor: "#FF3D47",
    shadowOpacity: 0.8,
    shadowRadius: 7,
    shadowOffset: {
      width: 0,
      height: 0,
    },

    elevation: 8,
  },

  foodHighlight: {
    position: "absolute",
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#FFD4D6",
    top: 4,
    left: 4,
  },

  // ----------------------------------------------------------
  // PARTICLES
  // ----------------------------------------------------------

  particleContainer: {
    position: "absolute",
    left: BOARD_SIZE / 2,
    top: BOARD_SIZE / 2,
    width: 1,
    height: 1,
    zIndex: 20,
    pointerEvents: "none",
  },

  particle: {
    position: "absolute",
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#B7FF73",
  },

  // ----------------------------------------------------------
  // OVERLAY
  // ----------------------------------------------------------

  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(1, 5, 3, 0.84)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 50,
  },

  overlayCard: {
    alignItems: "center",
    width: "82%",
    paddingVertical: 25,
    paddingHorizontal: 20,
    borderRadius: 18,
    backgroundColor: "rgba(7, 17, 11, 0.96)",
    borderWidth: 1,
    borderColor: "#29462F",
  },

  overlayIcon: {
    fontSize: 42,
    marginBottom: 4,
  },

  pauseIcon: {
    color: "#A8FF78",
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: 5,
  },

  overlayTitle: {
    color: "#C4FF9D",
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: 4,
    marginTop: 4,
  },

  overlayDescription: {
    color: "#6C8572",
    fontSize: 11,
    marginTop: 7,
    marginBottom: 20,
  },

  startButton: {
    backgroundColor: "#8FEA63",
    paddingVertical: 13,
    paddingHorizontal: 28,
    borderRadius: 9,

    shadowColor: "#7DFF5C",
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 0,
    },

    elevation: 5,
  },

  startButtonText: {
    color: "#081008",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.5,
  },

  // ----------------------------------------------------------
  // COUNTDOWN
  // ----------------------------------------------------------
  countdownText: {
    color: "#C2FF9B",
    fontSize: 80,
    fontWeight: "900",
    textShadowColor: "#70FF50",
    textShadowOffset: { width: 0, height: 0 }, // Adjust width/height if you want the shadow offset
    textShadowRadius: 20,
  },

  countdownSubtext: {
    color: "#66806E",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 3,
    marginTop: -8,
  },

  // ----------------------------------------------------------
  // GAME OVER
  // ----------------------------------------------------------

  gameOverIcon: {
    color: "#FF626B",
    fontSize: 58,
    fontWeight: "200",
    lineHeight: 55,
  },

  gameOverTitle: {
    color: "#FF727A",
    fontSize: 25,
    fontWeight: "900",
    letterSpacing: 3,
  },

  finalScoreLabel: {
    color: "#53685B",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 2,
    marginTop: 13,
  },

  finalScore: {
    color: "#D4FFC0",
    fontSize: 45,
    fontWeight: "900",
    marginBottom: 4,
  },

  newBest: {
    color: "#FFD166",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
    marginBottom: 16,
  },

  // ----------------------------------------------------------
  // FLASH
  // ----------------------------------------------------------

  flash: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#FF4D55",
    borderRadius: 14,
    zIndex: 100,
    pointerEvents: "none",
  },

  // ----------------------------------------------------------
  // INFORMATION
  // ----------------------------------------------------------

  infoRow: {
    width: BOARD_SIZE,
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
  },

  infoBox: {
    flex: 1,
    alignItems: "center",
  },

  infoLabel: {
    color: "#405246",
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1,
  },

  infoValue: {
    color: "#9CBAA2",
    fontSize: 14,
    fontWeight: "900",
    marginTop: 2,
  },

  // ----------------------------------------------------------
  // PAUSE BUTTON
  // ----------------------------------------------------------

  pauseButton: {
    marginTop: 10,
    paddingVertical: 9,
    paddingHorizontal: 24,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#29462F",
    backgroundColor: "#09140D",
  },

  pauseButtonText: {
    color: "#91B49A",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
  },

  // ----------------------------------------------------------
  // FOOTER
  // ----------------------------------------------------------

  footer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    marginBottom: 8,
    gap: 8,
  },

  footerText: {
    color: "#35483B",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1,
  },

  footerDot: {
    color: "#53685A",
    fontSize: 10,
  },
});
