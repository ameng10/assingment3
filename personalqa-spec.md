
# PersonalQA Concept — Original and AI-Augmented

---

## Original Concept: PersonalQA `[User, Fact, Question, Answer, Time]`

**Concept:** PersonalQA `[User, Fact, Question, Answer, Time]`

**Purpose:**
> Answer a user’s food questions using their own meals, check-ins, and insights.

**Principle:**
> The assistant maintains a private fact base of normalized statements (from meals, check-ins, insights, behavior changes) and answers questions by citing those facts.

**State:**
- A set of **Facts** with:
  - `owner`: User
  - `at`: Time
  - `content`: Fact (e.g., “late_night + fried linked to lower energy (conf 0.82)”)
  - `source`: String (`"meal"`, `"check_in"`, `"insight"`, `"behavior"`)
- A set of **QAs** with:
  - `owner`: User
  - `question`: Question
  - `answer`: Answer
  - `citedFacts`: Set(Fact)

**Actions:**
- `ingestFact(owner: User, at: Time, content: Fact, source: String)`
  - *effects*: add a fact
- `forgetFact(requester: User, owner: User, fact: Fact)`
  - *requires*: fact exists for owner and requester = owner
  - *effects*: remove the fact
- `ask(requester: User, question: Question): (answer: Answer, citedFacts: Set(Fact))`
  - *requires*: requester exists
  - *effects*: produce an answer derived from requester’s Facts; store QA with owner = requester; return answer with citedFacts

---


## AI-Augmented Concept: PersonalQA+LLM `[User, Fact, Question, Answer, Time, Template, Json]`

**Concept:** PersonalQA+LLM `[User, Fact, Question, Answer, Time, Template, Json]`

**Purpose:**
> Answer a user’s food questions using their own meals, check-ins, and insights.

**Principle:**
> The assistant maintains a private fact base of normalized statements (from meals, check-ins, insights, behavior changes). When a user asks a question, the system selects the user’s most relevant facts, calls Gemini with a fixed prompt, expects strict JSON (answer, citations, confidence), validates the result, stores the QA, and returns it. If validation fails or evidence is insufficient, it returns a conservative fallback derived from the selected facts.

**State:**
- A set of **Facts** with:
  - `owner`: User
  - `at`: Time
  - `content`: Fact (e.g., “late_night + fried linked to lower energy (conf 0.82)”)
  - `source`: String (`"meal"`, `"check_in"`, `"insight"`, `"behavior"`)
- A set of **QAs** with:
  - `owner`: User
  - `question`: Question
  - `answer`: Answer
  - `citedFacts`: Set(Fact)
  - `confidence`: Number (0..1)
- A set of **Drafts** with:
  - `owner`: User
  - `question`: Question
  - `raw`: String (raw Gemini output, JSON as string)
  - `validated`: Flag

**Actions:**
- `ingestFact(owner: User, at: Time, content: Fact, source: String)`
  - *effects*: add a fact
- `forgetFact(requester: User, owner: User, fact: Fact)`
  - *requires*: fact exists for owner and requester = owner
  - *effects*: remove the fact
- `askLLM(requester: User, question: Question, k: Number = 12): (answer: Answer, citedFacts: Set(Fact), confidence: Number)`
  - *requires*: requester exists
  - *effects*:
    - select up to k relevant Facts for requester (selection policy outside this concept; e.g., recency)
    - call Gemini with a fixed prompt that requests STRICT JSON:
      ```json
      { "answer": string, "citations": [factIds], "confidence": number }
      ```
      and that forbids claims not grounded in the provided facts
    - save a Draft with the raw Gemini output
    - validate that:
      - all citations refer only to the selected Facts
      - answer length is within policy limits
      - confidence is in [0,1]
      - citations are non-empty if any claim is made
    - if valid:
      - store QA with owner = requester and return (answer, citedFacts, confidence)
    - otherwise:
      - construct a conservative fallback from the selected Facts (e.g., “Insufficient evidence from your data…”)
      - choose minimal relevant citations (possibly empty if none)
      - store QA and return the fallback with low confidence (e.g., 0.2)
