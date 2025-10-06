/** PersonalQA+LLM concept */
import { GeminiLLM } from "./gemini-llm";
export { GeminiLLM };

export type User = string;
export type FactId = string;
export type TimeISO = string;

export interface Fact { id: FactId; owner: User; at: TimeISO; content: string; source: string; }
export interface QARecord { owner: User; question: string; answer: string; citedFacts: FactId[]; confidence?: number; }
export interface PromptTemplate { name: string; text: string; }
export interface Draft { owner: User; question: string; raw: any; validated: boolean; }

export class PersonalQAStore {
  private facts: Fact[] = [];
  private qas: QARecord[] = [];
  private drafts: Draft[] = [];
  private templates = new Map<User, PromptTemplate>();

  ingestFact(args: { owner: User; at: TimeISO; content: string; source: string; }) {
    const id = uid(); this.facts.push({ id, ...args }); return id;
  }
  forgetFact(args: { requester: User; owner: User; factId: FactId; }) {
    if (args.requester !== args.owner) throw new Error("not owner");
    const before = this.facts.length;
    this.facts = this.facts.filter(f => !(f.owner===args.owner && f.id===args.factId));
    if (this.facts.length===before) throw new Error("fact_not_found");
  }
  setTemplate(args: { requester: User; name: string; template: string; }) {
    this.templates.set(args.requester, { name: args.name, text: args.template });
  }

  ask(args: { requester: User; question: string; }) {
    const pool = this.facts.filter(f=>f.owner===args.requester);
    const selection = selectTopK(pool, 10);
    const answer = conservativeSummary(args.question, selection);
    const citedFacts = selection.map(f=>f.id);
    const qa: QARecord = { owner: args.requester, question: args.question, answer, citedFacts, confidence: 0.2 };
    this.qas.push(qa); return qa;
  }

  async askLLM(args: { requester: User; question: string; k?: number; model?: string; }) {
    const pool = this.facts.filter(f => f.owner === args.requester);
    if (pool.length === 0) throw new Error("no_facts_for_user");
    const k = args.k ?? 12;
    const selection = selectTopK(pool, k);
    const tpl = this.templates.get(args.requester)?.text || DEFAULT_TEMPLATE;
    const prompt = fillTemplate(tpl, { question: args.question, facts: selection });
  // Load config and instantiate GeminiLLM
  const path = require('path');
  const configPath = path.resolve(__dirname, '../config.json');
  const config = require(configPath);
  const llm = new GeminiLLM(config);
  const rawText = await llm.executeLLM(prompt);
  const draftJson = safeParseJSON(rawText);
  const draft: Draft = { owner: args.requester, question: args.question, raw: draftJson, validated: false };
  this.drafts.push(draft);
  validateDraft(draftJson, selection);
  const qa: QARecord = { owner: args.requester, question: args.question, answer: draftJson.answer.trim(), citedFacts: draftJson.citations, confidence: draftJson.confidence };
  this.qas.push(qa); draft.validated = true; return qa;
  }

  listFacts(owner: User){ return this.facts.filter(f=>f.owner===owner); }
  listQAs(owner: User){ return this.qas.filter(q=>q.owner===owner); }
  listDrafts(owner: User){ return this.drafts.filter(d=>d.owner===owner); }
}

function uid(): string { return Math.random().toString(36).slice(2,10); }
function selectTopK(pool: Fact[], k: number): Fact[] { const sorted=[...pool].sort((a,b)=>a.at<b.at?-1:1); return sorted.slice(-k); }
function conservativeSummary(question: string, facts: Fact[]): string {
  if (facts.length===0) return "Insufficient data to answer yet.";
  const bits = facts.slice(-3).map(f=>`[${f.id}] ${f.content}`).join(" | ");
  return `Based on your recent facts: ${bits}. I would need more data to be confident about “${question}”.`;
}

export const DEFAULT_TEMPLATE = `You are a careful coach answering ONLY with the user's provided facts.
Return STRICT JSON of the shape:
{"answer": "...", "citations": ["factId1","factId2"], "confidence": 0.0}
Rules:
- Keep the answer ≤ 120 words.
- Every claim MUST be supported by provided facts; cite by fact ids.
- You MUST ONLY use fact IDs exactly as shown below in your citations. Do NOT invent, change, or guess any IDs. If you cite a fact, copy its ID exactly as given.
- If facts conflict, clearly describe the nature of the conflict, mention uncertainty, and lower confidence. Suggest what additional data would help resolve the ambiguity.
- If evidence is weak or inconclusive, make a clear, reasoned conclusion based on the closest facts, but lower the confidence accordingly. Never refuse to answer. If the data is inconclusive, suggest what a web search might reveal or what further information would be needed, and include this in your answer.
- For every answer, you must always cite at least one fact from the provided list, even if it is only tangentially related to the question.
- When reasoning about meal timing, interpret times after 20:00 as 'late' and before 18:00 as 'early'. Use this in your answer if relevant.
- If possible, include one concrete numeric example from the facts to support your answer.
- If the question is out of scope for the provided facts, state this clearly, cite the closest fact, and suggest a web search or further data. In this case, also provide a clearly labeled "Web note" with a general knowledge answer, separated from the personal answer.
Question: {{question}}
Facts (id: text):
{{facts}}`;

function fillTemplate(template: string, ctx: { question: string; facts: Fact[]; }) {
  const factsBlock = ctx.facts.map(f=>`${f.id}: ${f.content} (src:${f.source}, at:${f.at})`).join("\n");
  return template.replace("{{question}}", ctx.question).replace("{{facts}}", factsBlock);
}
function safeParseJSON(s: string): any {
  // Remove code block markers if present
  const cleaned = s.trim().replace(/^```json\s*|^```\s*|```$/gim, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    return { error: "bad_json", raw: s, answer: "", citations: [], confidence: 0 };
  }
}
export function validateDraft(draft: any, selectedFacts: Fact[]) {
  const ids = new Set(selectedFacts.map(f=>f.id));
  if (!draft || typeof draft.answer!=="string" || draft.answer.trim().length===0) throw new Error("LLM_EMPTY_ANSWER");
  if (!Array.isArray(draft.citations) || draft.citations.length===0) throw new Error("LLM_NO_CITATIONS");
  for (const c of draft.citations) if (!ids.has(c)) throw new Error("LLM_BAD_CITATION");
  if (draft.answer.length>800) throw new Error("LLM_TOO_LONG");
  if (typeof draft.confidence!=="number" || draft.confidence<0 || draft.confidence>1) throw new Error("LLM_CONFIDENCE_RANGE");
}
