// Auto-généré depuis geo.api.gouv.fr — NE PAS MODIFIER À LA MAIN
// Sources : https://geo.api.gouv.fr/departements + /departements/13/communes
// Dernière mise à jour : 2026-04-16

export interface FRDepartement {
  code: string
  nom: string
  region: string
}

export interface FRCommune {
  nom: string
  cp: string        // Code postal principal
  code: string      // Code INSEE
  population: number
  parent?: string   // Pour les arrondissements (ex: "Marseille")
}

export const FR_DEPARTEMENTS: FRDepartement[] = [
  {
    "code": "01",
    "nom": "Ain",
    "region": "Auvergne-Rhône-Alpes"
  },
  {
    "code": "02",
    "nom": "Aisne",
    "region": "Hauts-de-France"
  },
  {
    "code": "03",
    "nom": "Allier",
    "region": "Auvergne-Rhône-Alpes"
  },
  {
    "code": "04",
    "nom": "Alpes-de-Haute-Provence",
    "region": "Provence-Alpes-Côte d'Azur"
  },
  {
    "code": "05",
    "nom": "Hautes-Alpes",
    "region": "Provence-Alpes-Côte d'Azur"
  },
  {
    "code": "06",
    "nom": "Alpes-Maritimes",
    "region": "Provence-Alpes-Côte d'Azur"
  },
  {
    "code": "07",
    "nom": "Ardèche",
    "region": "Auvergne-Rhône-Alpes"
  },
  {
    "code": "08",
    "nom": "Ardennes",
    "region": "Grand Est"
  },
  {
    "code": "09",
    "nom": "Ariège",
    "region": "Occitanie"
  },
  {
    "code": "10",
    "nom": "Aube",
    "region": "Grand Est"
  },
  {
    "code": "11",
    "nom": "Aude",
    "region": "Occitanie"
  },
  {
    "code": "12",
    "nom": "Aveyron",
    "region": "Occitanie"
  },
  {
    "code": "13",
    "nom": "Bouches-du-Rhône",
    "region": "Provence-Alpes-Côte d'Azur"
  },
  {
    "code": "14",
    "nom": "Calvados",
    "region": "Normandie"
  },
  {
    "code": "15",
    "nom": "Cantal",
    "region": "Auvergne-Rhône-Alpes"
  },
  {
    "code": "16",
    "nom": "Charente",
    "region": "Nouvelle-Aquitaine"
  },
  {
    "code": "17",
    "nom": "Charente-Maritime",
    "region": "Nouvelle-Aquitaine"
  },
  {
    "code": "18",
    "nom": "Cher",
    "region": "Centre-Val de Loire"
  },
  {
    "code": "19",
    "nom": "Corrèze",
    "region": "Nouvelle-Aquitaine"
  },
  {
    "code": "21",
    "nom": "Côte-d'Or",
    "region": "Bourgogne-Franche-Comté"
  },
  {
    "code": "22",
    "nom": "Côtes-d'Armor",
    "region": "Bretagne"
  },
  {
    "code": "23",
    "nom": "Creuse",
    "region": "Nouvelle-Aquitaine"
  },
  {
    "code": "24",
    "nom": "Dordogne",
    "region": "Nouvelle-Aquitaine"
  },
  {
    "code": "25",
    "nom": "Doubs",
    "region": "Bourgogne-Franche-Comté"
  },
  {
    "code": "26",
    "nom": "Drôme",
    "region": "Auvergne-Rhône-Alpes"
  },
  {
    "code": "27",
    "nom": "Eure",
    "region": "Normandie"
  },
  {
    "code": "28",
    "nom": "Eure-et-Loir",
    "region": "Centre-Val de Loire"
  },
  {
    "code": "29",
    "nom": "Finistère",
    "region": "Bretagne"
  },
  {
    "code": "2A",
    "nom": "Corse-du-Sud",
    "region": "Corse"
  },
  {
    "code": "2B",
    "nom": "Haute-Corse",
    "region": "Corse"
  },
  {
    "code": "30",
    "nom": "Gard",
    "region": "Occitanie"
  },
  {
    "code": "31",
    "nom": "Haute-Garonne",
    "region": "Occitanie"
  },
  {
    "code": "32",
    "nom": "Gers",
    "region": "Occitanie"
  },
  {
    "code": "33",
    "nom": "Gironde",
    "region": "Nouvelle-Aquitaine"
  },
  {
    "code": "34",
    "nom": "Hérault",
    "region": "Occitanie"
  },
  {
    "code": "35",
    "nom": "Ille-et-Vilaine",
    "region": "Bretagne"
  },
  {
    "code": "36",
    "nom": "Indre",
    "region": "Centre-Val de Loire"
  },
  {
    "code": "37",
    "nom": "Indre-et-Loire",
    "region": "Centre-Val de Loire"
  },
  {
    "code": "38",
    "nom": "Isère",
    "region": "Auvergne-Rhône-Alpes"
  },
  {
    "code": "39",
    "nom": "Jura",
    "region": "Bourgogne-Franche-Comté"
  },
  {
    "code": "40",
    "nom": "Landes",
    "region": "Nouvelle-Aquitaine"
  },
  {
    "code": "41",
    "nom": "Loir-et-Cher",
    "region": "Centre-Val de Loire"
  },
  {
    "code": "42",
    "nom": "Loire",
    "region": "Auvergne-Rhône-Alpes"
  },
  {
    "code": "43",
    "nom": "Haute-Loire",
    "region": "Auvergne-Rhône-Alpes"
  },
  {
    "code": "44",
    "nom": "Loire-Atlantique",
    "region": "Pays de la Loire"
  },
  {
    "code": "45",
    "nom": "Loiret",
    "region": "Centre-Val de Loire"
  },
  {
    "code": "46",
    "nom": "Lot",
    "region": "Occitanie"
  },
  {
    "code": "47",
    "nom": "Lot-et-Garonne",
    "region": "Nouvelle-Aquitaine"
  },
  {
    "code": "48",
    "nom": "Lozère",
    "region": "Occitanie"
  },
  {
    "code": "49",
    "nom": "Maine-et-Loire",
    "region": "Pays de la Loire"
  },
  {
    "code": "50",
    "nom": "Manche",
    "region": "Normandie"
  },
  {
    "code": "51",
    "nom": "Marne",
    "region": "Grand Est"
  },
  {
    "code": "52",
    "nom": "Haute-Marne",
    "region": "Grand Est"
  },
  {
    "code": "53",
    "nom": "Mayenne",
    "region": "Pays de la Loire"
  },
  {
    "code": "54",
    "nom": "Meurthe-et-Moselle",
    "region": "Grand Est"
  },
  {
    "code": "55",
    "nom": "Meuse",
    "region": "Grand Est"
  },
  {
    "code": "56",
    "nom": "Morbihan",
    "region": "Bretagne"
  },
  {
    "code": "57",
    "nom": "Moselle",
    "region": "Grand Est"
  },
  {
    "code": "58",
    "nom": "Nièvre",
    "region": "Bourgogne-Franche-Comté"
  },
  {
    "code": "59",
    "nom": "Nord",
    "region": "Hauts-de-France"
  },
  {
    "code": "60",
    "nom": "Oise",
    "region": "Hauts-de-France"
  },
  {
    "code": "61",
    "nom": "Orne",
    "region": "Normandie"
  },
  {
    "code": "62",
    "nom": "Pas-de-Calais",
    "region": "Hauts-de-France"
  },
  {
    "code": "63",
    "nom": "Puy-de-Dôme",
    "region": "Auvergne-Rhône-Alpes"
  },
  {
    "code": "64",
    "nom": "Pyrénées-Atlantiques",
    "region": "Nouvelle-Aquitaine"
  },
  {
    "code": "65",
    "nom": "Hautes-Pyrénées",
    "region": "Occitanie"
  },
  {
    "code": "66",
    "nom": "Pyrénées-Orientales",
    "region": "Occitanie"
  },
  {
    "code": "67",
    "nom": "Bas-Rhin",
    "region": "Grand Est"
  },
  {
    "code": "68",
    "nom": "Haut-Rhin",
    "region": "Grand Est"
  },
  {
    "code": "69",
    "nom": "Rhône",
    "region": "Auvergne-Rhône-Alpes"
  },
  {
    "code": "70",
    "nom": "Haute-Saône",
    "region": "Bourgogne-Franche-Comté"
  },
  {
    "code": "71",
    "nom": "Saône-et-Loire",
    "region": "Bourgogne-Franche-Comté"
  },
  {
    "code": "72",
    "nom": "Sarthe",
    "region": "Pays de la Loire"
  },
  {
    "code": "73",
    "nom": "Savoie",
    "region": "Auvergne-Rhône-Alpes"
  },
  {
    "code": "74",
    "nom": "Haute-Savoie",
    "region": "Auvergne-Rhône-Alpes"
  },
  {
    "code": "75",
    "nom": "Paris",
    "region": "Île-de-France"
  },
  {
    "code": "76",
    "nom": "Seine-Maritime",
    "region": "Normandie"
  },
  {
    "code": "77",
    "nom": "Seine-et-Marne",
    "region": "Île-de-France"
  },
  {
    "code": "78",
    "nom": "Yvelines",
    "region": "Île-de-France"
  },
  {
    "code": "79",
    "nom": "Deux-Sèvres",
    "region": "Nouvelle-Aquitaine"
  },
  {
    "code": "80",
    "nom": "Somme",
    "region": "Hauts-de-France"
  },
  {
    "code": "81",
    "nom": "Tarn",
    "region": "Occitanie"
  },
  {
    "code": "82",
    "nom": "Tarn-et-Garonne",
    "region": "Occitanie"
  },
  {
    "code": "83",
    "nom": "Var",
    "region": "Provence-Alpes-Côte d'Azur"
  },
  {
    "code": "84",
    "nom": "Vaucluse",
    "region": "Provence-Alpes-Côte d'Azur"
  },
  {
    "code": "85",
    "nom": "Vendée",
    "region": "Pays de la Loire"
  },
  {
    "code": "86",
    "nom": "Vienne",
    "region": "Nouvelle-Aquitaine"
  },
  {
    "code": "87",
    "nom": "Haute-Vienne",
    "region": "Nouvelle-Aquitaine"
  },
  {
    "code": "88",
    "nom": "Vosges",
    "region": "Grand Est"
  },
  {
    "code": "89",
    "nom": "Yonne",
    "region": "Bourgogne-Franche-Comté"
  },
  {
    "code": "90",
    "nom": "Territoire de Belfort",
    "region": "Bourgogne-Franche-Comté"
  },
  {
    "code": "91",
    "nom": "Essonne",
    "region": "Île-de-France"
  },
  {
    "code": "92",
    "nom": "Hauts-de-Seine",
    "region": "Île-de-France"
  },
  {
    "code": "93",
    "nom": "Seine-Saint-Denis",
    "region": "Île-de-France"
  },
  {
    "code": "94",
    "nom": "Val-de-Marne",
    "region": "Île-de-France"
  },
  {
    "code": "95",
    "nom": "Val-d'Oise",
    "region": "Île-de-France"
  },
  {
    "code": "971",
    "nom": "Guadeloupe",
    "region": "Guadeloupe"
  },
  {
    "code": "972",
    "nom": "Martinique",
    "region": "Martinique"
  },
  {
    "code": "973",
    "nom": "Guyane",
    "region": "Guyane"
  },
  {
    "code": "974",
    "nom": "La Réunion",
    "region": "La Réunion"
  },
  {
    "code": "976",
    "nom": "Mayotte",
    "region": "Mayotte"
  }
]

