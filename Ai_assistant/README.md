# AKP local RAG prototype

This prototype chunks Markdown under root `knowledge/`, embeds it with a multilingual model, and stores draft-only vectors in local Chroma. Website retrieval can be enabled for local development through the existing Pragati AI backend; the agriculture draft collection is not exposed to chat. Do not present draft agriculture material as approved farmer advice.

## Model and limits

The initial local model is `intfloat/multilingual-e5-small` (384-dimensional, multilingual). The model files are downloaded from Hugging Face on first run and cached outside this repository. The implementation uses the E5 `passage:` prefix for stored chunks and `query:` for searches. Review retrieval performance on the supplied English and Hindi questions before accepting this model.

Chroma stores/searches vectors; `rag/markdown_chunker.py` creates coherent chunks. This prototype uses cosine-equivalent L2 ranking by normalizing E5 vectors and the default L2 index. It keeps website and agriculture records in separate draft collections.

## Existing project environment

The repository's existing environment is `Ai/ml` (Python 3.10.8 in this checkout). From the repository root, install only the RAG packages into that environment:

```powershell
.\Ai\ml\Scripts\python.exe -m pip install -r .\Ai_assistant\requirements-rag.txt
```

This changes the existing environment. `requirements-rag.txt` does not pin or request a change to Torch or NumPy. Check pip's resolver output before accepting any proposed upgrades/downgrades to the pinned AI stack.

## Build the local draft index

Run commands from the repository root. Set the package path in each PowerShell session:

```powershell
$env:PYTHONPATH = (Join-Path (Get-Location) "Ai_assistant")
.\Ai\ml\Scripts\python.exe -m rag.ingest
```

The default Chroma files are written under `Ai_assistant/data/chroma/`, which is ignored by Git.

Search a collection. Results are evidence candidates, not generated chatbot answers. Search prefers distinct source articles so one long article does not fill the result list:

```powershell
$env:PYTHONPATH = (Join-Path (Get-Location) "Ai_assistant")
.\Ai\ml\Scripts\python.exe -m rag.search --domain agriculture --query "What should I do with my soil test report?"
.\Ai\ml\Scripts\python.exe -m rag.search --domain website --query "How do I scan a crop photo?"
```

Run the retrieval-only evaluation report:

```powershell
$env:PYTHONPATH = (Join-Path (Get-Location) "Ai_assistant")
.\Ai\ml\Scripts\python.exe -m rag.evaluate
```

The report is saved under the ignored `Ai_assistant/manifests/` folder. It measures expected-document retrieval and ranking; it does not test LLM answer quality or validate agronomic advice.

## Local website RAG in the existing chatbot

Website RAG accepts an OpenAI-compatible LLM provider. In `backend/.env`, set `WEBSITE_RAG_ENABLED=true` (only takes effect when `NODE_ENV=development`) and configure `WEBSITE_RAG_LLM_API_KEY`, `WEBSITE_RAG_LLM_BASE_URL`, and `WEBSITE_RAG_LLM_MODEL`. These isolated settings fall back to `OPENAI_API_KEY`, `OPENAI_BASE_URL`, and `OPENAI_MODEL` if omitted. For example, OpenRouter's free router uses `https://openrouter.ai/api/v1` and model `openrouter/free`. Also configure `PRAGATI_AI_BRIDGE_URL`, then start the Python bridge with the `Ai/ml` environment and start the backend as usual. The isolated settings ensure this experiment does not change the provider used by other AI flows. The Node chat API request/response format stays unchanged. Website-help answers use retrieved website evidence and source references; the bridge endpoint is loopback-only. If retrieval finds no sufficiently close evidence, the RAG path declines to answer. The distance limit is a provisional local setting and must be calibrated against the evaluation set before wider use.

To turn this local experiment off, set `WEBSITE_RAG_ENABLED=false` or remove it and restart the backend. Agriculture content remains excluded from the chat path until that corpus is reviewed and approved.

## Current indexed content

The loader includes Markdown articles with recognized front matter under `knowledge/website/` and `knowledge/agriculture/`. It excludes READMEs, evaluation files, engineering audits, and `website/assistant-page-context.md`. Draft articles are included only in `akp_website_draft_v1` and `akp_agriculture_draft_v1` for local inspection. No government schemes, live data, user records, or chat history are indexed.

Do not connect these collections to farmer traffic until subject-matter review, retrieval evaluation, abstention behavior, and backend integration are separately completed.
