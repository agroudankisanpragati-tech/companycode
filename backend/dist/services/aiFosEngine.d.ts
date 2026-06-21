export interface TaskTemplate {
    dayNumber: number;
    title: string;
    description: string;
    taskType: 'irrigation' | 'fertilizer' | 'pesticide' | 'weeding' | 'monitoring' | 'harvest' | 'general';
}
export interface StageInfo {
    name: string;
    startDay: number;
    endDay: number;
}
export declare function resolveStage(stages: StageInfo[], dayAge: number): string;
export declare function getCropLifecycle(cropName: string, growingDurationDays: number, state: string, district: string): Promise<{
    duration: number;
    stages: StageInfo[];
    tasks: TaskTemplate[];
}>;
export declare function generateDailyRecommendation(context: {
    cropName: string;
    dayAge: number;
    stage: string;
    moisture?: number;
    humidity?: number;
    temp?: number;
    modalPrice?: number;
    soilHealth?: string;
    state: string;
    district: string;
}): Promise<string>;
//# sourceMappingURL=aiFosEngine.d.ts.map