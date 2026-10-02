# Knowledge source repository

This folder contains the editable source documents for the assistant's static knowledge. It is not a vector database and adding documents here does not change chatbot behavior until a later ingestion and retrieval implementation indexes them.

## Separate domains

- `website/` — verified help for site navigation and workflows.
- `agriculture/` — agriculture references with scope, source, and review metadata.

Keep the domains separate in retrieval so an agriculture question does not receive unrelated website instructions and vice versa. Dynamic or private information (for example current weather, prices, KVK lookup results, profile data, and a farmer's own records) belongs to the live feature/context path, not these static documents. Government scheme guidance is deferred.

Read each domain's README before indexing. Draft articles may be indexed in a local evaluation collection, but must not be treated as approved production advice.
