# PersonalQA: AI-Augmented Personal Question Answering

## Overview

PersonalQA is a system that helps users answer personal health and lifestyle questions by analyzing their own logged data (meals, check-ins, etc.). This project augments the original manual concept with an LLM (Google Gemini) to provide more insightful, context-aware answers, especially when the data is ambiguous or incomplete.

**AI Augmentation:**
The LLM is used to synthesize answers from user facts, handle ambiguous cases, and provide general knowledge when personal data is insufficient. This makes the system more powerful and user-friendly, as it can always provide a helpful response.

---

## 1. Concept Specifications

- **[Original and AI-Augmented Specs in personalqa-spec.md](./personalqa-spec.md)**

---

## 2. User Interaction Design

### Annotated Sketches

*Include or link to four low-fidelity sketches:*
- **Ask screen:** User enters a question and clicks "Ask". Annotation: The user's question and recent facts are sent to the LLM.
- **Answer with citations:** LLM returns a short answer, confidence, and cited facts. Annotation: Each claim is linked to a fact ID.
- **Inconclusive + web background:** If the LLM is inconclusive, a web note (e.g., Wikipedia summary) is shown, clearly labeled and separate from the personal answer.
- **History:** User can review past Q&As, see timestamps, and re-ask questions. Annotation: All LLM answers and web notes are stored for review.

### User Journey

Maya opens PersonalQA, types “Do late fried dinners hurt my next-day energy?” and taps **Ask**. The system selects her recent facts (late fried dinners, next-day energy check-ins), calls Gemini, and returns a **concise, cited** answer with **confidence 0.78**. If the answer is inconclusive, a clearly labeled **Web background** snippet with a source link is shown. Maya can review both Q&As in **History** to discuss with her nutritionist. The interface surfaces confidence, citations, and any fallback or web-based notes, so Maya always knows the basis for each answer and can decide whether to trust or seek more data.

---

## 3. Implementation & Running

- **Backend only:** All logic is in TypeScript, no front-end.
- **Key files:**
  - `personalqa.ts`: Core logic and LLM integration
  - `gemini-llm.ts`: Gemini API wrapper
  - `personalqa-tests.ts`: Test cases and scenarios
  - `config.json.template`: API key template (never commit your real key)
- **Run with:**
  ```bash
  npm install
  cp config.json.template config.json # Add your API key
  npm start
  ```

---

## 4. Test Scenarios: Full Sequences and Prompt Experiments

### Scenario 1: Clear Pattern
**Sequence:**
1. User logs: "Dinner: fried chicken bowl at 21:00" (meal)
2. User logs: "Next-day energy: 4/10 at 13:30" (check_in)
3. User logs: "Dinner: grilled bowl at 19:15" (meal)
4. User logs: "Next-day energy: 6/10 at 13:30" (check_in)
5. User logs: "Insight: fried + late dinner linked to lower next-day energy (conf 0.78)" (insight)
6. User asks: "Do fried late dinners hurt my next-day energy?" (LLM action)

**Experiment Paragraph:**
*Approach:* The LLM was prompted with a strict template requiring it to answer only using the user's provided facts, cite each claim, and provide a confidence score. The facts included both a clear pattern (fried late dinner → low energy) and a supporting insight. The prompt emphasized strict citation and discouraged any unsupported claims.
*What worked:* The LLM consistently produced a concise answer, cited the correct facts, and gave a high confidence score. The answer was easy to trace back to the user's data, and the LLM did not hallucinate or overgeneralize.
*What went wrong:* Occasionally, the LLM would include slightly redundant information or repeat the same fact in different words. In rare cases, it would cite more facts than necessary, making the answer less focused.
*Issues remaining:* The LLM sometimes struggles to summarize when multiple facts are very similar, leading to minor verbosity.

---

### Scenario 2: Conflicting Evidence
**Sequence:**
1. User logs: "Dinner: grilled bowl at 21:30" (meal)
2. User logs: "Next-day energy: 7/10 at 13:00" (check_in)
3. User logs: "Dinner: fried bowl at 21:30" (meal)
4. User logs: "Next-day energy: 6/10 at 13:00" (check_in)
5. User logs: "Dinner: fried bowl at 21:30" (meal)
6. User logs: "Next-day energy: 4/10 at 13:00" (check_in)
7. User asks: "Is lateness or frying affecting my next-day energy more?" (LLM action)

