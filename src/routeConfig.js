export const REGULAR_ROUTES = [
  { route: 'J01', vehicle: '56', capacity: 45, stops: 17, firstStop: 'Brisa da Serra (Posto Médico)', lastStop: 'Abaré Radiadores (Av. Sete de Setembro)' },
  { route: 'J02', vehicle: '59', capacity: 45, stops: 16, firstStop: 'Alto da Aliança (Padaria Vitória)', lastStop: 'BR 428 (Pousada Garden)' },
  { route: 'L01', vehicle: '58', capacity: 45, stops: 6, firstStop: 'Auto Grande', lastStop: 'BR 428 (Placa)' },
  { route: 'L02', vehicle: '62', capacity: 45, stops: 5, firstStop: 'Bairro do Vasco (Juca Som)', lastStop: 'BR 428 (Placa)' },
  { route: 'L03', vehicle: '95', capacity: 48, stops: 3, firstStop: 'Posto Fiscal', lastStop: 'BR 428 (Três Postes)' },
  { route: 'L04', vehicle: '97', capacity: 48, stops: 2, firstStop: 'Izacolândia (Praça)', lastStop: 'BR 428 (Assentamento Massueto)' },
  { route: 'N01', vehicle: '46', capacity: 44, stops: 10, firstStop: "Caixa D'Água", lastStop: 'N11' },
  { route: 'N02', vehicle: '98', capacity: 48, stops: 4, firstStop: 'Rua do Rio', lastStop: "Caixa D'Água" },
  { route: 'P01', vehicle: '54', capacity: 45, stops: 13, firstStop: 'BR 407 Quati (Barraca do Antônio)', lastStop: 'Bernardino (Mercadinho Bom Lar)' },
  { route: 'P02', vehicle: '105', capacity: 48, stops: 10, firstStop: 'Aldiegas', lastStop: 'N10' },
  { route: 'P03', vehicle: '94', capacity: 48, stops: 15, firstStop: 'Rua 15 — Jardim Guararapes (Posto Guararapes)', lastStop: 'Posto Reis' },
  { route: 'P04', vehicle: '65', capacity: 45, stops: 8, firstStop: 'Contorno Maria Maga (Padaria Delícia do Trigo)', lastStop: 'Av. do Petróleo (Assembleia de Deus)' },
  { route: 'P05', vehicle: '99', capacity: 48, stops: 13, firstStop: 'Henrique Leite (Farmácia)', lastStop: 'Dom Avelar - R. da Caridade (Oficina Primeira Linha)' },
];

export const VARIABLE_ROUTES = [
  { route: 'J03', aliases: ['J03', 'J03-A', 'J03-B'], capacity: 48, label: 'Configuração variável · baixa demanda esperada' },
  { route: 'P06', aliases: ['P06', 'P06-B'], capacity: 48, label: 'Configuração variável · baixa demanda esperada' },
  { route: 'P08', aliases: ['P08'], capacity: 48, label: 'Configuração variável · baixa demanda esperada' },
];

export const ROUTE_FAMILIES = [...REGULAR_ROUTES, ...VARIABLE_ROUTES];

export function routeFamilyFor(route = '') {
  const normalized = String(route).trim().toUpperCase();
  return VARIABLE_ROUTES.find((item) => item.aliases.includes(normalized))?.route || normalized;
}
