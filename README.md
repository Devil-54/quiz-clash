# Quiz Clash — Think Fast. Clash Smarter.

Quiz Clash is a competitive quiz game for single-player practice and real-time multiplayer matches. Players can challenge Math, General Knowledge, and English Grammar questions across Easy, Medium, and Hard difficulty levels while racing through six-round matches with a 10-second timer, score tracking, coin rewards, rooms, profiles, and statistics.

> This project is distributed under the [MIT License](LICENSE).

## Features

- Single-player and real-time multiplayer gameplay
- Math, General Knowledge, and English Grammar modes
- Easy, Medium, and Hard difficulty levels
- Six-round matches with a 10-second timer
- Four answer options per question
- Server-authoritative scoring and round timing
- Multiplayer rooms with player readiness and host controls
- Player profiles, game statistics, coins, and rewards
- Socket.IO real-time communication
- Password hashing and signed JWT sessions
- Responsive React interface with accessible controls and audio effects

## Game Rules

- A match contains six sequential rounds.
- Each question gives a player 10 seconds to submit an answer.
- Correct answers award 10 points in single-player mode.
- Multiplayer scoring rewards faster correct answers and gives no points for incorrect or timed-out answers.
- Correct answers also earn coins, and the multiplayer winner receives a bonus.
- The server controls timers, question progression, answer validation, and scoring.

## Game Modes

| Category | Easy | Medium | Hard |
| --- | --- | --- | --- |
| Math | Basic arithmetic | Two-digit arithmetic and tables | Larger arithmetic and multi-step operations |
| General Knowledge | Core facts and landmarks | Historical, scientific, and geography facts | Specialized history, astronomy, and technology |
| English Grammar | Basic tenses and articles | Agreement, modals, and verb forms | Conditionals, voice, and reported speech |

Quiz Clash supports these mode combinations in both single-player and multiplayer play.

## Difficulty System

- **Easy:** foundational questions and simpler calculations.
- **Medium:** broader knowledge and more challenging arithmetic.
- **Hard:** advanced questions and more complex operations.

## Tech Stack

- **Frontend:** React 19, Vite, JavaScript/JSX, CSS
- **Backend:** Node.js, Express 5, Socket.IO
- **Authentication:** bcryptjs and JSON Web Tokens
- **Testing:** Node.js test scripts using the Socket.IO client and real server endpoints
- **Linting:** Oxlint

## Project Structure

```text
quiz-clash/
├── public/                      # Static frontend assets
├── server/
│   ├── authService.js           # Authentication and in-memory user state
│   └── server.js                # Express API and Socket.IO game server
├── src/
│   ├── components/              # React components
│   ├── context/                 # Authentication context
│   ├── data/                    # Question banks and mock game constants
│   ├── hooks/                   # Game-state hooks
│   ├── services/                # API and Socket.IO clients
│   ├── utils/                   # Math generation and audio utilities
│   └── App.jsx                  # Application entry component
├── .env.example                 # Environment template
├── .gitignore                   # Git exclusions
├── index.html                   # Application HTML
├── LICENSE                      # MIT License
├── package.json                 # Scripts and dependencies
├── package-lock.json            # Locked dependency versions
├── vite.config.js               # Vite configuration
└── test-*.js                    # Automated test suites
```

## Installation

### Prerequisites

- Node.js 18 or newer
- npm 9 or newer
- Git

```bash
npm ci
```

## Environment Variables

Copy the environment template and replace the placeholder values:

```bash
cp .env.example .env
```

```env
PORT=3001
JWT_SECRET=replace_with_a_long_random_secret_of_at_least_32_characters
VITE_API_URL=http://localhost:3001
VITE_SOCKET_URL=http://localhost:3001
```

> Never commit the `.env` file. The `.env.example` file contains only non-secret placeholders.

## Run Locally

Start the backend in one terminal:

```bash
npm run server
```

Start the frontend in a second terminal:

```bash
npm run dev
```

Open `http://localhost:5173`. The backend listens on `http://localhost:3001` by default.

Create a production build:

```bash
npm run build
npm run preview
```

## Development Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server |
| `npm run server` | Start the Express and Socket.IO backend |
| `npm run build` | Create a production Vite build |
| `npm run preview` | Preview the production build |
| `npm run lint` | Run Oxlint |
| `npm test` | Run the automated game test suite |
| `npm run test:security` | Verify that JWT configuration is required |

Run the tests with the backend running on port 3001:

```bash
npm test
```

## Security Notes

- Passwords are hashed with bcrypt before storage.
- JWTs are signed and validated by the backend.
- Game timers, answer validation, rounds, and scoring are controlled by the server.
- Room codes are sanitized and generated as uppercase alphanumeric values.
- JWT_SECRET must be configured with at least 32 characters before the backend can start.
- Do not place real secrets or private files in the repository.

The current user account store is in memory. Persistent storage is recommended before production deployment.

## Future Improvements

- Add persistent user storage and account migration support.
- Add database-backed profile and leaderboard persistence.
- Add rate limiting and request validation middleware.
- Add deployment automation and production environment configuration.

## Author

Deepak Mishra — [Devil-54](https://github.com/Devil-54)

## License

Quiz Clash is licensed under the [MIT License](LICENSE).
