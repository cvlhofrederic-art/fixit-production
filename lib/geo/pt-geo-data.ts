// Auto-généré depuis json.geoapi.pt — NE PAS MODIFIER À LA MAIN
// Sources : https://json.geoapi.pt/distrito/porto/municipios + freguesias
// Dernière mise à jour : 2026-04-16
// Phase test : district de Porto uniquement

export interface PTDistrito {
  code: string
  nom: string
  regiao: string
}

export interface PTCommune {
  nom: string
  cp: string
  code: string
  population: number
  parent?: string
  type: 'municipio' | 'freguesia'
}

// Phase test : uniquement Porto (district 13)
export const PT_DISTRITOS: PTDistrito[] = [
  { code: '13', nom: 'Porto', regiao: 'Norte' },
]

// Phase test : uniquement Norte
export const PT_REGIOES: string[] = [
  'Norte',
]

// 18 concelhos + 275 freguesias du district de Porto
export const COMMUNES_PT_PORTO: PTCommune[] = [
  {
    "nom": "Abragão",
    "cp": "",
    "code": "1311_0",
    "population": 0,
    "parent": "Penafiel",
    "type": "freguesia"
  },
  {
    "nom": "Agrela",
    "cp": "",
    "code": "1314_0",
    "population": 0,
    "parent": "Santo Tirso",
    "type": "freguesia"
  },
  {
    "nom": "Aguiar de Sousa",
    "cp": "",
    "code": "1310_0",
    "population": 0,
    "parent": "Paredes",
    "type": "freguesia"
  },
  {
    "nom": "Aguçadoura",
    "cp": "",
    "code": "1313_0",
    "population": 0,
    "parent": "Póvoa de Varzim",
    "type": "freguesia"
  },
  {
    "nom": "Airães",
    "cp": "",
    "code": "1303_0",
    "population": 0,
    "parent": "Felgueiras",
    "type": "freguesia"
  },
  {
    "nom": "Aião",
    "cp": "",
    "code": "1303_1",
    "population": 0,
    "parent": "Felgueiras",
    "type": "freguesia"
  },
  {
    "nom": "Alfena",
    "cp": "",
    "code": "1315_0",
    "population": 0,
    "parent": "Valongo",
    "type": "freguesia"
  },
  {
    "nom": "Alpendorada, Várzea e Torrão",
    "cp": "",
    "code": "1307_0",
    "population": 0,
    "parent": "Marco de Canaveses",
    "type": "freguesia"
  },
  {
    "nom": "Alvarelhos",
    "cp": "",
    "code": "1318_0",
    "population": 0,
    "parent": "Trofa",
    "type": "freguesia"
  },
  {
    "nom": "Amarante",
    "cp": "",
    "code": "1301",
    "population": 0,
    "type": "municipio"
  },
  {
    "nom": "Amorim",
    "cp": "",
    "code": "1313_1",
    "population": 0,
    "parent": "Póvoa de Varzim",
    "type": "freguesia"
  },
  {
    "nom": "Ansiães",
    "cp": "",
    "code": "1301_0",
    "population": 0,
    "parent": "Amarante",
    "type": "freguesia"
  },
  {
    "nom": "Arcos",
    "cp": "",
    "code": "1316_0",
    "population": 0,
    "parent": "Vila do Conde",
    "type": "freguesia"
  },
  {
    "nom": "Arcozelo",
    "cp": "",
    "code": "1317_0",
    "population": 0,
    "parent": "Vila Nova de Gaia",
    "type": "freguesia"
  },
  {
    "nom": "Argivai",
    "cp": "",
    "code": "1313_2",
    "population": 0,
    "parent": "Póvoa de Varzim",
    "type": "freguesia"
  },
  {
    "nom": "Arreigada",
    "cp": "",
    "code": "1309_0",
    "population": 0,
    "parent": "Paços de Ferreira",
    "type": "freguesia"
  },
  {
    "nom": "Astromil",
    "cp": "",
    "code": "1310_1",
    "population": 0,
    "parent": "Paredes",
    "type": "freguesia"
  },
  {
    "nom": "Aveleda",
    "cp": "",
    "code": "1305_0",
    "population": 0,
    "parent": "Lousada",
    "type": "freguesia"
  },
  {
    "nom": "Aveleda",
    "cp": "",
    "code": "1316_1",
    "population": 0,
    "parent": "Vila do Conde",
    "type": "freguesia"
  },
  {
    "nom": "Aver-o-Mar",
    "cp": "",
    "code": "1313_3",
    "population": 0,
    "parent": "Póvoa de Varzim",
    "type": "freguesia"
  },
  {
    "nom": "Aves",
    "cp": "",
    "code": "1314_1",
    "population": 0,
    "parent": "Santo Tirso",
    "type": "freguesia"
  },
  {
    "nom": "Avessadas e Rosém",
    "cp": "",
    "code": "1307_1",
    "population": 0,
    "parent": "Marco de Canaveses",
    "type": "freguesia"
  },
  {
    "nom": "Avintes",
    "cp": "",
    "code": "1317_1",
    "population": 0,
    "parent": "Vila Nova de Gaia",
    "type": "freguesia"
  },
  {
    "nom": "Azurara",
    "cp": "",
    "code": "1316_2",
    "population": 0,
    "parent": "Vila do Conde",
    "type": "freguesia"
  },
  {
    "nom": "Baguim do Monte (Rio Tinto)",
    "cp": "",
    "code": "1304_0",
    "population": 0,
    "parent": "Gondomar",
    "type": "freguesia"
  },
  {
    "nom": "Baião",
    "cp": "",
    "code": "1302",
    "population": 0,
    "type": "municipio"
  },
  {
    "nom": "Balazar",
    "cp": "",
    "code": "1313_4",
    "population": 0,
    "parent": "Póvoa de Varzim",
    "type": "freguesia"
  },
  {
    "nom": "Baltar",
    "cp": "",
    "code": "1310_2",
    "population": 0,
    "parent": "Paredes",
    "type": "freguesia"
  },
  {
    "nom": "Banho e Carvalhosa",
    "cp": "",
    "code": "1307_2",
    "population": 0,
    "parent": "Marco de Canaveses",
    "type": "freguesia"
  },
  {
    "nom": "Barrosas (Santo Estêvão)",
    "cp": "",
    "code": "1305_1",
    "population": 0,
    "parent": "Lousada",
    "type": "freguesia"
  },
  {
    "nom": "Beire",
    "cp": "",
    "code": "1310_3",
    "population": 0,
    "parent": "Paredes",
    "type": "freguesia"
  },
  {
    "nom": "Beiriz",
    "cp": "",
    "code": "1313_5",
    "population": 0,
    "parent": "Póvoa de Varzim",
    "type": "freguesia"
  },
  {
    "nom": "Bem Viver",
    "cp": "",
    "code": "1307_3",
    "population": 0,
    "parent": "Marco de Canaveses",
    "type": "freguesia"
  },
  {
    "nom": "Boelhe",
    "cp": "",
    "code": "1311_1",
    "population": 0,
    "parent": "Penafiel",
    "type": "freguesia"
  },
  {
    "nom": "Bonfim",
    "cp": "",
    "code": "1312_0",
    "population": 0,
    "parent": "Porto",
    "type": "freguesia"
  },
  {
    "nom": "Bustelo",
    "cp": "",
    "code": "1311_2",
    "population": 0,
    "parent": "Penafiel",
    "type": "freguesia"
  },
  {
    "nom": "Cabeça Santa",
    "cp": "",
    "code": "1311_3",
    "population": 0,
    "parent": "Penafiel",
    "type": "freguesia"
  },
  {
    "nom": "Campanhã",
    "cp": "",
    "code": "1312_1",
    "population": 0,
    "parent": "Porto",
    "type": "freguesia"
  },
  {
    "nom": "Campo",
    "cp": "",
    "code": "1315_1",
    "population": 0,
    "parent": "Valongo",
    "type": "freguesia"
  },
  {
    "nom": "Candemil",
    "cp": "",
    "code": "1301_1",
    "population": 0,
    "parent": "Amarante",
    "type": "freguesia"
  },
  {
    "nom": "Canelas",
    "cp": "",
    "code": "1311_4",
    "population": 0,
    "parent": "Penafiel",
    "type": "freguesia"
  },
  {
    "nom": "Canelas",
    "cp": "",
    "code": "1317_2",
    "population": 0,
    "parent": "Vila Nova de Gaia",
    "type": "freguesia"
  },
  {
    "nom": "Canidelo",
    "cp": "",
    "code": "1316_3",
    "population": 0,
    "parent": "Vila do Conde",
    "type": "freguesia"
  },
  {
    "nom": "Canidelo",
    "cp": "",
    "code": "1317_3",
    "population": 0,
    "parent": "Vila Nova de Gaia",
    "type": "freguesia"
  },
  {
    "nom": "Capela",
    "cp": "",
    "code": "1311_5",
    "population": 0,
    "parent": "Penafiel",
    "type": "freguesia"
  },
  {
    "nom": "Carvalhosa",
    "cp": "",
    "code": "1309_1",
    "population": 0,
    "parent": "Paços de Ferreira",
    "type": "freguesia"
  },
  {
    "nom": "Castelões",
    "cp": "",
    "code": "1311_6",
    "population": 0,
    "parent": "Penafiel",
    "type": "freguesia"
  },
  {
    "nom": "Castêlo da Maia",
    "cp": "",
    "code": "1306_0",
    "population": 0,
    "parent": "Maia",
    "type": "freguesia"
  },
  {
    "nom": "Caíde de Rei",
    "cp": "",
    "code": "1305_2",
    "population": 0,
    "parent": "Lousada",
    "type": "freguesia"
  },
  {
    "nom": "Cete",
    "cp": "",
    "code": "1310_4",
    "population": 0,
    "parent": "Paredes",
    "type": "freguesia"
  },
  {
    "nom": "Cidade da Maia",
    "cp": "",
    "code": "1306_1",
    "population": 0,
    "parent": "Maia",
    "type": "freguesia"
  },
  {
    "nom": "Codessos",
    "cp": "",
    "code": "1309_2",
    "population": 0,
    "parent": "Paços de Ferreira",
    "type": "freguesia"
  },
  {
    "nom": "Constance",
    "cp": "",
    "code": "1307_4",
    "population": 0,
    "parent": "Marco de Canaveses",
    "type": "freguesia"
  },
  {
    "nom": "Covelas",
    "cp": "",
    "code": "1318_1",
    "population": 0,
    "parent": "Trofa",
    "type": "freguesia"
  },
  {
    "nom": "Crestuma",
    "cp": "",
    "code": "1317_4",
    "population": 0,
    "parent": "Vila Nova de Gaia",
    "type": "freguesia"
  },
  {
    "nom": "Cristelo",
    "cp": "",
    "code": "1310_5",
    "population": 0,
    "parent": "Paredes",
    "type": "freguesia"
  },
  {
    "nom": "Croca",
    "cp": "",
    "code": "1311_7",
    "population": 0,
    "parent": "Penafiel",
    "type": "freguesia"
  },
  {
    "nom": "Custóias",
    "cp": "",
    "code": "1308_0",
    "population": 0,
    "parent": "Matosinhos",
    "type": "freguesia"
  },
  {
    "nom": "Duas Igrejas",
    "cp": "",
    "code": "1310_6",
    "population": 0,
    "parent": "Paredes",
    "type": "freguesia"
  },
  {
    "nom": "Duas Igrejas",
    "cp": "",
    "code": "1311_8",
    "population": 0,
    "parent": "Penafiel",
    "type": "freguesia"
  },
  {
    "nom": "Eiriz",
    "cp": "",
    "code": "1309_3",
    "population": 0,
    "parent": "Paços de Ferreira",
    "type": "freguesia"
  },
  {
    "nom": "Eja",
    "cp": "",
    "code": "1311_9",
    "population": 0,
    "parent": "Penafiel",
    "type": "freguesia"
  },
  {
    "nom": "Ermesinde",
    "cp": "",
    "code": "1315_2",
    "population": 0,
    "parent": "Valongo",
    "type": "freguesia"
  },
  {
    "nom": "Estela",
    "cp": "",
    "code": "1313_6",
    "population": 0,
    "parent": "Póvoa de Varzim",
    "type": "freguesia"
  },
  {
    "nom": "Fajozes",
    "cp": "",
    "code": "1316_4",
    "population": 0,
    "parent": "Vila do Conde",
    "type": "freguesia"
  },
  {
    "nom": "Felgueiras",
    "cp": "",
    "code": "1303",
    "population": 0,
    "type": "municipio"
  },
  {
    "nom": "Ferreira",
    "cp": "",
    "code": "1309_4",
    "population": 0,
    "parent": "Paços de Ferreira",
    "type": "freguesia"
  },
  {
    "nom": "Figueiró",
    "cp": "",
    "code": "1309_5",
    "population": 0,
    "parent": "Paços de Ferreira",
    "type": "freguesia"
  },
  {
    "nom": "Folgosa",
    "cp": "",
    "code": "1306_2",
    "population": 0,
    "parent": "Maia",
    "type": "freguesia"
  },
  {
    "nom": "Fonte Arcada",
    "cp": "",
    "code": "1311_10",
    "population": 0,
    "parent": "Penafiel",
    "type": "freguesia"
  },
  {
    "nom": "Fornelo",
    "cp": "",
    "code": "1316_5",
    "population": 0,
    "parent": "Vila do Conde",
    "type": "freguesia"
  },
  {
    "nom": "Frazão",
    "cp": "",
    "code": "1309_6",
    "population": 0,
    "parent": "Paços de Ferreira",
    "type": "freguesia"
  },
  {
    "nom": "Freamunde",
    "cp": "",
    "code": "1309_7",
    "population": 0,
    "parent": "Paços de Ferreira",
    "type": "freguesia"
  },
  {
    "nom": "Fregim",
    "cp": "",
    "code": "1301_2",
    "population": 0,
    "parent": "Amarante",
    "type": "freguesia"
  },
  {
    "nom": "Frende",
    "cp": "",
    "code": "1302_0",
    "population": 0,
    "parent": "Baião",
    "type": "freguesia"
  },
  {
    "nom": "Friande",
    "cp": "",
    "code": "1303_2",
    "population": 0,
    "parent": "Felgueiras",
    "type": "freguesia"
  },
  {
    "nom": "Fridão",
    "cp": "",
    "code": "1301_3",
    "population": 0,
    "parent": "Amarante",
    "type": "freguesia"
  },
  {
    "nom": "Galegos",
    "cp": "",
    "code": "1311_11",
    "population": 0,
    "parent": "Penafiel",
    "type": "freguesia"
  },
  {
    "nom": "Gandra",
    "cp": "",
    "code": "1310_7",
    "population": 0,
    "parent": "Paredes",
    "type": "freguesia"
  },
  {
    "nom": "Gestaçô",
    "cp": "",
    "code": "1302_1",
    "population": 0,
    "parent": "Baião",
    "type": "freguesia"
  },
  {
    "nom": "Gião",
    "cp": "",
    "code": "1316_6",
    "population": 0,
    "parent": "Vila do Conde",
    "type": "freguesia"
  },
  {
    "nom": "Gondar",
    "cp": "",
    "code": "1301_4",
    "population": 0,
    "parent": "Amarante",
    "type": "freguesia"
  },
  {
    "nom": "Gondomar",
    "cp": "",
    "code": "1304",
    "population": 0,
    "type": "municipio"
  },
  {
    "nom": "Gouveia (São Simão)",
    "cp": "",
    "code": "1301_5",
    "population": 0,
    "parent": "Amarante",
    "type": "freguesia"
  },
  {
    "nom": "Gove",
    "cp": "",
    "code": "1302_2",
    "population": 0,
    "parent": "Baião",
    "type": "freguesia"
  },
  {
    "nom": "Grijó",
    "cp": "",
    "code": "1317_5",
    "population": 0,
    "parent": "Vila Nova de Gaia",
    "type": "freguesia"
  },
  {
    "nom": "Grilo",
    "cp": "",
    "code": "1302_3",
    "population": 0,
    "parent": "Baião",
    "type": "freguesia"
  },
  {
    "nom": "Guidões",
    "cp": "",
    "code": "1318_2",
    "population": 0,
    "parent": "Trofa",
    "type": "freguesia"
  },
  {
    "nom": "Guifões",
    "cp": "",
    "code": "1308_1",
    "population": 0,
    "parent": "Matosinhos",
    "type": "freguesia"
  },
  {
    "nom": "Guilhabreu",
    "cp": "",
    "code": "1316_7",
    "population": 0,
    "parent": "Vila do Conde",
    "type": "freguesia"
  },
  {
    "nom": "Guilhufe e Urrô",
    "cp": "",
    "code": "1311_12",
    "population": 0,
    "parent": "Penafiel",
    "type": "freguesia"
  },
  {
    "nom": "Gulpilhares",
    "cp": "",
    "code": "1317_6",
    "population": 0,
    "parent": "Vila Nova de Gaia",
    "type": "freguesia"
  },
  {
    "nom": "Idães",
    "cp": "",
    "code": "1303_3",
    "population": 0,
    "parent": "Felgueiras",
    "type": "freguesia"
  },
  {
    "nom": "Irivo",
    "cp": "",
    "code": "1311_13",
    "population": 0,
    "parent": "Penafiel",
    "type": "freguesia"
  },
  {
    "nom": "Jazente",
    "cp": "",
    "code": "1301_6",
    "population": 0,
    "parent": "Amarante",
    "type": "freguesia"
  },
  {
    "nom": "Jugueiros",
    "cp": "",
    "code": "1303_4",
    "population": 0,
    "parent": "Felgueiras",
    "type": "freguesia"
  },
  {
    "nom": "Junqueira",
    "cp": "",
    "code": "1316_8",
    "population": 0,
    "parent": "Vila do Conde",
    "type": "freguesia"
  },
  {
    "nom": "Labruge",
    "cp": "",
    "code": "1316_9",
    "population": 0,
    "parent": "Vila do Conde",
    "type": "freguesia"
  },
  {
    "nom": "Lagares e Figueira",
    "cp": "",
    "code": "1311_14",
    "population": 0,
    "parent": "Penafiel",
    "type": "freguesia"
  },
  {
    "nom": "Lamoso",
    "cp": "",
    "code": "1309_8",
    "population": 0,
    "parent": "Paços de Ferreira",
    "type": "freguesia"
  },
  {
    "nom": "Laundos",
    "cp": "",
    "code": "1313_7",
    "population": 0,
    "parent": "Póvoa de Varzim",
    "type": "freguesia"
  },
  {
    "nom": "Lavra",
    "cp": "",
    "code": "1308_2",
    "population": 0,
    "parent": "Matosinhos",
    "type": "freguesia"
  },
  {
    "nom": "Lever",
    "cp": "",
    "code": "1317_7",
    "population": 0,
    "parent": "Vila Nova de Gaia",
    "type": "freguesia"
  },
  {
    "nom": "Leça da Palmeira",
    "cp": "",
    "code": "1308_3",
    "population": 0,
    "parent": "Matosinhos",
    "type": "freguesia"
  },
  {
    "nom": "Leça do Balio",
    "cp": "",
    "code": "1308_4",
    "population": 0,
    "parent": "Matosinhos",
    "type": "freguesia"
  },
  {
    "nom": "Lodares",
    "cp": "",
    "code": "1305_3",
    "population": 0,
    "parent": "Lousada",
    "type": "freguesia"
  },
  {
    "nom": "Loivos do Monte",
    "cp": "",
    "code": "1302_4",
    "population": 0,
    "parent": "Baião",
    "type": "freguesia"
  },
  {
    "nom": "Lomba",
    "cp": "",
    "code": "1301_7",
    "population": 0,
    "parent": "Amarante",
    "type": "freguesia"
  },
  {
    "nom": "Lomba",
    "cp": "",
    "code": "1304_1",
    "population": 0,
    "parent": "Gondomar",
    "type": "freguesia"
  },
  {
    "nom": "Lordelo",
    "cp": "",
    "code": "1310_8",
    "population": 0,
    "parent": "Paredes",
    "type": "freguesia"
  },
  {
    "nom": "Louredo",
    "cp": "",
    "code": "1301_8",
    "population": 0,
    "parent": "Amarante",
    "type": "freguesia"
  },
  {
    "nom": "Louredo",
    "cp": "",
    "code": "1310_9",
    "population": 0,
    "parent": "Paredes",
    "type": "freguesia"
  },
  {
    "nom": "Lousada",
    "cp": "",
    "code": "1305",
    "population": 0,
    "type": "municipio"
  },
  {
    "nom": "Lufrei",
    "cp": "",
    "code": "1301_9",
    "population": 0,
    "parent": "Amarante",
    "type": "freguesia"
  },
  {
    "nom": "Lustosa",
    "cp": "",
    "code": "1305_4",
    "population": 0,
    "parent": "Lousada",
    "type": "freguesia"
  },
  {
    "nom": "Luzim e Vila Cova",
    "cp": "",
    "code": "1311_15",
    "population": 0,
    "parent": "Penafiel",
    "type": "freguesia"
  },
  {
    "nom": "Macieira",
    "cp": "",
    "code": "1305_5",
    "population": 0,
    "parent": "Lousada",
    "type": "freguesia"
  },
  {
    "nom": "Macieira da Maia",
    "cp": "",
    "code": "1316_10",
    "population": 0,
    "parent": "Vila do Conde",
    "type": "freguesia"
  },
  {
    "nom": "Madalena",
    "cp": "",
    "code": "1317_8",
    "population": 0,
    "parent": "Vila Nova de Gaia",
    "type": "freguesia"
  },
  {
    "nom": "Mafamude",
    "cp": "",
    "code": "1317_9",
    "population": 0,
    "parent": "Vila Nova de Gaia",
    "type": "freguesia"
  },
  {
    "nom": "Maia",
    "cp": "",
    "code": "1306",
    "population": 0,
    "type": "municipio"
  },
  {
    "nom": "Malta",
    "cp": "",
    "code": "1316_11",
    "population": 0,
    "parent": "Vila do Conde",
    "type": "freguesia"
  },
  {
    "nom": "Mancelos",
    "cp": "",
    "code": "1301_10",
    "population": 0,
    "parent": "Amarante",
    "type": "freguesia"
  },
  {
    "nom": "Marco",
    "cp": "",
    "code": "1307_5",
    "population": 0,
    "parent": "Marco de Canaveses",
    "type": "freguesia"
  },
  {
    "nom": "Marco de Canaveses",
    "cp": "",
    "code": "1307",
    "population": 0,
    "type": "municipio"
  },
  {
    "nom": "Matosinhos",
    "cp": "",
    "code": "1308",
    "population": 0,
    "type": "municipio"
  },
  {
    "nom": "Matosinhos",
    "cp": "",
    "code": "1308_5",
    "population": 0,
    "parent": "Matosinhos",
    "type": "freguesia"
  },
  {
    "nom": "Meinedo",
    "cp": "",
    "code": "1305_6",
    "population": 0,
    "parent": "Lousada",
    "type": "freguesia"
  },
  {
    "nom": "Meixomil",
    "cp": "",
    "code": "1309_9",
    "population": 0,
    "parent": "Paços de Ferreira",
    "type": "freguesia"
  },
  {
    "nom": "Milheirós",
    "cp": "",
    "code": "1306_3",
    "population": 0,
    "parent": "Maia",
    "type": "freguesia"
  },
  {
    "nom": "Mindelo",
    "cp": "",
    "code": "1316_12",
    "population": 0,
    "parent": "Vila do Conde",
    "type": "freguesia"
  },
  {
    "nom": "Modelos",
    "cp": "",
    "code": "1309_10",
    "population": 0,
    "parent": "Paços de Ferreira",
    "type": "freguesia"
  },
  {
    "nom": "Modivas",
    "cp": "",
    "code": "1316_13",
    "population": 0,
    "parent": "Vila do Conde",
    "type": "freguesia"
  },
  {
    "nom": "Monte Córdova",
    "cp": "",
    "code": "1314_2",
    "population": 0,
    "parent": "Santo Tirso",
    "type": "freguesia"
  },
  {
    "nom": "Moreira",
    "cp": "",
    "code": "1306_4",
    "population": 0,
    "parent": "Maia",
    "type": "freguesia"
  },
  {
    "nom": "Muro",
    "cp": "",
    "code": "1318_3",
    "population": 0,
    "parent": "Trofa",
    "type": "freguesia"
  },
  {
    "nom": "Navais",
    "cp": "",
    "code": "1313_8",
    "population": 0,
    "parent": "Póvoa de Varzim",
    "type": "freguesia"
  },
  {
    "nom": "Negrelos (São Tomé)",
    "cp": "",
    "code": "1314_3",
    "population": 0,
    "parent": "Santo Tirso",
    "type": "freguesia"
  },
  {
    "nom": "Nevogilde",
    "cp": "",
    "code": "1305_7",
    "population": 0,
    "parent": "Lousada",
    "type": "freguesia"
  },
  {
    "nom": "Nogueira e Silva Escura",
    "cp": "",
    "code": "1306_5",
    "population": 0,
    "parent": "Maia",
    "type": "freguesia"
  },
  {
    "nom": "Oldrões",
    "cp": "",
    "code": "1311_16",
    "population": 0,
    "parent": "Penafiel",
    "type": "freguesia"
  },
  {
    "nom": "Olival",
    "cp": "",
    "code": "1317_10",
    "population": 0,
    "parent": "Vila Nova de Gaia",
    "type": "freguesia"
  },
  {
    "nom": "Oliveira do Douro",
    "cp": "",
    "code": "1317_11",
    "population": 0,
    "parent": "Vila Nova de Gaia",
    "type": "freguesia"
  },
  {
    "nom": "Padronelo",
    "cp": "",
    "code": "1301_11",
    "population": 0,
    "parent": "Amarante",
    "type": "freguesia"
  },
  {
    "nom": "Parada de Todeia",
    "cp": "",
    "code": "1310_10",
    "population": 0,
    "parent": "Paredes",
    "type": "freguesia"
  },
  {
    "nom": "Paranhos",
    "cp": "",
    "code": "1312_2",
    "population": 0,
    "parent": "Porto",
    "type": "freguesia"
  },
  {
    "nom": "Paredes",
    "cp": "",
    "code": "1310",
    "population": 0,
    "type": "municipio"
  },
  {
    "nom": "Paredes",
    "cp": "",
    "code": "1310_11",
    "population": 0,
    "parent": "Paredes",
    "type": "freguesia"
  },
  {
    "nom": "Paredes de Viadores e Manhuncelos",
    "cp": "",
    "code": "1307_6",
    "population": 0,
    "parent": "Marco de Canaveses",
    "type": "freguesia"
  },
  {
    "nom": "Paço de Sousa",
    "cp": "",
    "code": "1311_17",
    "population": 0,
    "parent": "Penafiel",
    "type": "freguesia"
  },
  {
    "nom": "Paços de Ferreira",
    "cp": "",
    "code": "1309",
    "population": 0,
    "type": "municipio"
  },
  {
    "nom": "Paços de Ferreira",
    "cp": "",
    "code": "1309_11",
    "population": 0,
    "parent": "Paços de Ferreira",
    "type": "freguesia"
  },
  {
    "nom": "Paços de Gaiolo",
    "cp": "",
    "code": "1307_7",
    "population": 0,
    "parent": "Marco de Canaveses",
    "type": "freguesia"
  },
  {
    "nom": "Pedroso",
    "cp": "",
    "code": "1317_12",
    "population": 0,
    "parent": "Vila Nova de Gaia",
    "type": "freguesia"
  },
  {
    "nom": "Pedrouços",
    "cp": "",
    "code": "1306_6",
    "population": 0,
    "parent": "Maia",
    "type": "freguesia"
  },
  {
    "nom": "Penacova",
    "cp": "",
    "code": "1303_5",
    "population": 0,
    "parent": "Felgueiras",
    "type": "freguesia"
  },
  {
    "nom": "Penafiel",
    "cp": "",
    "code": "1311",
    "population": 0,
    "type": "municipio"
  },
  {
    "nom": "Penafiel",
    "cp": "",
    "code": "1311_18",
    "population": 0,
    "parent": "Penafiel",
    "type": "freguesia"
  },
  {
    "nom": "Penamaior",
    "cp": "",
    "code": "1309_12",
    "population": 0,
    "parent": "Paços de Ferreira",
    "type": "freguesia"
  },
  {
    "nom": "Penha Longa",
    "cp": "",
    "code": "1307_8",
    "population": 0,
    "parent": "Marco de Canaveses",
    "type": "freguesia"
  },
  {
    "nom": "Perafita",
    "cp": "",
    "code": "1308_6",
    "population": 0,
    "parent": "Matosinhos",
    "type": "freguesia"
  },
  {
    "nom": "Perosinho",
    "cp": "",
    "code": "1317_13",
    "population": 0,
    "parent": "Vila Nova de Gaia",
    "type": "freguesia"
  },
  {
    "nom": "Perozelo",
    "cp": "",
    "code": "1311_19",
    "population": 0,
    "parent": "Penafiel",
    "type": "freguesia"
  },
  {
    "nom": "Pinheiro",
    "cp": "",
    "code": "1303_6",
    "population": 0,
    "parent": "Felgueiras",
    "type": "freguesia"
  },
  {
    "nom": "Pombeiro de Ribavizela",
    "cp": "",
    "code": "1303_7",
    "population": 0,
    "parent": "Felgueiras",
    "type": "freguesia"
  },
  {
    "nom": "Porto",
    "cp": "",
    "code": "1312",
    "population": 0,
    "type": "municipio"
  },
  {
    "nom": "Póvoa de Varzim",
    "cp": "",
    "code": "1313",
    "population": 0,
    "type": "municipio"
  },
  {
    "nom": "Póvoa de Varzim",
    "cp": "",
    "code": "1313_9",
    "population": 0,
    "parent": "Póvoa de Varzim",
    "type": "freguesia"
  },
  {
    "nom": "Raimonda",
    "cp": "",
    "code": "1309_13",
    "population": 0,
    "parent": "Paços de Ferreira",
    "type": "freguesia"
  },
  {
    "nom": "Ramalde",
    "cp": "",
    "code": "1312_3",
    "population": 0,
    "parent": "Porto",
    "type": "freguesia"
  },
  {
    "nom": "Rans",
    "cp": "",
    "code": "1311_20",
    "population": 0,
    "parent": "Penafiel",
    "type": "freguesia"
  },
  {
    "nom": "Rates",
    "cp": "",
    "code": "1313_10",
    "population": 0,
    "parent": "Póvoa de Varzim",
    "type": "freguesia"
  },
  {
    "nom": "Rebordelo",
    "cp": "",
    "code": "1301_12",
    "population": 0,
    "parent": "Amarante",
    "type": "freguesia"
  },
  {
    "nom": "Rebordosa",
    "cp": "",
    "code": "1310_12",
    "population": 0,
    "parent": "Paredes",
    "type": "freguesia"
  },
  {
    "nom": "Rebordões",
    "cp": "",
    "code": "1314_4",
    "population": 0,
    "parent": "Santo Tirso",
    "type": "freguesia"
  },
  {
    "nom": "Recarei",
    "cp": "",
    "code": "1310_13",
    "population": 0,
    "parent": "Paredes",
    "type": "freguesia"
  },
  {
    "nom": "Recezinhos (São Mamede)",
    "cp": "",
    "code": "1311_21",
    "population": 0,
    "parent": "Penafiel",
    "type": "freguesia"
  },
  {
    "nom": "Recezinhos (São Martinho)",
    "cp": "",
    "code": "1311_22",
    "population": 0,
    "parent": "Penafiel",
    "type": "freguesia"
  },
  {
    "nom": "Refontoura",
    "cp": "",
    "code": "1303_8",
    "population": 0,
    "parent": "Felgueiras",
    "type": "freguesia"
  },
  {
    "nom": "Regilde",
    "cp": "",
    "code": "1303_9",
    "population": 0,
    "parent": "Felgueiras",
    "type": "freguesia"
  },
  {
    "nom": "Reguenga",
    "cp": "",
    "code": "1314_5",
    "population": 0,
    "parent": "Santo Tirso",
    "type": "freguesia"
  },
  {
    "nom": "Retorta",
    "cp": "",
    "code": "1316_14",
    "population": 0,
    "parent": "Vila do Conde",
    "type": "freguesia"
  },
  {
    "nom": "Revinhade",
    "cp": "",
    "code": "1303_10",
    "population": 0,
    "parent": "Felgueiras",
    "type": "freguesia"
  },
  {
    "nom": "Rio de Moinhos",
    "cp": "",
    "code": "1311_24",
    "population": 0,
    "parent": "Penafiel",
    "type": "freguesia"
  },
  {
    "nom": "Rio Mau",
    "cp": "",
    "code": "1311_23",
    "population": 0,
    "parent": "Penafiel",
    "type": "freguesia"
  },
  {
    "nom": "Rio Mau",
    "cp": "",
    "code": "1316_15",
    "population": 0,
    "parent": "Vila do Conde",
    "type": "freguesia"
  },
  {
    "nom": "Rio Tinto",
    "cp": "",
    "code": "1304_2",
    "population": 0,
    "parent": "Gondomar",
    "type": "freguesia"
  },
  {
    "nom": "Roriz",
    "cp": "",
    "code": "1314_6",
    "population": 0,
    "parent": "Santo Tirso",
    "type": "freguesia"
  },
  {
    "nom": "Salvador do Monte",
    "cp": "",
    "code": "1301_13",
    "population": 0,
    "parent": "Amarante",
    "type": "freguesia"
  },
  {
    "nom": "Sande e São Lourenço do Douro",
    "cp": "",
    "code": "1307_9",
    "population": 0,
    "parent": "Marco de Canaveses",
    "type": "freguesia"
  },
  {
    "nom": "Sandim",
    "cp": "",
    "code": "1317_14",
    "population": 0,
    "parent": "Vila Nova de Gaia",
    "type": "freguesia"
  },
  {
    "nom": "Sanfins de Ferreira",
    "cp": "",
    "code": "1309_14",
    "population": 0,
    "parent": "Paços de Ferreira",
    "type": "freguesia"
  },
  {
    "nom": "Santa Cruz do Bispo",
    "cp": "",
    "code": "1308_7",
    "population": 0,
    "parent": "Matosinhos",
    "type": "freguesia"
  },
  {
    "nom": "Santa Marinha",
    "cp": "",
    "code": "1317_15",
    "population": 0,
    "parent": "Vila Nova de Gaia",
    "type": "freguesia"
  },
  {
    "nom": "Santa Marinha do Zêzere",
    "cp": "",
    "code": "1302_5",
    "population": 0,
    "parent": "Baião",
    "type": "freguesia"
  },
  {
    "nom": "Santo Isidoro e Livração",
    "cp": "",
    "code": "1307_10",
    "population": 0,
    "parent": "Marco de Canaveses",
    "type": "freguesia"
  },
  {
    "nom": "Santo Tirso",
    "cp": "",
    "code": "1314",
    "population": 0,
    "type": "municipio"
  },
  {
    "nom": "Sebolido",
    "cp": "",
    "code": "1311_25",
    "population": 0,
    "parent": "Penafiel",
    "type": "freguesia"
  },
  {
    "nom": "Seixezelo",
    "cp": "",
    "code": "1317_16",
    "population": 0,
    "parent": "Vila Nova de Gaia",
    "type": "freguesia"
  },
  {
    "nom": "Sendim",
    "cp": "",
    "code": "1303_11",
    "population": 0,
    "parent": "Felgueiras",
    "type": "freguesia"
  },
  {
    "nom": "Senhora da Hora",
    "cp": "",
    "code": "1308_8",
    "population": 0,
    "parent": "Matosinhos",
    "type": "freguesia"
  },
  {
    "nom": "Sermonde",
    "cp": "",
    "code": "1317_17",
    "population": 0,
    "parent": "Vila Nova de Gaia",
    "type": "freguesia"
  },
  {
    "nom": "Seroa",
    "cp": "",
    "code": "1309_15",
    "population": 0,
    "parent": "Paços de Ferreira",
    "type": "freguesia"
  },
  {
    "nom": "Serzedo",
    "cp": "",
    "code": "1317_18",
    "population": 0,
    "parent": "Vila Nova de Gaia",
    "type": "freguesia"
  },
  {
    "nom": "Soalhães",
    "cp": "",
    "code": "1307_11",
    "population": 0,
    "parent": "Marco de Canaveses",
    "type": "freguesia"
  },
  {
    "nom": "Sobrado",
    "cp": "",
    "code": "1315_3",
    "population": 0,
    "parent": "Valongo",
    "type": "freguesia"
  },
  {
    "nom": "Sobreira",
    "cp": "",
    "code": "1310_14",
    "population": 0,
    "parent": "Paredes",
    "type": "freguesia"
  },
  {
    "nom": "Sobretâmega",
    "cp": "",
    "code": "1307_12",
    "population": 0,
    "parent": "Marco de Canaveses",
    "type": "freguesia"
  },
  {
    "nom": "Sobrosa",
    "cp": "",
    "code": "1310_15",
    "population": 0,
    "parent": "Paredes",
    "type": "freguesia"
  },
  {
    "nom": "Sousela",
    "cp": "",
    "code": "1305_8",
    "population": 0,
    "parent": "Lousada",
    "type": "freguesia"
  },
  {
    "nom": "São Félix da Marinha",
    "cp": "",
    "code": "1317_19",
    "population": 0,
    "parent": "Vila Nova de Gaia",
    "type": "freguesia"
  },
  {
    "nom": "São Mamede de Infesta",
    "cp": "",
    "code": "1308_9",
    "population": 0,
    "parent": "Matosinhos",
    "type": "freguesia"
  },
  {
    "nom": "São Pedro da Afurada",
    "cp": "",
    "code": "1317_20",
    "population": 0,
    "parent": "Vila Nova de Gaia",
    "type": "freguesia"
  },
  {
    "nom": "São Pedro Fins",
    "cp": "",
    "code": "1306_7",
    "population": 0,
    "parent": "Maia",
    "type": "freguesia"
  },
  {
    "nom": "Tabuado",
    "cp": "",
    "code": "1307_13",
    "population": 0,
    "parent": "Marco de Canaveses",
    "type": "freguesia"
  },
  {
    "nom": "Telões",
    "cp": "",
    "code": "1301_14",
    "population": 0,
    "parent": "Amarante",
    "type": "freguesia"
  },
  {
    "nom": "Termas de São Vicente",
    "cp": "",
    "code": "1311_26",
    "population": 0,
    "parent": "Penafiel",
    "type": "freguesia"
  },
  {
    "nom": "Terroso",
    "cp": "",
    "code": "1313_11",
    "population": 0,
    "parent": "Póvoa de Varzim",
    "type": "freguesia"
  },
  {
    "nom": "Torno",
    "cp": "",
    "code": "1305_9",
    "population": 0,
    "parent": "Lousada",
    "type": "freguesia"
  },
  {
    "nom": "Tougues",
    "cp": "",
    "code": "1316_16",
    "population": 0,
    "parent": "Vila do Conde",
    "type": "freguesia"
  },
  {
    "nom": "Travanca",
    "cp": "",
    "code": "1301_15",
    "population": 0,
    "parent": "Amarante",
    "type": "freguesia"
  },
  {
    "nom": "Trofa",
    "cp": "",
    "code": "1318",
    "population": 0,
    "type": "municipio"
  },
  {
    "nom": "União das freguesias de Aboadela, Sanche e Várzea",
    "cp": "",
    "code": "1301_16",
    "population": 0,
    "parent": "Amarante",
    "type": "freguesia"
  },
  {
    "nom": "União das freguesias de Aldoar, Foz do Douro e Nevogilde",
    "cp": "",
    "code": "1312_4",
    "population": 0,
    "parent": "Porto",
    "type": "freguesia"
  },
  {
    "nom": "União das freguesias de Amarante (São Gonçalo), Madalena, Cepelos e Gatão",
    "cp": "",
    "code": "1301_17",
    "population": 0,
    "parent": "Amarante",
    "type": "freguesia"
  },
  {
    "nom": "União das freguesias de Ancede e Ribadouro",
    "cp": "",
    "code": "1302_6",
    "population": 0,
    "parent": "Baião",
    "type": "freguesia"
  },
  {
    "nom": "União das freguesias de Areias, Sequeiró, Lama e Palmeira",
    "cp": "",
    "code": "1314_7",
    "population": 0,
    "parent": "Santo Tirso",
    "type": "freguesia"
  },
  {
    "nom": "União das freguesias de Bagunte, Ferreiró, Outeiro Maior e Parada",
    "cp": "",
    "code": "1316_17",
    "population": 0,
    "parent": "Vila do Conde",
    "type": "freguesia"
  },
  {
    "nom": "União das freguesias de Baião (Santa Leocádia) e Mesquinhata",
    "cp": "",
    "code": "1302_7",
    "population": 0,
    "parent": "Baião",
    "type": "freguesia"
  },
  {
    "nom": "União das freguesias de Bougado (São Martinho e Santiago)",
    "cp": "",
    "code": "1318_4",
    "population": 0,
    "parent": "Trofa",
    "type": "freguesia"
  },
  {
    "nom": "União das freguesias de Bustelo, Carneiro e Carvalho de Rei",
    "cp": "",
    "code": "1301_18",
    "population": 0,
    "parent": "Amarante",
    "type": "freguesia"
  },
  {
    "nom": "União das freguesias de Campelo e Ovil",
    "cp": "",
    "code": "1302_8",
    "population": 0,
    "parent": "Baião",
    "type": "freguesia"
  },
  {
    "nom": "União das freguesias de Carreira e Refojos de Riba de Ave",
    "cp": "",
    "code": "1314_8",
    "population": 0,
    "parent": "Santo Tirso",
    "type": "freguesia"
  },
  {
    "nom": "União das freguesias de Cedofeita, Santo Ildefonso, Sé, Miragaia, São Nicolau...",
    "cp": "",
    "code": "1312_5",
    "population": 0,
    "parent": "Porto",
    "type": "freguesia"
  },
  {
    "nom": "União das freguesias de Cernadelo e Lousada (São Miguel e Santa Margarida)",
    "cp": "",
    "code": "1305_10",
    "population": 0,
    "parent": "Lousada",
    "type": "freguesia"
  },
  {
    "nom": "União das freguesias de Coronado (São Romão e São Mamede)",
    "cp": "",
    "code": "1318_5",
    "population": 0,
    "parent": "Trofa",
    "type": "freguesia"
  },
  {
    "nom": "União das freguesias de Cristelos, Boim e Ordem",
    "cp": "",
    "code": "1305_11",
    "population": 0,
    "parent": "Lousada",
    "type": "freguesia"
  },
  {
    "nom": "União das freguesias de Figueiras e Covas",
    "cp": "",
    "code": "1305_12",
    "population": 0,
    "parent": "Lousada",
    "type": "freguesia"
  },
  {
    "nom": "União das freguesias de Figueiró (Santiago e Santa Cristina)",
    "cp": "",
    "code": "1301_19",
    "population": 0,
    "parent": "Amarante",
    "type": "freguesia"
  },
  {
    "nom": "União das freguesias de Foz do Sousa e Covelo",
    "cp": "",
    "code": "1304_3",
    "population": 0,
    "parent": "Gondomar",
    "type": "freguesia"
  },
  {
    "nom": "União das freguesias de Freixo de Cima e de Baixo",
    "cp": "",
    "code": "1301_20",
    "population": 0,
    "parent": "Amarante",
    "type": "freguesia"
  },
  {
    "nom": "União das freguesias de Fânzeres e São Pedro da Cova",
    "cp": "",
    "code": "1304_4",
    "population": 0,
    "parent": "Gondomar",
    "type": "freguesia"
  },
  {
    "nom": "União das freguesias de Gondomar (São Cosme), Valbom e Jovim",
    "cp": "",
    "code": "1304_5",
    "population": 0,
    "parent": "Gondomar",
    "type": "freguesia"
  },
  {
    "nom": "União das freguesias de Lamelas e Guimarei",
    "cp": "",
    "code": "1314_9",
    "population": 0,
    "parent": "Santo Tirso",
    "type": "freguesia"
  },
  {
    "nom": "União das freguesias de Loivos da Ribeira e Tresouras",
    "cp": "",
    "code": "1302_9",
    "population": 0,
    "parent": "Baião",
    "type": "freguesia"
  },
  {
    "nom": "União das freguesias de Lordelo do Ouro e Massarelos",
    "cp": "",
    "code": "1312_6",
    "population": 0,
    "parent": "Porto",
    "type": "freguesia"
  },
  {
    "nom": "União das freguesias de Macieira da Lixa e Caramos",
    "cp": "",
    "code": "1303_12",
    "population": 0,
    "parent": "Felgueiras",
    "type": "freguesia"
  },
  {
    "nom": "União das freguesias de Margaride (Santa Eulália), Várzea, Lagares, Varziela ...",
    "cp": "",
    "code": "1303_13",
    "population": 0,
    "parent": "Felgueiras",
    "type": "freguesia"
  },
  {
    "nom": "União das freguesias de Melres e Medas",
    "cp": "",
    "code": "1304_6",
    "population": 0,
    "parent": "Gondomar",
    "type": "freguesia"
  },
  {
    "nom": "União das freguesias de Nespereira e Casais",
    "cp": "",
    "code": "1305_13",
    "population": 0,
    "parent": "Lousada",
    "type": "freguesia"
  },
  {
    "nom": "União das freguesias de Olo e Canadelo",
    "cp": "",
    "code": "1301_21",
    "population": 0,
    "parent": "Amarante",
    "type": "freguesia"
  },
  {
    "nom": "União das freguesias de Pedreira, Rande e Sernande",
    "cp": "",
    "code": "1303_14",
    "population": 0,
    "parent": "Felgueiras",
    "type": "freguesia"
  },
  {
    "nom": "União das freguesias de Santa Cruz do Douro e São Tomé de Covelas",
    "cp": "",
    "code": "1302_10",
    "population": 0,
    "parent": "Baião",
    "type": "freguesia"
  },
  {
    "nom": "União das freguesias de Santo Tirso, Couto (Santa Cristina e São Miguel) e Bu...",
    "cp": "",
    "code": "1314_10",
    "population": 0,
    "parent": "Santo Tirso",
    "type": "freguesia"
  },
  {
    "nom": "União das freguesias de Silvares, Pias, Nogueira e Alvarenga",
    "cp": "",
    "code": "1305_14",
    "population": 0,
    "parent": "Lousada",
    "type": "freguesia"
  },
  {
    "nom": "União das freguesias de Teixeira e Teixeiró",
    "cp": "",
    "code": "1302_11",
    "population": 0,
    "parent": "Baião",
    "type": "freguesia"
  },
  {
    "nom": "União das freguesias de Torrados e Sousa",
    "cp": "",
    "code": "1303_15",
    "population": 0,
    "parent": "Felgueiras",
    "type": "freguesia"
  },
  {
    "nom": "União das freguesias de Touguinha e Touguinhó",
    "cp": "",
    "code": "1316_18",
    "population": 0,
    "parent": "Vila do Conde",
    "type": "freguesia"
  },
  {
    "nom": "União das freguesias de Unhão e Lordelo",
    "cp": "",
    "code": "1303_16",
    "population": 0,
    "parent": "Felgueiras",
    "type": "freguesia"
  },
  {
    "nom": "União das freguesias de Vila Cova da Lixa e Borba de Godim",
    "cp": "",
    "code": "1303_17",
    "population": 0,
    "parent": "Felgueiras",
    "type": "freguesia"
  },
  {
    "nom": "União das freguesias de Vila Fria e Vizela (São Jorge)",
    "cp": "",
    "code": "1303_18",
    "population": 0,
    "parent": "Felgueiras",
    "type": "freguesia"
  },
  {
    "nom": "União das freguesias de Vila Garcia, Aboim e Chapa",
    "cp": "",
    "code": "1301_22",
    "population": 0,
    "parent": "Amarante",
    "type": "freguesia"
  },
  {
    "nom": "União das freguesias de Vila Verde e Santão",
    "cp": "",
    "code": "1303_19",
    "population": 0,
    "parent": "Felgueiras",
    "type": "freguesia"
  },
  {
    "nom": "União das freguesias de Vilar e Mosteiró",
    "cp": "",
    "code": "1316_19",
    "population": 0,
    "parent": "Vila do Conde",
    "type": "freguesia"
  },
  {
    "nom": "Vairão",
    "cp": "",
    "code": "1316_20",
    "population": 0,
    "parent": "Vila do Conde",
    "type": "freguesia"
  },
  {
    "nom": "Valadares",
    "cp": "",
    "code": "1302_12",
    "population": 0,
    "parent": "Baião",
    "type": "freguesia"
  },
  {
    "nom": "Valadares",
    "cp": "",
    "code": "1317_21",
    "population": 0,
    "parent": "Vila Nova de Gaia",
    "type": "freguesia"
  },
  {
    "nom": "Valongo",
    "cp": "",
    "code": "1315",
    "population": 0,
    "type": "municipio"
  },
  {
    "nom": "Valongo",
    "cp": "",
    "code": "1315_4",
    "population": 0,
    "parent": "Valongo",
    "type": "freguesia"
  },
  {
    "nom": "Valpedre",
    "cp": "",
    "code": "1311_27",
    "population": 0,
    "parent": "Penafiel",
    "type": "freguesia"
  },
  {
    "nom": "Vandoma",
    "cp": "",
    "code": "1310_16",
    "population": 0,
    "parent": "Paredes",
    "type": "freguesia"
  },
  {
    "nom": "Viariz",
    "cp": "",
    "code": "1302_13",
    "population": 0,
    "parent": "Baião",
    "type": "freguesia"
  },
  {
    "nom": "Vila Boa de Quires e Maureles",
    "cp": "",
    "code": "1307_14",
    "population": 0,
    "parent": "Marco de Canaveses",
    "type": "freguesia"
  },
  {
    "nom": "Vila Boa do Bispo",
    "cp": "",
    "code": "1307_15",
    "population": 0,
    "parent": "Marco de Canaveses",
    "type": "freguesia"
  },
  {
    "nom": "Vila Caiz",
    "cp": "",
    "code": "1301_23",
    "population": 0,
    "parent": "Amarante",
    "type": "freguesia"
  },
  {
    "nom": "Vila Chã",
    "cp": "",
    "code": "1316_21",
    "population": 0,
    "parent": "Vila do Conde",
    "type": "freguesia"
  },
  {
    "nom": "Vila Chã do Marão",
    "cp": "",
    "code": "1301_24",
    "population": 0,
    "parent": "Amarante",
    "type": "freguesia"
  },
  {
    "nom": "Vila do Conde",
    "cp": "",
    "code": "1316",
    "population": 0,
    "type": "municipio"
  },
  {
    "nom": "Vila do Conde",
    "cp": "",
    "code": "1316_22",
    "population": 0,
    "parent": "Vila do Conde",
    "type": "freguesia"
  },
  {
    "nom": "Vila Meã",
    "cp": "",
    "code": "1301_25",
    "population": 0,
    "parent": "Amarante",
    "type": "freguesia"
  },
  {
    "nom": "Vila Nova da Telha",
    "cp": "",
    "code": "1306_8",
    "population": 0,
    "parent": "Maia",
    "type": "freguesia"
  },
  {
    "nom": "Vila Nova de Gaia",
    "cp": "",
    "code": "1317",
    "population": 0,
    "type": "municipio"
  },
  {
    "nom": "Vila Nova do Campo",
    "cp": "",
    "code": "1314_11",
    "population": 0,
    "parent": "Santo Tirso",
    "type": "freguesia"
  },
  {
    "nom": "Vilar de Andorinho",
    "cp": "",
    "code": "1317_22",
    "population": 0,
    "parent": "Vila Nova de Gaia",
    "type": "freguesia"
  },
  {
    "nom": "Vilar de Pinheiro",
    "cp": "",
    "code": "1316_23",
    "population": 0,
    "parent": "Vila do Conde",
    "type": "freguesia"
  },
  {
    "nom": "Vilar do Paraíso",
    "cp": "",
    "code": "1317_23",
    "population": 0,
    "parent": "Vila Nova de Gaia",
    "type": "freguesia"
  },
  {
    "nom": "Vilar do Torno e Alentém",
    "cp": "",
    "code": "1305_15",
    "population": 0,
    "parent": "Lousada",
    "type": "freguesia"
  },
  {
    "nom": "Vilarinho",
    "cp": "",
    "code": "1314_12",
    "population": 0,
    "parent": "Santo Tirso",
    "type": "freguesia"
  },
  {
    "nom": "Vilela",
    "cp": "",
    "code": "1310_17",
    "population": 0,
    "parent": "Paredes",
    "type": "freguesia"
  },
  {
    "nom": "Várzea, Aliviada e Folhada",
    "cp": "",
    "code": "1307_16",
    "population": 0,
    "parent": "Marco de Canaveses",
    "type": "freguesia"
  },
  {
    "nom": "Água Longa",
    "cp": "",
    "code": "1314_13",
    "population": 0,
    "parent": "Santo Tirso",
    "type": "freguesia"
  },
  {
    "nom": "Águas Santas",
    "cp": "",
    "code": "1306_9",
    "population": 0,
    "parent": "Maia",
    "type": "freguesia"
  },
  {
    "nom": "Árvore",
    "cp": "",
    "code": "1316_24",
    "population": 0,
    "parent": "Vila do Conde",
    "type": "freguesia"
  }
]

export const ALL_COMMUNES_PT: PTCommune[] = COMMUNES_PT_PORTO

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export function searchDistritosPT(query: string, limit = 8): PTDistrito[] {
  const q = normalize(query.trim())
  if (!q) return PT_DISTRITOS.slice(0, limit)
  return PT_DISTRITOS.filter(d => d.code.startsWith(q) || normalize(d.nom).includes(q)).slice(0, limit)
}

export function searchCommunesPT(query: string, limit = 10): PTCommune[] {
  const q = normalize(query.trim())
  if (!q) return ALL_COMMUNES_PT.slice(0, limit)
  const starts: PTCommune[] = []
  const includes: PTCommune[] = []
  for (const c of ALL_COMMUNES_PT) {
    const n = normalize(c.nom)
    const p = c.parent ? normalize(c.parent) : ''
    if (n.startsWith(q) || p.startsWith(q)) starts.push(c)
    else if (n.includes(q) || p.includes(q)) includes.push(c)
  }
  return [...starts, ...includes].slice(0, limit)
}
