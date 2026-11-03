# source this: puts the project's Node 20 and Ollama first on PATH
D="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export PATH="$D/.node/bin:$D/.ollama/bin:$PATH"
