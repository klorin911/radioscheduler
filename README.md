# Radio Scheduler

An Electron-based application for scheduling radio dispatchers with automatic assignment capabilities, seniority-based preferences, and weekly schedule management.

## Features

- **Dispatcher Management**: Add, edit, and manage dispatcher profiles with preferences
- **Automatic Scheduling**: GLPK-based solver for optimal shift assignments
- **Seniority System**: Priority-based scheduling using badge numbers
- **Weekly Schedule View**: Complete weekly planning with daily breakdowns
- **Export Capabilities**: CSV and PDF export for schedules
- **Auto-Updates**: Built-in update system via GitHub releases
- **Undo System**: Revert schedule changes with history tracking

## Data Setup

The application uses `dispatchers.json` for dispatcher data. For privacy:

- Your local `dispatchers.json` file is ignored by git (contains real data)  
- Use `dispatchers.example.json` as a template for the data structure
- Copy `dispatchers.example.json` to `dispatchers.json` and customize with your data

### Data Structure
Each dispatcher entry includes:
- `id`: Short identifier (e.g., "ASMI")  
- `name`: Full name
- `badgeNumber`: Used for seniority calculations
- `shift`: Work shift assignment (A, B, C, D, E, F)
- `workDays`: Array of working days
- `preferredChannels`: Preferred radio channels (SW, CE, NE, NW, SE, MT)
- `preferredTimeBlocks`: Preferred time slots
- `minimumRadioOnly`: Whether dispatcher wants only minimum assignments
- `isTrainee`: Trainee status
- `traineeOf`: ID of trainer (for trainees)

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd radioscheduler

# Install dependencies
npm install

# Set up data file
cp dispatchers.example.json dispatchers.json
# Edit dispatchers.json with your dispatcher data
```

## Development

```bash
# Run in development mode
npm run dev

# Build the application
npm run build

# Run linter
npm run lint

# Build for specific platforms
npm run build:mac
npm run build:win
npm run build:linux
```

## Production Build

```bash
# Build and package for distribution
npm run build

# Publish to GitHub releases (requires GH_TOKEN)
npm run publish
```

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Desktop**: Electron with auto-updater
- **Scheduling**: GLPK.js for linear programming optimization
- **Exports**: jsPDF for PDF generation
- **Build**: electron-builder for cross-platform packaging

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type aware lint rules:

- Configure the top-level `parserOptions` property like this:

```js
export default {
  // other rules...
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    project: ['./tsconfig.json', './tsconfig.node.json'],
    tsconfigRootDir: __dirname,
  },
}
```

- Replace `plugin:@typescript-eslint/recommended` to `plugin:@typescript-eslint/recommended-type-checked` or `plugin:@typescript-eslint/strict-type-checked`
- Optionally add `plugin:@typescript-eslint/stylistic-type-checked`
- Install [eslint-plugin-react](https://github.com/jsx-eslint/eslint-plugin-react) and add `plugin:react/recommended` & `plugin:react/jsx-runtime` to the `extends` list
