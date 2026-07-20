export interface YoloCropClass {
    class_id: number;
    class_name: string;
    category: string;
}
export interface YoloCrop {
    crop_key: string;
    crop_name: string;
    class_count: number;
    classes: YoloCropClass[];
}
export interface YoloPrediction {
    success: true;
    status: 'success';
    engine: 'yolo';
    crop: string;
    category: string;
    class_name: string;
    confidence: number;
    crop_filtered: boolean;
    top5: Array<{
        rank: number;
        class_id: number;
        class_name: string;
        confidence: number;
        crop: string;
        category: string;
    }>;
    inference_ms: number;
}
export declare function fetchCropsFromYolo(): Promise<YoloCrop[]>;
export declare function isCropSupportedByYolo(cropHint: string): Promise<boolean>;
export declare function callYoloPredict(imagePath: string, cropHint?: string): Promise<YoloPrediction | null>;
export declare function isYoloServiceHealthy(): Promise<boolean>;
//# sourceMappingURL=yoloService.d.ts.map