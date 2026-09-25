from app.engine.rag.vectorstore import VectorStore


class FakeCollection:
    def __init__(self, responses):
        self.responses = list(responses)
        self.calls = []

    def query(self, **kwargs):
        self.calls.append(kwargs)
        return self.responses.pop(0)


def make_store(responses, codes=("IS 456",)):
    store = VectorStore.__new__(VectorStore)
    store._collection = FakeCollection(responses)
    store.get_all_codes = lambda: list(codes)
    return store


def test_query_applies_matching_is_code_filter():
    store = make_store([
        {
            "documents": [["Filtered clause"]],
            "metadatas": [[{"is_code": "IS 456"}]],
            "distances": [[0.2]],
        }
    ])

    result = store.query("factory requirements", n_results=5, is_code_filter="IS456")

    assert result["results"] == [
        {
            "text": "Filtered clause",
            "metadata": {"is_code": "IS 456"},
            "score": 0.8,
        }
    ]
    assert store._collection.calls == [
        {
            "query_texts": ["factory requirements"],
            "n_results": 5,
            "where": {"is_code": "IS 456"},
        }
    ]


def test_empty_filtered_query_falls_back_once_without_filter():
    store = make_store([
        {"documents": [[]], "metadatas": [[]], "distances": [[]]},
        {
            "documents": [["Fallback clause"]],
            "metadatas": [[{"is_code": "IS 456"}]],
            "distances": [[0.4]],
        },
    ])

    result = store.query("requirements", n_results=3, is_code_filter="IS 456")

    assert result["results"][0]["text"] == "Fallback clause"
    assert store._collection.calls == [
        {
            "query_texts": ["requirements"],
            "n_results": 3,
            "where": {"is_code": "IS 456"},
        },
        {"query_texts": ["requirements"], "n_results": 3},
    ]


def test_unknown_is_code_skips_collection_query():
    store = make_store([], codes=("IS 1786",))

    result = store.query("requirements", is_code_filter="IS 999")

    assert result == {
        "results": [],
        "requested_code": "IS 999",
        "indexed_codes": ["IS 1786"],
    }
    assert store._collection.calls == []
