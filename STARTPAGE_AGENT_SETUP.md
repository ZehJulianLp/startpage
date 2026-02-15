# Startpage Agent Setup (Ollama)

This guide explains how to set up the **Startpage Agent** with a local Ollama instance.

## 1. Requirements

- Ollama installed on the machine that should run the agent.
- At least one installed model (for example `llama3.1`, `qwen2.5`, etc.).
- Startpage running in the browser (local dev or deployed).

## 2. Quick Start (Local Development)

1. Start Ollama:
   - `ollama serve`
2. Open Startpage.
3. In Settings -> Startpage Agent:
   - Enable the agent
   - Host: `http://localhost:11434`
   - Click **Load models**
   - Select a model
4. Open the chat and send a message.

## 3. Setup for Deployed Website (Cross-Origin)

If your site is hosted on another origin (for example `https://julianverse.de/startpage/`), Ollama must allow that origin.

Set this environment variable on each user machine:

- `OLLAMA_ORIGINS=https://julianverse.de,http://localhost:4173`

Then restart Ollama completely.

## 4. Windows Example

Run in PowerShell:

```powershell
setx OLLAMA_ORIGINS "https://julianverse.de,http://localhost:4173"
```

Then fully restart Ollama (quit app/process and start again).

## 5. Verify Ollama

Check if Ollama responds locally:

```powershell
Invoke-WebRequest -UseBasicParsing http://localhost:11434/api/tags
```

Expected: HTTP `200`.

## 6. Common Issues

- `403` / `Access-Control-Allow-Origin` missing:
  - `OLLAMA_ORIGINS` is missing or Ollama was not restarted.
- No models in dropdown:
  - No local models installed, or host is wrong.
  - Install model: `ollama pull <model-name>`.
- Agent hidden/disabled:
  - Runtime check marked Ollama unavailable.
  - Re-check host, Ollama process, and CORS setting.
- Streaming stops:
  - Network interruption or model process issue.
  - Retry after restarting Ollama.

## 7. Notes

- `localhost` always means the **user's own machine**.
- If you host Startpage publicly and want user-local Ollama, each user must set `OLLAMA_ORIGINS` on their own system.
