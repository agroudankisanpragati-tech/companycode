You are working on an existing agriculture/farmer web application.

The current project contains an existing frontend, backend, MongoDB database, AI services, disease detection, crop knowledge, KVK, government schemes, and an existing Pragati AI assistant architecture.

IMPORTANT PROJECT GOAL:

We are building a farmer-facing multilingual RAG assistant.

The assistant must:
1. Understand the website and its features.
2. Answer questions about how to use the website.
3. Answer agriculture-related questions using approved knowledge sources.
4. Retrieve relevant knowledge from the project's knowledge base.
5. Respond in the user's language.
6. Eventually support multilingual voice interaction.

IMPORTANT:
This is NOT an autonomous agent.

The assistant must NOT independently perform actions such as:
- changing user settings
- buying products
- submitting applications
- modifying crops
- sending messages
- performing transactions
- making account changes

It is primarily a knowledge/retrieval/answering assistant.

Before modifying anything:
- inspect the existing repository
- understand the architecture
- identify existing implementations
- reuse existing functionality where appropriate
- do not unnecessarily replace working systems

KNOWLEDGE BASE PRINCIPLES:

Separate knowledge into:

1. WEBSITE KNOWLEDGE
   - website overview
   - navigation
   - dashboard
   - My Crops
   - AI Advisor
   - Disease Scan
   - Soil Health
   - Fertilizer Calculator
   - Crop Recommendation
   - Weather
   - Market Prices
   - Marketplace
   - Government Schemes
   - KVK
   - Learning
   - Profile
   - Settings
   - FAQ
   - troubleshooting

2. AGRICULTURAL KNOWLEDGE
   - crops
   - diseases
   - pests
   - deficiencies
   - soil
   - irrigation
   - fertilizers
   - cultivation
   - prevention
   - farming practices

3. GOVERNMENT KNOWLEDGE
   - government schemes
   - eligibility
   - benefits
   - application information
   - official sources

4. SUPPORTING KNOWLEDGE
   - glossary
   - multilingual agricultural terminology
   - aliases
   - Hindi/local-language terminology

5. DYNAMIC DATA
   Dynamic information such as:
   - current weather
   - current market prices
   - nearest KVK
   - user-specific crops
   - user profile
   must NOT be converted into static RAG documents when a live database/API is available.

CRITICAL RULE:
Do not invent agricultural facts or website functionality.

If information cannot be verified from the repository or approved source material, mark it as:
UNKNOWN / REQUIRES SOURCE

Do not silently fabricate missing content.

CODE SAFETY:
Until explicitly instructed otherwise:
- do not rewrite existing application code
- do not change APIs
- do not change database schemas
- do not change frontend behavior
- do not remove existing functionality
- do not install unnecessary packages
- do not modify package versions

Every phase must produce:
1. What was discovered
2. What was changed
3. Files created/modified
4. Problems found
5. Questions/unknowns
6. Recommended next step

Before performing destructive or architectural changes, stop and ask for approval.

Read this instruction file before performing future tasks.