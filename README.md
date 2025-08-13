# Radio Scheduler

[![License](https://img.shields.io/github/license/klorin911/radioscheduler)](LICENSE)

> **Radio Scheduler** is an Electron-based app for managing and automatically assigning radio dispatcher schedules, prioritizing seniority and personal preferences.

## Table of Contents

- [Features](#features)
- [Getting Started](#getting-started)
- [Configuration](#configuration)
- [Development](#development)
- [Production Build](#production-build)
- [Tech Stack](#tech-stack)
- [License](#license)
- [Contact](#contact)

## Features

- **Dispatcher Management:** Add/edit/manage dispatcher profiles with preferences
- **Automatic Scheduling:** GLPK-based solver for optimal shift assignments
- **Seniority System:** Priority-based scheduling using badge numbers
- **Weekly Schedule View:** Complete planning with daily breakdowns
- **Export Capabilities:** CSV and PDF export
- **Auto-Updates:** GitHub releases integration
- **Undo System:** Revert changes with history tracking

## Getting Started

### Installation

```bash
git clone https://github.com/klorin911/radioscheduler.git
cd radioscheduler
npm install
cp dispatchers.example.json dispatchers.json
# Edit dispatchers.json with your dispatcher data
```

## Configuration

- Dispatcher data: `dispatchers.json` (local, ignored by git)
- Template: `dispatchers.example.json`
- See [Data Structure](#data-structure) for details.

### Data Structure

Each dispatcher entry includes:
- `id`: Short identifier (e.g., "ASMI")
- `name`: Full name
- `badgeNumber`: Used for seniority calculations
- `shift`: Work shift assignment (A-F)
- `workDays`: Array of working days
- `preferredChannels`: Preferred radio channels
- `preferredTimeBlocks`: Preferred time slots
- `minimumRadioOnly`: Wants only minimum radio assignments
- `isTrainee`: Trainee status
- `traineeOf`: ID of trainer

## Development

```bash
npm run dev          # Run app in development mode
npm run build        # Build for production
npm run lint         # Lint code

# Platform-specific builds
npm run build:mac
npm run build:win
npm run build:linux
```

## Production Build

```bash
npm run build      # Build and package for distribution
npm run publish    # Publish to GitHub releases (requires GH_TOKEN)
```

## Tech Stack

- **Frontend:** React + TypeScript + Vite
- **Desktop:** Electron with auto-updater
- **Scheduling:** GLPK.js
- **Exports:** jsPDF
- **Build:** electron-builder

## License

This project is licensed under the [MIT License](LICENSE).

## Contact

- File issues in [GitHub Issues](https://github.com/klorin911/radioscheduler/issues)
