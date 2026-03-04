export const vehicleMakes = [
  'Toyota',
  'Nissan',
  'Honda',
  'Mazda',
  'Subaru',
  'Mitsubishi',
  'Suzuki',
  'Daihatsu',
  'Isuzu',
  'Lexus',
] as const

export const vehicleModels: Record<string, string[]> = {
  Toyota: [
    'Aqua', 'Alphard', 'Vellfire', 'Crown', 'Crown Athlete', 'Crown Majesta',
    'Corolla', 'Corolla Axio', 'Corolla Fielder', 'Corolla Touring', 'Camry',
    'Mark X', 'Prius', 'Prius Alpha', 'Prius PHV', 'GR86', '86', 'Supra',
    'Yaris', 'Yaris Cross', 'Raize', 'Rush', 'RAV4', 'Harrier', 'Vanguard',
    'Kluger', 'Highlander', 'Land Cruiser 70', 'Land Cruiser 80',
    'Land Cruiser 100', 'Land Cruiser 200', 'Land Cruiser 300', 'Prado',
    'Fortuner', 'Sequoia', '4Runner', 'Hiace', 'TownAce', 'Noah', 'Voxy',
    'Esquire', 'Sienta', 'Estima', 'Wish', 'Probox', 'Succeed', 'Hilux',
    'Tacoma', 'Tundra'
  ],
  Nissan: [
    'March', 'Note', 'Note Aura', 'Tiida', 'Sylphy', 'Bluebird', 'Sunny',
    'Altima', 'Teana', 'Fuga', 'Cima', 'Skyline', 'Skyline GT-R', 'GT-R',
    'Fairlady Z', 'Leaf', 'Ariya', 'Juke', 'Kicks', 'Dualis', 'Qashqai',
    'X-Trail', 'Rogue', 'Murano', 'Pathfinder', 'Elgrand', 'Serena',
    'Caravan', 'NV200', 'Navara', 'Titan'
  ],
  Honda: [
    'Fit', 'Fit Shuttle', 'City', 'Civic', 'Civic Type R', 'Accord', 'Inspire',
    'Legend', 'Grace', 'Insight', 'CR-Z', 'HR-V', 'Vezel', 'ZR-V', 'CR-V',
    'Pilot', 'Odyssey', 'Stepwgn', 'Freed', 'Shuttle', 'Ridgeline'
  ],
  Mazda: [
    'Demio', 'Mazda2', 'Mazda3 (Axela)', 'Mazda6 (Atenza)', 'CX-3', 'CX-30',
    'CX-5', 'CX-8', 'CX-9', 'MX-5 (Roadster)', 'RX-7', 'RX-8', 'BT-50',
    'Bongo', 'Familia'
  ],
  Subaru: [
    'Impreza', 'Impreza WRX', 'WRX STI', 'Legacy', 'Legacy B4', 'Levorg',
    'BRZ', 'XV', 'Crosstrek', 'Forester', 'Outback', 'Exiga', 'Stella', 'R1', 'R2'
  ],
  Mitsubishi: [
    'Mirage', 'Colt', 'Lancer', 'Lancer Evolution', 'Galant', 'Eclipse',
    'ASX', 'RVR', 'Outlander', 'Outlander PHEV', 'Pajero', 'Pajero Mini',
    'Pajero Sport', 'Delica D:5', 'Triton', 'Minicab'
  ],
  Suzuki: [
    'Alto', 'Alto Works', 'Wagon R', 'Wagon R Stingray', 'Swift', 'Swift Sport',
    'Baleno', 'Ignis', 'Solio', 'Hustler', 'Jimny', 'Jimny Sierra', 'Vitara',
    'Escudo', 'Ertiga', 'Every', 'Carry'
  ],
  Daihatsu: [
    'Mira', 'Mira e:S', 'Move', 'Move Custom', 'Tanto', 'Tanto Custom',
    'Rocky', 'Terios', 'Be-Go', 'Cast', 'Copen', 'Hijet', 'Atrai', 'Boon', 'Thor'
  ],
  Isuzu: [
    'MU-X', 'VehiCross', 'Wizard', 'D-Max'
  ],
  Lexus: [
    'CT', 'IS', 'IS F', 'ES', 'GS', 'GS F', 'LS', 'RC', 'RC F', 'LC', 'UX',
    'NX', 'RX', 'RZ', 'GX', 'LX'
  ],
}

export function getModelsForMake(make: string): string[] {
  return vehicleModels[make] || []
}