**Experiment Paragraph:**
*Approach:* The LLM was prompted to explicitly mention uncertainty if the evidence was inconclusive, lower its confidence score, and suggest what additional data would help. The facts were intentionally ambiguous, with both fried and grilled late dinners and mixed energy results. The prompt required the LLM to cite all relevant facts and avoid making unsupported claims.
*What worked:* The LLM acknowledged the ambiguity, cited all relevant facts, and produced a low-confidence answer. The web support fallback was triggered as intended, providing a general knowledge note.
*What went wrong:* The LLM sometimes hedged too much, using vague language like "it is unclear" or "more data is needed" without offering concrete suggestions. In some runs, it failed to clearly distinguish between the effects of lateness and frying, or it would cite all facts without prioritizing the most relevant ones.
*Issues remaining:* The LLM's ability to weigh conflicting evidence and provide actionable next steps is still limited by prompt clarity and model reasoning. More prompt engineering or post-processing may be needed for sharper answers.

---

### Scenario 3: Out-of-Scope/Edge Case
**Sequence:**
1. User logs: "Logged breakfast: oatmeal + berries" (meal)
2. User asks: "Are seed oils toxic?" (LLM action)

**Experiment Paragraph:**
*Approach:* The LLM was prompted to provide a concise general knowledge answer if no relevant facts were found, and to clearly separate personal data from web-based information. The system also required the LLM to return a low confidence score and to avoid citing unrelated facts.
*What worked:* The LLM returned a short, helpful web note and a low-confidence answer, always providing a user-facing response. The web note was clearly labeled and did not mix with the personal answer.
*What went wrong:* Occasionally, the LLM attempted to cite the only available fact (the breakfast log) even though it was unrelated, or it would provide a generic answer that was not specific to the user's question. In some cases, the web note was too broad or lacked actionable information.
*Issues remaining:* Ensuring the LLM never hallucinates citations and always clearly separates personal and web-based answers remains a challenge, especially for truly out-of-scope questions.

---

## 5. Prompt Variants: Motivation and Results

1. **Tighter grounding:**
   - *Motivation:* Prevent hallucinated or unsupported claims by requiring every sentence to be backed by cited facts. If none apply, the answer must be "Inconclusive data from your logs." with confidence ≤ 0.6.
   - *Result:* This reduced hallucination and improved trust, but sometimes led to more fallback answers when the data was sparse.
2. **Conflict handling:**
   - *Motivation:* Make the LLM explicitly state when facts conflict and lower confidence, rather than forcing a single conclusion.
   - *Result:* Scenario B became more honest and concise, but sometimes the LLM was overly cautious or vague.
3. **Conciseness + numeric example:**
   - *Motivation:* Keep answers short and focused, with at most one numeric example from the facts.
   - *Result:* Readability improved, but the LLM sometimes omitted useful nuance for the sake of brevity.

---

## 6. Validators & Guardrails

**Validator 1: Bad/missing citations**
*Explanation:* Each citation must be a selected Fact ID. If the answer is non-empty but citations are empty, the system falls back to a conservative response. This prevents the LLM from hallucinating or omitting evidence.

**Validator 2: Confidence bounds**
*Explanation:* The confidence score must be between 0 and 1. If the LLM returns a value outside this range, the system rejects the answer and falls back. This ensures that confidence is always meaningful and comparable.

**Validator 3: Over-long answer**
*Explanation:* If the answer exceeds 800 characters, it is rejected and a fallback is used. This keeps responses concise and user-friendly, and prevents runaway LLM output.

**Validator 4: Non-JSON output**
*Explanation:* The system attempts to parse the LLM output as JSON. If parsing fails, it extracts the first `{...}` block or falls back. This ensures robust handling of LLM formatting errors.

---

## 7. Reproducibility & Submission Hygiene

- **Runs with:** `npm start` (build → tests)
- **No secrets committed:** `config.json` is git-ignored
- **Readable output:** Answers show confidence and citations; web notes show a source link
- **Costs controlled:** `gemini-1.5-flash`, `maxOutputTokens: 220`, compact prompts
- **Node:** 18+ recommended

---

## 8. Known limitations / future work

- **Selection policy:** simple recency-based top-K; could be upgraded to embeddings or rule-based tagging without changing the concept surface.
- **Source variety for web note:** currently Wikipedia; could add MedlinePlus or guidelines for better health context (still separate from personal answers).
- **UI:** sketches only; the backend prints to console. A thin web UI could mirror the same JSON contract.

---

## 9. Example output (abbreviated)

```
=== Scenario C — out-of-scope ===
Answer (conf 0.20): Inconclusive data from your logs.
Citations: (none)
Web search conclusion (Wikipedia • Seed oil): <one-paragraph summary...>
Source: https://en.wikipedia.org/wiki/Seed_oil
```
