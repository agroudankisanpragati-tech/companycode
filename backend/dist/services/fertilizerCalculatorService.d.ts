export type AreaUnit = 'bigha' | 'acre' | 'hectare' | 'guntha' | 'katha';
export interface SoilNutrients {
    nitrogen?: number;
    phosphorus?: number;
    potassium?: number;
    organicCarbon?: number;
    pH?: number;
}
export interface FertilizerCalcInput {
    crop: string;
    areaValue: number;
    areaUnit: AreaUnit;
    soil?: SoilNutrients;
}
export interface OrganicOption {
    name: string;
    nameHi: string;
    quantity: string;
    benefit: string;
    benefitHi: string;
    priority: number;
}
export interface ChemicalFertilizer {
    name: string;
    nameHi: string;
    npkRatio: string;
    quantityKg: number;
    quantityPerUnit: string;
    nutrientProvided: string;
    applicationTime: string;
    applicationTimeHi: string;
    costEstimate: string;
}
export interface FertilizerCalcResult {
    crop: string;
    cropHi: string;
    areaHectares: number;
    areaDisplay: string;
    requiredN: number;
    requiredP: number;
    requiredK: number;
    deficitN: number;
    deficitP: number;
    deficitK: number;
    organicFirst: OrganicOption[];
    chemicalFertilizers: ChemicalFertilizer[];
    applicationSchedule: {
        stage: string;
        stageHi: string;
        products: string;
    }[];
    totalCostMin: number;
    totalCostMax: number;
    soilUsed: boolean;
    tips: string[];
    tipsHi: string[];
}
export declare function calculateFertilizer(input: FertilizerCalcInput): FertilizerCalcResult;
export declare const SUPPORTED_CROPS: {
    key: string;
    label: string;
    labelHi: string;
}[];
export declare const AREA_UNITS: {
    value: AreaUnit;
    label: string;
    labelHi: string;
}[];
//# sourceMappingURL=fertilizerCalculatorService.d.ts.map