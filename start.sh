#!/bin/bash
# Run the AI partner on this laptop: Ollama (allowed for localhost and *.vercel.app pages) + the Vite dev server.
#   ./start.sh          dev page at http://localhost:8765 (Ctrl+C stops both)
#   ./start.sh ai       only Ollama, for the page deployed on Vercel
D="$(cd "$(dirname "$0")" && pwd)"
. "$D/env.sh"
MODEL="${MODEL:-llama3.2:3b}"

export OLLAMA_MODELS="$D/.ollama/models"
export OLLAMA_HOST=127.0.0.1:11434
export OLLAMA_ORIGINS="http://localhost:*,http://127.0.0.1:*,https://*.vercel.app"
export OLLAMA_KEEP_ALIVE=30m

pids=()
cleanup() { [ ${#pids[@]} -gt 0 ] && kill "${pids[@]}" 2>/dev/null; }
trap cleanup EXIT INT TERM

if ! curl -s "http://$OLLAMA_HOST/api/version" >/dev/null; then
    echo "[speaking] starting Ollama..."
    ollama serve >"$D/.ollama/serve.log" 2>&1 &
    pids+=($!)
    for _ in $(seq 1 30); do curl -s "http://$OLLAMA_HOST/api/version" >/dev/null && break; sleep 0.5; done
else
    echo "[speaking] Ollama already running (if the Vercel page can't reach it, stop it and run this script again)"
fi
if ! ollama list | grep -q "^$MODEL"; then
    echo "[speaking] pulling model $MODEL (one time)..."
    ollama pull "$MODEL" || exit 1
fi
# load the model now so the first reply is fast
curl -s "http://$OLLAMA_HOST/api/generate" -d "{\"model\":\"$MODEL\",\"keep_alive\":\"30m\"}" >/dev/null &

if [ "$1" = ai ]; then
    echo "[speaking] AI ready at http://localhost:11434 (Ctrl+C to stop)"
else
    [ -d "$D/node_modules" ] || (cd "$D" && npm install)
    (cd "$D" && npx vite --open) &
    pids+=($!)
fi
wait
