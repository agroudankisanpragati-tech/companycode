/**
 * Shared types for all internal data-fetching modules used by Pragati AI.
 * These modules are internal — they never communicate directly with the user.
 * All results flow back through Pragati AI → Language Engine.
 */
export interface AgentContext {
    userId: string;
    message: string;
    /** Farmer profile data passed from the chat request */
    farmerProfile?: {
        name?: string;
        district?: string;
        state?: string;
        farmSize?: string;
        soilType?: string;
    };
    /** Live page data from the frontend */
    pageData?: Record<string, any>;
}
export interface AgentResult {
    agent: AgentName;
    success: boolean;
    /** Structured data to be injected into Pragati AI's context block */
    data?: Record<string, any>;
    /** Human-readable summary for Pragati AI to use */
    summary?: string;
    error?: string;
}
export type AgentName = 'GreetingAgent' | 'DiseaseAgent' | 'CropAgent' | 'SoilAgent' | 'WeatherAgent' | 'MarketAgent' | 'GovernmentAgent' | 'KVKAgent' | 'SeedAgent' | 'FertilizerAgent' | 'FarmDiaryAgent' | 'IrrigationAgent' | 'EmergencyAgent' | 'MachineryAgent' | 'GeneralAgent';
//# sourceMappingURL=types.d.ts.map