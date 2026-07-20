/**
 * Shared Memory Engine — Phase 5
 *
 * One shared memory service used by Pragati AI and every internal module.
 * Reads and writes to FarmerMemory (MongoDB) per farmer.
 *
 * Architecture:
 *   User → Language Engine → Pragati AI → Internal Modules
 *        → Shared Memory Engine → Language Engine → User
 *
 * Responsibilities:
 * 1. Store/retrieve conversation history (capped at 100 turns)
 * 2. Store/retrieve farmer preferences (lang, dialect, topics)
 * 3. Track domain history references (crop, disease, soil, advisory)
 * 4. Track frequently asked questions
 * 5. Run alias engine on unknown words after each turn
 * 6. Build memory context block for Pragati AI's system prompt
 *
 * Rules:
 * - Never retrain AI automatically
 * - Never auto-approve dictionary words
 * - Never modify existing workflows
 * - Failures are non-fatal (memory is enhancement, not core)
 */
import { IConversationTurn, IFAQEntry } from '../models/FarmerMemory';
export interface MemoryWriteInput {
    userId: string;
    userMessage: string;
    assistantReply: string;
    pageContext?: string;
    agentUsed?: string;
    langCode?: string;
    /** Domain refs to append */
    refs?: {
        cropAdvisoryId?: string;
        diseaseId?: string;
        soilReportId?: string;
        cropId?: string;
    };
}
export interface MemoryContext {
    /** Last N conversation turns for context injection */
    recentHistory: IConversationTurn[];
    /** Farmer's language and dialect preferences */
    preferences: {
        selectedLang: string;
        selectedDialect?: string;
        voiceEnabled: boolean;
        preferredTopics: string[];
    };
    /** Top 5 most asked questions */
    topFAQs: IFAQEntry[];
    /** Summary stats */
    totalInteractions: number;
    lastActivePageContext?: string;
}
/**
 * Load farmer memory context for injection into Pragati AI's prompt.
 * Returns safe defaults if no memory exists yet.
 */
export declare function loadMemoryContext(userId: string): Promise<MemoryContext>;
/**
 * Persist a conversation turn and update all memory fields.
 * Called AFTER the AI response is sent to the user.
 * Non-blocking — errors are logged but never thrown.
 */
export declare function writeMemoryTurn(input: MemoryWriteInput): Promise<void>;
/**
 * Update farmer language/dialect preference in memory.
 * Called when user changes language in the UI.
 */
export declare function updateLanguagePreference(userId: string, langCode: string, dialectCode?: string): Promise<void>;
/**
 * Update preferred topics based on which agents were used.
 */
export declare function updatePreferredTopics(userId: string, agentDomain: string): Promise<void>;
/**
 * Build a memory context string for injection into Pragati AI's system prompt.
 * Keeps it compact to avoid bloating the prompt.
 */
export declare function buildMemoryContextBlock(ctx: MemoryContext): string;
//# sourceMappingURL=memoryEngine.d.ts.map