// Communes du département 13 (Bouches-du-Rhône) — phase de test
// 119 communes officielles INSEE + 16 arrondissements de Marseille
export const COMMUNES_13: FRCommune[] = [
  {
    "nom": "Aix-en-Provence",
    "cp": "13080",
    "code": "13001",
    "population": 149695
  },
  {
    "nom": "Allauch",
    "cp": "13190",
    "code": "13002",
    "population": 21443
  },
  {
    "nom": "Alleins",
    "cp": "13980",
    "code": "13003",
    "population": 2852
  },
  {
    "nom": "Arles",
    "cp": "13104",
    "code": "13004",
    "population": 51811
  },
  {
    "nom": "Aubagne",
    "cp": "13400",
    "code": "13005",
    "population": 47529
  },
  {
    "nom": "Aureille",
    "cp": "13930",
    "code": "13006",
    "population": 1533
  },
  {
    "nom": "Auriol",
    "cp": "13390",
    "code": "13007",
    "population": 13037
  },
  {
    "nom": "Aurons",
    "cp": "13121",
    "code": "13008",
    "population": 555
  },
  {
    "nom": "Barbentane",
    "cp": "13570",
    "code": "13010",
    "population": 4266
  },
  {
    "nom": "Beaurecueil",
    "cp": "13100",
    "code": "13012",
    "population": 585
  },
  {
    "nom": "Belcodène",
    "cp": "13720",
    "code": "13013",
    "population": 2009
  },
  {
    "nom": "Berre-l'Étang",
    "cp": "13130",
    "code": "13014",
    "population": 13832
  },
  {
    "nom": "Bouc-Bel-Air",
    "cp": "13320",
    "code": "13015",
    "population": 15381
  },
  {
    "nom": "Boulbon",
    "cp": "13150",
    "code": "13017",
    "population": 1543
  },
  {
    "nom": "Cabannes",
    "cp": "13440",
    "code": "13018",
    "population": 4595
  },
  {
    "nom": "Cabriès",
    "cp": "13480",
    "code": "13019",
    "population": 10240
  },
  {
    "nom": "Cadolive",
    "cp": "13950",
    "code": "13020",
    "population": 2236
  },
  {
    "nom": "Carnoux-en-Provence",
    "cp": "13470",
    "code": "13119",
    "population": 6873
  },
  {
    "nom": "Carry-le-Rouet",
    "cp": "13620",
    "code": "13021",
    "population": 5702
  },
  {
    "nom": "Cassis",
    "cp": "13260",
    "code": "13022",
    "population": 6661
  },
  {
    "nom": "Ceyreste",
    "cp": "13600",
    "code": "13023",
    "population": 4863
  },
  {
    "nom": "Charleval",
    "cp": "13350",
    "code": "13024",
    "population": 2640
  },
  {
    "nom": "Châteauneuf-le-Rouge",
    "cp": "13790",
    "code": "13025",
    "population": 2376
  },
  {
    "nom": "Châteauneuf-les-Martigues",
    "cp": "13220",
    "code": "13026",
    "population": 18455
  },
  {
    "nom": "Châteaurenard",
    "cp": "13160",
    "code": "13027",
    "population": 16545
  },
  {
    "nom": "Cornillon-Confoux",
    "cp": "13250",
    "code": "13029",
    "population": 1667
  },
  {
    "nom": "Coudoux",
    "cp": "13111",
    "code": "13118",
    "population": 3825
  },
  {
    "nom": "Cuges-les-Pins",
    "cp": "13780",
    "code": "13030",
    "population": 6236
  },
  {
    "nom": "Ensuès-la-Redonne",
    "cp": "13820",
    "code": "13033",
    "population": 5757
  },
  {
    "nom": "Eygalières",
    "cp": "13810",
    "code": "13034",
    "population": 1773
  },
  {
    "nom": "Eyguières",
    "cp": "13430",
    "code": "13035",
    "population": 7119
  },
  {
    "nom": "Eyragues",
    "cp": "13630",
    "code": "13036",
    "population": 4298
  },
  {
    "nom": "Fontvieille",
    "cp": "13990",
    "code": "13038",
    "population": 3571
  },
  {
    "nom": "Fos-sur-Mer",
    "cp": "13270",
    "code": "13039",
    "population": 15862
  },
  {
    "nom": "Fuveau",
    "cp": "13710",
    "code": "13040",
    "population": 10337
  },
  {
    "nom": "Gardanne",
    "cp": "13120",
    "code": "13041",
    "population": 21597
  },
  {
    "nom": "Gignac-la-Nerthe",
    "cp": "13180",
    "code": "13043",
    "population": 10343
  },
  {
    "nom": "Grans",
    "cp": "13450",
    "code": "13044",
    "population": 5489
  },
  {
    "nom": "Graveson",
    "cp": "13690",
    "code": "13045",
    "population": 4698
  },
  {
    "nom": "Gréasque",
    "cp": "13850",
    "code": "13046",
    "population": 4554
  },
  {
    "nom": "Gémenos",
    "cp": "13420",
    "code": "13042",
    "population": 6579
  },
  {
    "nom": "Istres",
    "cp": "13118",
    "code": "13047",
    "population": 44292
  },
  {
    "nom": "Jouques",
    "cp": "13490",
    "code": "13048",
    "population": 4547
  },
  {
    "nom": "La Barben",
    "cp": "13330",
    "code": "13009",
    "population": 868
  },
  {
    "nom": "La Bouilladisse",
    "cp": "13720",
    "code": "13016",
    "population": 6547
  },
  {
    "nom": "La Ciotat",
    "cp": "13600",
    "code": "13028",
    "population": 38477
  },
  {
    "nom": "La Destrousse",
    "cp": "13112",
    "code": "13031",
    "population": 4133
  },
  {
    "nom": "La Fare-les-Oliviers",
    "cp": "13580",
    "code": "13037",
    "population": 9039
  },
  {
    "nom": "La Penne-sur-Huveaune",
    "cp": "13821",
    "code": "13070",
    "population": 6605
  },
  {
    "nom": "La Roque-d'Anthéron",
    "cp": "13640",
    "code": "13084",
    "population": 5459
  },
  {
    "nom": "Lamanon",
    "cp": "13113",
    "code": "13049",
    "population": 2097
  },
  {
    "nom": "Lambesc",
    "cp": "13410",
    "code": "13050",
    "population": 10024
  },
  {
    "nom": "Lançon-Provence",
    "cp": "13680",
    "code": "13051",
    "population": 9915
  },
  {
    "nom": "Le Puy-Sainte-Réparade",
    "cp": "13610",
    "code": "13080",
    "population": 5935
  },
  {
    "nom": "Le Rove",
    "cp": "13740",
    "code": "13088",
    "population": 5246
  },
  {
    "nom": "Le Tholonet",
    "cp": "13100",
    "code": "13109",
    "population": 2391
  },
  {
    "nom": "Les Baux-de-Provence",
    "cp": "13520",
    "code": "13011",
    "population": 264
  },
  {
    "nom": "Les Pennes-Mirabeau",
    "cp": "13170",
    "code": "13071",
    "population": 22537
  },
  {
    "nom": "Maillane",
    "cp": "13910",
    "code": "13052",
    "population": 2775
  },
  {
    "nom": "Mallemort",
    "cp": "13370",
    "code": "13053",
    "population": 6166
  },
  {
    "nom": "Marignane",
    "cp": "13700",
    "code": "13054",
    "population": 33692
  },
  {
    "nom": "Marseille",
    "cp": "13001",
    "code": "13055",
    "population": 886040
  },
  {
    "nom": "Martigues",
    "cp": "13117",
    "code": "13056",
    "population": 48298
  },
  {
    "nom": "Mas-Blanc-des-Alpilles",
    "cp": "13103",
    "code": "13057",
    "population": 564
  },
  {
    "nom": "Maussane-les-Alpilles",
    "cp": "13520",
    "code": "13058",
    "population": 2347
  },
  {
    "nom": "Meyrargues",
    "cp": "13650",
    "code": "13059",
    "population": 3847
  },
  {
    "nom": "Meyreuil",
    "cp": "13590",
    "code": "13060",
    "population": 6747
  },
  {
    "nom": "Mimet",
    "cp": "13105",
    "code": "13062",
    "population": 4241
  },
  {
    "nom": "Miramas",
    "cp": "13140",
    "code": "13063",
    "population": 26203
  },
  {
    "nom": "Mollégès",
    "cp": "13940",
    "code": "13064",
    "population": 2647
  },
  {
    "nom": "Mouriès",
    "cp": "13890",
    "code": "13065",
    "population": 3527
  },
  {
    "nom": "Noves",
    "cp": "13550",
    "code": "13066",
    "population": 6080
  },
  {
    "nom": "Orgon",
    "cp": "13660",
    "code": "13067",
    "population": 2762
  },
  {
    "nom": "Paradou",
    "cp": "13520",
    "code": "13068",
    "population": 2159
  },
  {
    "nom": "Peynier",
    "cp": "13790",
    "code": "13072",
    "population": 3739
  },
  {
    "nom": "Peypin",
    "cp": "13124",
    "code": "13073",
    "population": 5771
  },
  {
    "nom": "Peyrolles-en-Provence",
    "cp": "13860",
    "code": "13074",
    "population": 5409
  },
  {
    "nom": "Plan-d'Orgon",
    "cp": "13750",
    "code": "13076",
    "population": 3573
  },
  {
    "nom": "Plan-de-Cuques",
    "cp": "13380",
    "code": "13075",
    "population": 11632
  },
  {
    "nom": "Port-Saint-Louis-du-Rhône",
    "cp": "13230",
    "code": "13078",
    "population": 8573
  },
  {
    "nom": "Port-de-Bouc",
    "cp": "13110",
    "code": "13077",
    "population": 15802
  },
  {
    "nom": "Puyloubier",
    "cp": "13114",
    "code": "13079",
    "population": 1768
  },
  {
    "nom": "Pélissanne",
    "cp": "13330",
    "code": "13069",
    "population": 11085
  },
  {
    "nom": "Rognac",
    "cp": "13340",
    "code": "13081",
    "population": 12576
  },
  {
    "nom": "Rognes",
    "cp": "13840",
    "code": "13082",
    "population": 4693
  },
  {
    "nom": "Rognonas",
    "cp": "13870",
    "code": "13083",
    "population": 4261
  },
  {
    "nom": "Roquefort-la-Bédoule",
    "cp": "13830",
    "code": "13085",
    "population": 5798
  },
  {
    "nom": "Roquevaire",
    "cp": "13360",
    "code": "13086",
    "population": 8915
  },
  {
    "nom": "Rousset",
    "cp": "13790",
    "code": "13087",
    "population": 5425
  },
  {
    "nom": "Saint-Andiol",
    "cp": "13670",
    "code": "13089",
    "population": 3353
  },
  {
    "nom": "Saint-Antonin-sur-Bayon",
    "cp": "13100",
    "code": "13090",
    "population": 126
  },
  {
    "nom": "Saint-Cannat",
    "cp": "13760",
    "code": "13091",
    "population": 6097
  },
  {
    "nom": "Saint-Chamas",
    "cp": "13250",
    "code": "13092",
    "population": 8676
  },
  {
    "nom": "Saint-Estève-Janson",
    "cp": "13610",
    "code": "13093",
    "population": 357
  },
  {
    "nom": "Saint-Marc-Jaumegarde",
    "cp": "13100",
    "code": "13095",
    "population": 1273
  },
  {
    "nom": "Saint-Martin-de-Crau",
    "cp": "13310",
    "code": "13097",
    "population": 14145
  },
  {
    "nom": "Saint-Mitre-les-Remparts",
    "cp": "13920",
    "code": "13098",
    "population": 6175
  },
  {
    "nom": "Saint-Paul-lès-Durance",
    "cp": "13115",
    "code": "13099",
    "population": 885
  },
  {
    "nom": "Saint-Pierre-de-Mézoargues",
    "cp": "13150",
    "code": "13061",
    "population": 229
  },
  {
    "nom": "Saint-Rémy-de-Provence",
    "cp": "13210",
    "code": "13100",
    "population": 9599
  },
  {
    "nom": "Saint-Savournin",
    "cp": "13119",
    "code": "13101",
    "population": 3397
  },
  {
    "nom": "Saint-Victoret",
    "cp": "13730",
    "code": "13102",
    "population": 6730
  },
  {
    "nom": "Saint-Étienne-du-Grès",
    "cp": "13103",
    "code": "13094",
    "population": 2489
  },
  {
    "nom": "Saintes-Maries-de-la-Mer",
    "cp": "13460",
    "code": "13096",
    "population": 2433
  },
  {
    "nom": "Salon-de-Provence",
    "cp": "13300",
    "code": "13103",
    "population": 44194
  },
  {
    "nom": "Sausset-les-Pins",
    "cp": "13960",
    "code": "13104",
    "population": 7574
  },
  {
    "nom": "Septèmes-les-Vallons",
    "cp": "13240",
    "code": "13106",
    "population": 11995
  },
  {
    "nom": "Simiane-Collongue",
    "cp": "13109",
    "code": "13107",
    "population": 5780
  },
  {
    "nom": "Sénas",
    "cp": "13560",
    "code": "13105",
    "population": 6925
  },
  {
    "nom": "Tarascon",
    "cp": "13150",
    "code": "13108",
    "population": 15396
  },
  {
    "nom": "Trets",
    "cp": "13530",
    "code": "13110",
    "population": 10946
  },
  {
    "nom": "Vauvenargues",
    "cp": "13126",
    "code": "13111",
    "population": 1058
  },
  {
    "nom": "Velaux",
    "cp": "13880",
    "code": "13112",
    "population": 8941
  },
  {
    "nom": "Venelles",
    "cp": "13770",
    "code": "13113",
    "population": 8418
  },
  {
    "nom": "Ventabren",
    "cp": "13122",
    "code": "13114",
    "population": 5839
  },
  {
    "nom": "Vernègues",
    "cp": "13116",
    "code": "13115",
    "population": 2166
  },
  {
    "nom": "Verquières",
    "cp": "13670",
    "code": "13116",
    "population": 772
  },
  {
    "nom": "Vitrolles",
    "cp": "13127",
    "code": "13117",
    "population": 36758
  },
  {
    "nom": "Éguilles",
    "cp": "13510",
    "code": "13032",
    "population": 8479
  },
  {
    "nom": "Marseille 1er arrondissement",
    "cp": "13001",
    "code": "13201",
    "population": 0,
    "parent": "Marseille"
  },
  {
    "nom": "Marseille 2e arrondissement",
    "cp": "13002",
    "code": "13202",
    "population": 0,
    "parent": "Marseille"
  },
  {
    "nom": "Marseille 3e arrondissement",
    "cp": "13003",
    "code": "13203",
    "population": 0,
    "parent": "Marseille"
  },
  {
    "nom": "Marseille 4e arrondissement",
    "cp": "13004",
    "code": "13204",
    "population": 0,
    "parent": "Marseille"
  },
  {
    "nom": "Marseille 5e arrondissement",
    "cp": "13005",
    "code": "13205",
    "population": 0,
    "parent": "Marseille"
  },
  {
    "nom": "Marseille 6e arrondissement",
    "cp": "13006",
    "code": "13206",
    "population": 0,
    "parent": "Marseille"
  },
  {
    "nom": "Marseille 7e arrondissement",
    "cp": "13007",
    "code": "13207",
    "population": 0,
    "parent": "Marseille"
  },
  {
    "nom": "Marseille 8e arrondissement",
    "cp": "13008",
    "code": "13208",
    "population": 0,
    "parent": "Marseille"
  },
  {
    "nom": "Marseille 9e arrondissement",
    "cp": "13009",
    "code": "13209",
    "population": 0,
    "parent": "Marseille"
  },
  {
    "nom": "Marseille 10e arrondissement",
    "cp": "13010",
    "code": "13210",
    "population": 0,
    "parent": "Marseille"
  },
  {
    "nom": "Marseille 11e arrondissement",
    "cp": "13011",
    "code": "13211",
    "population": 0,
    "parent": "Marseille"
  },
  {
    "nom": "Marseille 12e arrondissement",
    "cp": "13012",
    "code": "13212",
    "population": 0,
    "parent": "Marseille"
  },
  {
    "nom": "Marseille 13e arrondissement",
    "cp": "13013",
    "code": "13213",
    "population": 0,
    "parent": "Marseille"
  },
  {
    "nom": "Marseille 14e arrondissement",
    "cp": "13014",
    "code": "13214",
    "population": 0,
    "parent": "Marseille"
  },
  {
    "nom": "Marseille 15e arrondissement",
    "cp": "13015",
    "code": "13215",
    "population": 0,
    "parent": "Marseille"
  },
  {
    "nom": "Marseille 16e arrondissement",
    "cp": "13016",
    "code": "13216",
    "population": 0,
    "parent": "Marseille"
  }
]

