# MindScribe Directory Structure

- README.md
- .gitignore

# Add new files and folders as you build your project.
mindscribe/
  frontend/
    src/
    index.html
  backend/
    src/
      agents/
        insightsAgent.ts
        capsuleAgent.ts
        peerWallAgent.ts
        safetyAgent.ts
        swarmAgent.ts
      api/
        entries.ts
        peerWall.ts
        twin.ts
        capsules.ts
        swarm.ts
      lib/
        firestore.ts
        gemini.ts
        moderation.ts
        safety.ts
        capsuleSelector.ts
        twinMapper.ts
        config.ts
        logging.ts
      types/
        domain.ts
    package.json
    tsconfig.json
    .env.sample
  firestore.rules
  firestore.indexes.json
  README.md
