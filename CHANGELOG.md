# Changelog

All notable changes to this project will be documented in this file.

## [0.4.0] - 2025-09-21
### Added
- Frontend theming: global gradient background; dark and lavender themes; Theme & A11y popover with System/Light/Dark/Lavender and Reduce Motion toggle.
- Games page with Mindful Breathing card.
- PR preview workflow for Firebase Hosting: preview channel per PR, with comment link.
- GitHub Actions workflow to deploy Hosting on push to main.

### Changed
- Frontend Insights page: mood derived from sentiment; visible High risk badge for flagged entries.
- Backend: Gemini SDK lazy-loaded (classifier, media processing, swarm narrative) to avoid deploy-time timeouts; improved safety heuristics and classifier tuning.
- Aligned repository to main branch on GitHub.

### Fixed
- Functions deployment timeout due to heavy imports.
- Capsule rendering for playlists and embedded YouTube.

### Notes
- Production Hosting: https://mindscribe-472408.web.app
- Ensure FIREBASE_TOKEN is added to GitHub repo secrets for CI to deploy.