// Future extension : ajouter communes d'autres départements ici
// Pattern: COMMUNES_<CODE> puis map COMMUNES_BY_DEPT = { "13": COMMUNES_13, "75": COMMUNES_75, ... }
export const COMMUNES_BY_DEPT: Record<string, FRCommune[]> = {
  '13': COMMUNES_13,
}

// Toutes les communes chargées (phase test : uniquement 13)
export const ALL_COMMUNES: FRCommune[] = Object.values(COMMUNES_BY_DEPT).flat()

/**
 * Autocomplete helper : match par début de chaîne (case & accent insensitive)
 * puis par inclusion. Limite les résultats.
 */
function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export function searchDepartements(query: string, limit = 8): FRDepartement[] {
  const q = normalize(query.trim())
  if (!q) return FR_DEPARTEMENTS.slice(0, limit)
  const starts: FRDepartement[] = []
  const includes: FRDepartement[] = []
  for (const d of FR_DEPARTEMENTS) {
    if (d.code.startsWith(q) || normalize(d.nom).startsWith(q)) starts.push(d)
    else if (normalize(d.nom).includes(q)) includes.push(d)
    if (starts.length >= limit) break
  }
  return [...starts, ...includes].slice(0, limit)
}

export function searchCommunes(query: string, limit = 10): FRCommune[] {
  const q = normalize(query.trim())
  if (!q) return ALL_COMMUNES.slice(0, limit)
  const starts: FRCommune[] = []
  const includes: FRCommune[] = []
  for (const c of ALL_COMMUNES) {
    const n = normalize(c.nom)
    if (n.startsWith(q) || c.cp.startsWith(q)) starts.push(c)
    else if (n.includes(q)) includes.push(c)
  }
  return [...starts, ...includes].slice(0, limit)
}
