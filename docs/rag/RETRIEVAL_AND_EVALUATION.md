# Retrieval and evaluation plan

## Retrieval contract

The retriever returns a small set of source chunks, not a finished answer. Each returned chunk must include its source article ID, title, section, source URL/publisher, applicability metadata, review status, and relevance/distance score.

For an initial retrieval-only prototype:

1. Classify the request as `website`, `agriculture`, `dynamic/live`, or `unknown`.
2. Search the matching collection only. If classification is uncertain, ask a short clarifying question or search both collections with explicit domain labels and inspect results before generation.
3. Filter by `review_status=reviewed` for production. A local experimentation collection may include draft articles, but its responses must not be presented as approved advice.
4. Retrieve a small top-k set (start with 3–5) and compare with evaluation results. Tune the relevance threshold against answerable and unanswerable examples.
5. Provide the LLM only relevant excerpts. Require source-linked claims, preserve article step order, distinguish static knowledge from live context, and abstain when retrieval is empty, weak, or out of scope.
6. Show source attribution in the response. Do not cite an article that was not retrieved.

Vector similarity alone is not a confidence score and does not prove that advice is correct. Relevance thresholds and reranking must be measured empirically.

## Evaluation inputs

- Agriculture: `knowledge/agriculture/evaluation/questions.json` (currently 13 answerable/out-of-scope questions).
- Website: `knowledge/website/evaluation/questions.json`; includes navigation/how-to questions, current page context, dynamic-data questions, and an action boundary.
- Add farmer-provided anonymized examples only after review. Do not place private names, contact details, exact farm identifiers, or credentials into evaluation data.

## Acceptance checks before integration

- Every answerable question retrieves its expected source in top 3 for the selected domain; measure top 5 as a secondary check.
- The response does not blend unrelated agriculture and website instructions.
- Hindi and English paraphrases retrieve the same relevant source where intended.
- A question that asks for a pesticide dose, diagnosis from insufficient evidence, live value, deferred scheme details, or an unavailable crop package causes a safe abstention or asks for missing context.
- Generated claims are supported by retrieved text, retain caveats/conditions, and expose citations.
- Ordered procedures remain ordered and complete.
- Compare failures by domain, language, intent, model, chunk configuration, and review status before changing content or ranking.

Do not use an overall LLM score as the only acceptance signal. Inspect retrieval correctness and generated answers separately.
