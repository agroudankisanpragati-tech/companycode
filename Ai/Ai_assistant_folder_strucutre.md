└── Ai/                               # Entire AI system
    │
    ├── AGENTS.md                     # AI-specific agent instructions
    │
    ├── .env                          # AI configuration/secrets
    ├── requirements.txt
    ├── pyproject.toml                # optional, if you use it
    │
    ├── ml/                           # YOUR EXISTING Python virtual environment
    │
    │
    ├── Ai_assistant/                 # ⭐ NEW RAG ASSISTANT
    │   │
    │   ├── AGENTS.md                 # Assistant-specific instructions
    │   │
    │   ├── README.md
    │   │
    │   ├── knowledge_base/           # ⭐ SOURCE OF TRUTH
    │   │   │
    │   │   ├── website/
    │   │   │   ├── overview.md
    │   │   │   ├── navigation.md
    │   │   │   ├── dashboard.md
    │   │   │   ├── my_crops.md
    │   │   │   ├── ai_advisor.md
    │   │   │   ├── disease_scan.md
    │   │   │   ├── soil_health.md
    │   │   │   ├── fertilizer_calculator.md
    │   │   │   ├── crop_recommendation.md
    │   │   │   ├── weather.md
    │   │   │   ├── market_prices.md
    │   │   │   ├── marketplace.md
    │   │   │   ├── govt_schemes.md
    │   │   │   ├── kvk.md
    │   │   │   ├── learning.md
    │   │   │   ├── profile.md
    │   │   │   ├── settings.md
    │   │   │   └── faq.md
    │   │   │
    │   │   ├── agriculture/
    │   │   │   │
    │   │   │   ├── crops/
    │   │   │   │   ├── wheat.md
    │   │   │   │   ├── rice.md
    │   │   │   │   ├── maize.md
    │   │   │   │   └── ...
    │   │   │   │
    │   │   │   ├── diseases/
    │   │   │   │   ├── wheat-yellow-rust.md
    │   │   │   │   ├── rice-blast.md
    │   │   │   │   └── ...
    │   │   │   │
    │   │   │   ├── pests/
    │   │   │   ├── deficiencies/
    │   │   │   ├── soil/
    │   │   │   ├── fertilizers/
    │   │   │   ├── irrigation/
    │   │   │   └── farming_practices/
    │   │   │
    │   │   ├── government/
    │   │   │   ├── schemes/
    │   │   │   └── policies/
    │   │   │
    │   │   ├── support/
    │   │   │   ├── faq.md
    │   │   │   ├── troubleshooting.md
    │   │   │   └── common_problems.md
    │   │   │
    │   │   └── glossary/
    │   │       └── agriculture_terms.json
    │   │
    │   │
    │   ├── rag/                      # ⭐ RAG ENGINE
    │   │   │
    │   │   ├── ingestion/
    │   │   │   ├── loader.py
    │   │   │   ├── normalizer.py
    │   │   │   └── indexer.py
    │   │   │
    │   │   ├── chunking/
    │   │   │   └── chunker.py
    │   │   │
    │   │   ├── embeddings/
    │   │   │   ├── embedding_model.py
    │   │   │   └── config.py
    │   │   │
    │   │   ├── retrieval/
    │   │   │   ├── retriever.py
    │   │   │   ├── filters.py
    │   │   │   └── reranker.py
    │   │   │
    │   │   ├── context/
    │   │   │   └── context_builder.py
    │   │   │
    │   │   ├── vector_store/
    │   │   │   └── chroma_client.py
    │   │   │
    │   │   └── rag_pipeline.py
    │   │
    │   │
    │   ├── data/                     # Generated/runtime data
    │   │   │
    │   │   └── chroma/               # ⭐ ChromaDB persistent storage
    │   │
    │   │
    │   ├── assistant/                # ⭐ Assistant orchestration
    │   │   ├── assistant.py
    │   │   ├── router.py
    │   │   ├── language.py
    │   │   ├── response_generator.py
    │   │   └── fallback.py
    │   │
    │   │
    │   ├── prompts/                  # LLM prompts
    │   │   ├── system_prompt.md
    │   │   ├── rag_prompt.md
    │   │   └── language_prompt.md
    │   │
    │   │
    │   ├── evaluation/               # RAG quality evaluation
    │   │   ├── datasets/
    │   │   │   ├── website_questions.json
    │   │   │   ├── agriculture_questions.json
    │   │   │   ├── government_questions.json
    │   │   │   ├── multilingual_questions.json
    │   │   │   ├── dynamic_data_questions.json
    │   │   │   └── negative_questions.json
    │   │   │
    │   │   ├── evaluator.py
    │   │   └── evaluation_results/
    │   │
    │   │
    │   ├── tests/
    │   │   ├── test_ingestion.py
    │   │   ├── test_retrieval.py
    │   │   ├── test_multilingual.py
    │   │   └── test_routing.py
    │   │
    │   │
    │   ├── scripts/
    │   │   ├── build_index.py
    │   │   ├── rebuild_index.py
    │   │   └── inspect_index.py
    │   │
    │   │
    │   └── docs/
    │       └── rag/
    │           ├── CURRENT_AI_ARCHITECTURE.md
    │           ├── PROJECT_ANALYSIS.md
    │           ├── KNOWLEDGE_SOURCE_INVENTORY.md
    │           ├── DATA_CLASSIFICATION.md
    │           ├── SOURCE_MAPPING.md
    │           ├── EXTRACTION_PLAN.md
    │           ├── KB_ARCHITECTURE.md
    │           ├── DOCUMENT_SCHEMA.md
    │           ├── METADATA_SCHEMA.md
    │           ├── RETRIEVAL_STRATEGY.md
    │           ├── KB_BUILD_REPORT.md
    │           ├── KB_AUDIT_REPORT.md
    │           ├── INGESTION_ARCHITECTURE.md
    │           ├── RAG_INTEGRATION.md
    │           ├── MULTILINGUAL_RAG.md
    │           ├── RAG_FAILURE_REPORT.md
    │           └── VOICE_ARCHITECTURE.md
    │