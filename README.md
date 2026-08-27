# RAG System

A full-stack Retrieval-Augmented Generation system with a React frontend, a Node/Express + Gemini backend, and a ChromaDB vector store.

## Configuration

Put Gemini API key in docker-compose.yml file

```yaml
  backend:
    environment:
      - GEMINI_API_KEY=your-key-here
```

## Start the project

From the project root, run:

```bash
docker compose up --build
```

## Ingest the data
exec into the backend container and run 

```bash

pnpm ingest
```


- Frontend UI: http://localhost:5173
- Backend health: http://localhost:3001/health or /chat
