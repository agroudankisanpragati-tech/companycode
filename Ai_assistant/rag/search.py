from __future__ import annotations

import argparse
import json

from rag.config import COLLECTIONS
from rag.retriever import retrieve_chunks


def main() -> None:
    parser = argparse.ArgumentParser(description="Search the local AKP draft knowledge index")
    parser.add_argument("--domain", choices=sorted(COLLECTIONS), required=True)
    parser.add_argument("--query", required=True)
    parser.add_argument("--top-k", type=int, default=5)
    args = parser.parse_args()

    rows = retrieve_chunks(args.domain, args.query, args.top_k)
    for index, row in enumerate(rows):
        row["rank"] = index + 1
    print(json.dumps({"domain": args.domain, "query": args.query, "results": rows}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
