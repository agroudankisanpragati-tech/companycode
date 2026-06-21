import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const crops = [
  // TRADITIONAL CROPS
  {
    cropName: 'Wheat', cropCategory: 'Traditional',
    suitableSoilTypes: ['Loamy', 'Clay Loam', 'Sandy Loam', 'Black'],
    minPH: 6.0, maxPH: 7.5, minRainfall: 300, maxRainfall: 1000,
    minTemperature: 10, maxTemperature: 25, waterRequirement: 'medium',
    suitableSeasons: ['Rabi'], suitableIrrigationTypes: ['Canal', 'Drip', 'Sprinkler', 'Borewell', 'Flood'],
    growingDuration: 120, averageYield: 18, averageMarketPrice: 2200,
    estimatedProfit: 18000, cultivationCost: 20000, riskLevel: 'low', marketDemand: 'high',
    farmingTypes: ['organic', 'conventional', 'mixed'],
    description: 'Wheat is a staple rabi crop with stable government MSP support. Ideal for loamy and clay soils with medium irrigation.',
    cultivationProcess: '1. Deep ploughing and field prep 2. Apply DAP+Urea basal dose 3. Sow seeds at 100 kg/acre in Nov-Dec 4. First irrigation at CRI stage (21 days) 5. Second irrigation at tillering 6. Top dress urea at 30 days 7. Spray fungicide if rust appears 8. Harvest at golden stage Mar-Apr',
  },
  {
    cropName: 'Mustard', cropCategory: 'Traditional',
    suitableSoilTypes: ['Loamy', 'Sandy Loam', 'Red', 'Alluvial'],
    minPH: 6.0, maxPH: 7.5, minRainfall: 250, maxRainfall: 700,
    minTemperature: 10, maxTemperature: 25, waterRequirement: 'low',
    suitableSeasons: ['Rabi'], suitableIrrigationTypes: ['Canal', 'Borewell', 'Drip', 'Rainfed'],
    growingDuration: 110, averageYield: 8, averageMarketPrice: 5500,
    estimatedProfit: 22000, cultivationCost: 14000, riskLevel: 'low', marketDemand: 'high',
    farmingTypes: ['organic', 'conventional', 'mixed'],
    description: 'Mustard is a drought-tolerant rabi oilseed crop with low water needs and high profit margins.',
    cultivationProcess: '1. Prepare seedbed with 2-3 ploughings 2. Sow in October at 2 kg/acre 3. Apply DAP at sowing 4. First irrigation at 25-30 days 5. Top dress urea at 30 days 6. Spray against aphids if needed 7. Harvest when pods turn golden-yellow',
  },
  {
    cropName: 'Rice', cropCategory: 'Traditional',
    suitableSoilTypes: ['Clay', 'Clay Loam', 'Black', 'Alluvial'],
    minPH: 5.5, maxPH: 7.0, minRainfall: 1000, maxRainfall: 2000,
    minTemperature: 20, maxTemperature: 38, waterRequirement: 'high',
    suitableSeasons: ['Kharif'], suitableIrrigationTypes: ['Flood', 'Canal', 'Borewell'],
    growingDuration: 150, averageYield: 20, averageMarketPrice: 2100,
    estimatedProfit: 14000, cultivationCost: 28000, riskLevel: 'medium', marketDemand: 'high',
    farmingTypes: ['conventional', 'mixed'],
    description: 'Rice is the primary kharif staple requiring high water and clay-rich soils.',
    cultivationProcess: '1. Prepare nursery May-June 2. Puddle field thoroughly 3. Transplant 25-day seedlings July 4. Maintain 5 cm water level 5. Apply DAP+Urea in splits 6. Manage weeds at 20 and 40 days 7. Control blast/BLB with fungicide 8. Drain field 15 days before harvest',
  },
  {
    cropName: 'Bajra', cropCategory: 'Traditional',
    suitableSoilTypes: ['Sandy', 'Sandy Loam', 'Loamy', 'Red'],
    minPH: 6.0, maxPH: 8.0, minRainfall: 200, maxRainfall: 600,
    minTemperature: 25, maxTemperature: 42, waterRequirement: 'low',
    suitableSeasons: ['Kharif'], suitableIrrigationTypes: ['Rainfed', 'Canal', 'Borewell', 'Drip'],
    growingDuration: 90, averageYield: 10, averageMarketPrice: 2350,
    estimatedProfit: 10000, cultivationCost: 13000, riskLevel: 'low', marketDemand: 'medium',
    farmingTypes: ['organic', 'conventional', 'mixed'],
    description: 'Bajra is highly drought-tolerant, suited for arid regions with sandy soils and minimal irrigation.',
    cultivationProcess: '1. Plough field 2-3 times 2. Sow in June-July at 1.5 kg/acre 3. Thin to 15 cm at 15 days 4. Apply Urea at 30 days 5. One irrigation if available 6. Watch for downy mildew 7. Harvest when grain hardens',
  },
  {
    cropName: 'Maize', cropCategory: 'Traditional',
    suitableSoilTypes: ['Loamy', 'Sandy Loam', 'Alluvial', 'Red'],
    minPH: 5.8, maxPH: 7.5, minRainfall: 500, maxRainfall: 1000,
    minTemperature: 18, maxTemperature: 35, waterRequirement: 'medium',
    suitableSeasons: ['Kharif', 'Rabi', 'Zaid'], suitableIrrigationTypes: ['Canal', 'Drip', 'Sprinkler', 'Borewell'],
    growingDuration: 100, averageYield: 24, averageMarketPrice: 1900,
    estimatedProfit: 16000, cultivationCost: 20000, riskLevel: 'low', marketDemand: 'high',
    farmingTypes: ['organic', 'conventional', 'mixed'],
    description: 'Maize is a versatile crop grown in all seasons with good profit and multiple end uses.',
    cultivationProcess: '1. Deep plough and apply FYM 2. Sow hybrid seeds at 8 kg/acre 3. Apply DAP at sowing 4. Irrigate at 10-day intervals 5. Top dress urea at 30 and 50 days 6. Manage fall armyworm 7. Harvest at black layer formation',
  },
  {
    cropName: 'Gram', cropCategory: 'Traditional',
    suitableSoilTypes: ['Loamy', 'Sandy Loam', 'Clay Loam', 'Black'],
    minPH: 6.0, maxPH: 8.0, minRainfall: 250, maxRainfall: 700,
    minTemperature: 15, maxTemperature: 28, waterRequirement: 'low',
    suitableSeasons: ['Rabi'], suitableIrrigationTypes: ['Rainfed', 'Canal', 'Borewell', 'Drip'],
    growingDuration: 120, averageYield: 7, averageMarketPrice: 5200,
    estimatedProfit: 16000, cultivationCost: 12000, riskLevel: 'low', marketDemand: 'high',
    farmingTypes: ['organic', 'conventional', 'mixed'],
    description: 'Gram (Chickpea) is a nitrogen-fixing legume with low water needs and high market price.',
    cultivationProcess: '1. Sow treated seeds Oct-Nov 2. Seed rate 30 kg/acre 3. Apply Rhizobium culture 4. No nitrogen fertilizer needed 5. One protective irrigation 6. Control pod borer 7. Harvest when 70% pods brown',
  },
  {
    cropName: 'Soybean', cropCategory: 'Traditional',
    suitableSoilTypes: ['Loamy', 'Clay Loam', 'Black', 'Red'],
    minPH: 6.0, maxPH: 7.5, minRainfall: 600, maxRainfall: 1200,
    minTemperature: 20, maxTemperature: 35, waterRequirement: 'medium',
    suitableSeasons: ['Kharif'], suitableIrrigationTypes: ['Rainfed', 'Canal', 'Drip', 'Sprinkler'],
    growingDuration: 100, averageYield: 10, averageMarketPrice: 4300,
    estimatedProfit: 18000, cultivationCost: 15000, riskLevel: 'medium', marketDemand: 'high',
    farmingTypes: ['organic', 'conventional', 'mixed'],
    description: 'Soybean is a high-protein oilseed kharif crop with strong domestic and export demand.',
    cultivationProcess: '1. Apply lime if pH below 6.0 2. Sow Jun-Jul at 25 kg/acre 3. Treat seeds with Rhizobium+PSB 4. Apply DAP at sowing 5. Weed at 20 and 40 days 6. Monitor for girdle beetle 7. Harvest when leaves yellow',
  },
  // MEDICINAL CROPS
  {
    cropName: 'Ashwagandha', cropCategory: 'Medicinal',
    suitableSoilTypes: ['Sandy Loam', 'Sandy', 'Red', 'Loamy'],
    minPH: 7.5, maxPH: 8.5, minRainfall: 400, maxRainfall: 750,
    minTemperature: 20, maxTemperature: 38, waterRequirement: 'low',
    suitableSeasons: ['Kharif', 'Rabi'], suitableIrrigationTypes: ['Rainfed', 'Drip', 'Borewell'],
    growingDuration: 180, averageYield: 4, averageMarketPrice: 35000,
    estimatedProfit: 90000, cultivationCost: 15000, riskLevel: 'low', marketDemand: 'high',
    farmingTypes: ['organic', 'conventional', 'mixed'],
    description: 'Ashwagandha is a highly profitable medicinal crop with roots used in Ayurvedic medicine, requiring minimal water.',
    cultivationProcess: '1. Prepare well-drained sandy loam field 2. Sow seeds late June-July 3. Seed rate 2 kg/acre 4. Thin to 30 cm spacing 5. Apply organic manure 6. Minimal irrigation 2-3 times total 7. Harvest roots after 180 days 8. Dry roots in shade',
  },
  {
    cropName: 'Safed Musli', cropCategory: 'Medicinal',
    suitableSoilTypes: ['Sandy Loam', 'Loamy', 'Red'],
    minPH: 6.5, maxPH: 7.5, minRainfall: 800, maxRainfall: 1400,
    minTemperature: 25, maxTemperature: 35, waterRequirement: 'medium',
    suitableSeasons: ['Kharif'], suitableIrrigationTypes: ['Drip', 'Sprinkler', 'Borewell'],
    growingDuration: 150, averageYield: 3, averageMarketPrice: 80000,
    estimatedProfit: 180000, cultivationCost: 60000, riskLevel: 'medium', marketDemand: 'high',
    farmingTypes: ['organic', 'conventional'],
    description: 'Safed Musli is a premium medicinal crop with very high market price and export demand.',
    cultivationProcess: '1. Prepare raised beds 2. Plant tubers May-June 3. Spacing 30x30 cm 4. Apply FYM liberally 5. Drip irrigate 3-4 times/week 6. Mulch to retain moisture 7. Harvest after 150 days 8. Clean, dry and grade roots',
  },
  {
    cropName: 'Kalmegh', cropCategory: 'Medicinal',
    suitableSoilTypes: ['Loamy', 'Sandy Loam', 'Red', 'Alluvial'],
    minPH: 6.0, maxPH: 7.5, minRainfall: 600, maxRainfall: 1500,
    minTemperature: 20, maxTemperature: 35, waterRequirement: 'medium',
    suitableSeasons: ['Kharif', 'Year-round'], suitableIrrigationTypes: ['Rainfed', 'Drip', 'Canal'],
    growingDuration: 120, averageYield: 8, averageMarketPrice: 15000,
    estimatedProfit: 60000, cultivationCost: 12000, riskLevel: 'low', marketDemand: 'high',
    farmingTypes: ['organic', 'conventional', 'mixed'],
    description: 'Kalmegh is a fast-growing medicinal plant with high demand in the pharmaceutical industry.',
    cultivationProcess: '1. Nursery in April 2. Transplant at 30 days 3. Spacing 45x30 cm 4. Apply organic compost 5. Regular watering 6. Harvest aerial parts at flowering 7. Dry and sell to herbal companies',
  },
  {
    cropName: 'Aloe Vera', cropCategory: 'Medicinal',
    suitableSoilTypes: ['Sandy', 'Sandy Loam', 'Loamy', 'Red'],
    minPH: 6.5, maxPH: 8.5, minRainfall: 200, maxRainfall: 800,
    minTemperature: 20, maxTemperature: 40, waterRequirement: 'low',
    suitableSeasons: ['Year-round'], suitableIrrigationTypes: ['Drip', 'Borewell', 'Rainfed'],
    growingDuration: 240, averageYield: 50, averageMarketPrice: 1500,
    estimatedProfit: 50000, cultivationCost: 20000, riskLevel: 'low', marketDemand: 'high',
    farmingTypes: ['organic', 'conventional', 'mixed'],
    description: 'Aloe Vera is a perennial drought-tolerant plant with steady demand in cosmetics and pharma.',
    cultivationProcess: '1. Plant suckers/pups in July 2. Spacing 60x60 cm 3. Apply FYM at planting 4. Drip irrigate 2x/week 5. No pesticide needed 6. Harvest outer leaves at 8 months 7. Continue every 3 months 8. Sell fresh or to gel processors',
  },
  {
    cropName: 'Stevia', cropCategory: 'Medicinal',
    suitableSoilTypes: ['Sandy Loam', 'Loamy', 'Alluvial'],
    minPH: 6.5, maxPH: 7.5, minRainfall: 600, maxRainfall: 1500,
    minTemperature: 15, maxTemperature: 30, waterRequirement: 'medium',
    suitableSeasons: ['Year-round', 'Kharif', 'Rabi'], suitableIrrigationTypes: ['Drip', 'Sprinkler', 'Borewell'],
    growingDuration: 90, averageYield: 6, averageMarketPrice: 40000,
    estimatedProfit: 120000, cultivationCost: 40000, riskLevel: 'medium', marketDemand: 'high',
    farmingTypes: ['organic', 'conventional'],
    description: 'Stevia is a natural zero-calorie sweetener plant with contract farming and high returns.',
    cultivationProcess: '1. Propagate through cuttings 2. Plant at 40x40 cm 3. Apply balanced NPK 4. Drip irrigate daily 5. Harvest before flowering every 90 days 6. Dry leaves quickly 7. Sell via contract to sweetener companies',
  },
  {
    cropName: 'Tulsi', cropCategory: 'Medicinal',
    suitableSoilTypes: ['Loamy', 'Sandy Loam', 'Alluvial', 'Red'],
    minPH: 6.0, maxPH: 7.5, minRainfall: 500, maxRainfall: 1200,
    minTemperature: 20, maxTemperature: 38, waterRequirement: 'low',
    suitableSeasons: ['Year-round', 'Kharif'], suitableIrrigationTypes: ['Drip', 'Borewell', 'Rainfed', 'Canal'],
    growingDuration: 90, averageYield: 10, averageMarketPrice: 8000,
    estimatedProfit: 45000, cultivationCost: 8000, riskLevel: 'low', marketDemand: 'high',
    farmingTypes: ['organic', 'conventional', 'mixed'],
    description: 'Tulsi is an easy sacred herb with strong demand in pharma, FMCG, and herbal tea markets.',
    cultivationProcess: '1. Sow seeds or plant seedlings 2. Spacing 30x30 cm 3. Apply compost 4. Irrigate once a week 5. Prune regularly 6. Harvest before flowering 7. Dry leaves or sell fresh 8. Multiple harvests possible',
  },
  // FRUIT CROPS
  {
    cropName: 'Lemon', cropCategory: 'Fruit',
    suitableSoilTypes: ['Loamy', 'Sandy Loam', 'Alluvial', 'Red'],
    minPH: 5.5, maxPH: 7.0, minRainfall: 500, maxRainfall: 1200,
    minTemperature: 15, maxTemperature: 38, waterRequirement: 'medium',
    suitableSeasons: ['Year-round'], suitableIrrigationTypes: ['Drip', 'Borewell', 'Canal', 'Sprinkler'],
    growingDuration: 730, averageYield: 40, averageMarketPrice: 2500,
    estimatedProfit: 60000, cultivationCost: 30000, riskLevel: 'low', marketDemand: 'high',
    farmingTypes: ['organic', 'conventional', 'mixed'],
    description: 'Lemon is a perennial citrus crop with year-round production and stable high market demand.',
    cultivationProcess: '1. Dig 60x60 cm pits in May 2. Plant grafted saplings at 5x5 m 3. Apply FYM+DAP at planting 4. Drip irrigate 3x/week 5. Prune for shape 6. Spray micronutrients regularly 7. First commercial harvest at 3 years',
  },
  {
    cropName: 'Guava', cropCategory: 'Fruit',
    suitableSoilTypes: ['Loamy', 'Sandy Loam', 'Clay Loam', 'Alluvial'],
    minPH: 5.0, maxPH: 7.5, minRainfall: 500, maxRainfall: 1500,
    minTemperature: 15, maxTemperature: 42, waterRequirement: 'low',
    suitableSeasons: ['Year-round'], suitableIrrigationTypes: ['Drip', 'Borewell', 'Canal', 'Flood'],
    growingDuration: 365, averageYield: 60, averageMarketPrice: 2000,
    estimatedProfit: 70000, cultivationCost: 25000, riskLevel: 'low', marketDemand: 'high',
    farmingTypes: ['organic', 'conventional', 'mixed'],
    description: 'Guava is a highly adaptable hardy fruit crop with quick returns and minimal inputs.',
    cultivationProcess: '1. Plant at 5x5 m in July 2. Dig 60 cm pits with FYM 3. Apply NPK in splits 4. Drip irrigate 5. Prune after harvest 6. Manage fruit fly with bait traps 7. Harvest at 75% maturity',
  },
  {
    cropName: 'Papaya', cropCategory: 'Fruit',
    suitableSoilTypes: ['Sandy Loam', 'Loamy', 'Alluvial', 'Red'],
    minPH: 6.0, maxPH: 7.0, minRainfall: 600, maxRainfall: 1500,
    minTemperature: 22, maxTemperature: 38, waterRequirement: 'medium',
    suitableSeasons: ['Year-round', 'Kharif'], suitableIrrigationTypes: ['Drip', 'Sprinkler', 'Borewell'],
    growingDuration: 270, averageYield: 120, averageMarketPrice: 900,
    estimatedProfit: 65000, cultivationCost: 30000, riskLevel: 'medium', marketDemand: 'high',
    farmingTypes: ['organic', 'conventional'],
    description: 'Papaya is a fast-yielding fruit crop with high returns from green and ripe fruit markets.',
    cultivationProcess: '1. Sow seeds in nursery 2. Transplant at 45 days at 2x2 m spacing 3. Apply heavy organic manure 4. Drip irrigate daily 5. Remove male plants (keep 10%) 6. Spray for mosaic virus prevention 7. Harvest green for pharma or ripe for market',
  },
  {
    cropName: 'Pomegranate', cropCategory: 'Fruit',
    suitableSoilTypes: ['Loamy', 'Sandy Loam', 'Black', 'Red'],
    minPH: 5.5, maxPH: 7.5, minRainfall: 400, maxRainfall: 800,
    minTemperature: 20, maxTemperature: 40, waterRequirement: 'low',
    suitableSeasons: ['Year-round'], suitableIrrigationTypes: ['Drip', 'Borewell', 'Canal'],
    growingDuration: 730, averageYield: 50, averageMarketPrice: 5000,
    estimatedProfit: 180000, cultivationCost: 50000, riskLevel: 'medium', marketDemand: 'high',
    farmingTypes: ['organic', 'conventional', 'mixed'],
    description: 'Pomegranate is a drought-tolerant premium fruit with excellent export potential and very high profits.',
    cultivationProcess: '1. Plant cuttings at 5x3 m July 2. Deep pits with FYM+fertilizer 3. Drip irrigate 4. Stress irrigation for fruit setting 5. Bag fruits to prevent pests 6. Prune to single stem 7. Harvest 180 days from flowering 8. Grade for export',
  },
  {
    cropName: 'Ber', cropCategory: 'Fruit',
    suitableSoilTypes: ['Sandy', 'Sandy Loam', 'Red', 'Black', 'Loamy'],
    minPH: 6.0, maxPH: 8.5, minRainfall: 200, maxRainfall: 800,
    minTemperature: 18, maxTemperature: 44, waterRequirement: 'low',
    suitableSeasons: ['Year-round', 'Rabi'], suitableIrrigationTypes: ['Rainfed', 'Drip', 'Borewell', 'Canal'],
    growingDuration: 365, averageYield: 80, averageMarketPrice: 2000,
    estimatedProfit: 80000, cultivationCost: 20000, riskLevel: 'low', marketDemand: 'medium',
    farmingTypes: ['organic', 'conventional', 'mixed'],
    description: 'Ber (Indian Jujube) is an extremely hardy arid-zone fruit tree requiring minimal care once established.',
    cultivationProcess: '1. Plant in July at 5x5 m 2. Dig pits with FYM 3. Minimal fertilizer 4. Light irrigation in dry spells 5. Prune May-June 6. Control fruit fly 7. Harvest Nov-Feb 8. Productive for 30+ years',
  },
  {
    cropName: 'Dragon Fruit', cropCategory: 'Fruit',
    suitableSoilTypes: ['Sandy Loam', 'Loamy', 'Red'],
    minPH: 6.0, maxPH: 7.5, minRainfall: 300, maxRainfall: 1200,
    minTemperature: 20, maxTemperature: 38, waterRequirement: 'low',
    suitableSeasons: ['Year-round'], suitableIrrigationTypes: ['Drip', 'Sprinkler', 'Borewell'],
    growingDuration: 540, averageYield: 25, averageMarketPrice: 15000,
    estimatedProfit: 200000, cultivationCost: 80000, riskLevel: 'medium', marketDemand: 'high',
    farmingTypes: ['organic', 'conventional'],
    description: 'Dragon Fruit is a high-value exotic cactus fruit with booming export demand and premium pricing.',
    cultivationProcess: '1. Install concrete poles at 3x3 m 2. Plant 4 cuttings per pole 3. Train vines on circular ring 4. Apply organic matter+NPK 5. Drip irrigate 3x/week 6. Night lighting to boost flowering 7. Hand pollinate if needed 8. Harvest 35-50 days after flowering',
  },
];

async function seedCrops() {
  const { CropKnowledgeBase } = await import('../models/CropKnowledgeBase');
  const mongoURI = process.env.MONGODB_URI;
  if (!mongoURI) throw new Error('MONGODB_URI not set');

  await mongoose.connect(mongoURI);
  console.log('✅ MongoDB Connected');

  let inserted = 0, skipped = 0;
  for (const crop of crops) {
    const exists = await CropKnowledgeBase.findOne({ cropName: crop.cropName });
    if (exists) { skipped++; continue; }
    await CropKnowledgeBase.create(crop);
    inserted++;
    console.log(`✅ Seeded: ${crop.cropName}`);
  }
  console.log(`\n🌾 Done — ${inserted} inserted, ${skipped} skipped`);
  await mongoose.disconnect();
}

seedCrops().catch((err) => { console.error('❌ Seed failed:', err); process.exit(1); });
