import { PointOfInterest, POIType, ItemsInLevel } from "@/Types";
const { Village, Normal, Mining, Monsters, Biome } = POIType;

const pois: ItemsInLevel<PointOfInterest>[] = [];

pois[0] = {
  level: 0,
  items: [
    {
      x: 755.12,
      y: 625.6,
      text: "horsie pasture",
      type: Normal
    },
    {
      x: 705.2,
      y: 554.56,
      text: "sugarcane shore",
      type: Normal
    },
    {
      x: 706.96,
      y: 452.8,
      text: "pumpkin paradise",
      type: Normal
    },
    {
      x: 837.04,
      y: 529.52,
      text: "house hill",
      type: Normal
    },
    {
      x: 779.68,
      y: 606.24,
      text: "some cows",
      type: Normal
    },
    {
      x: 98,
      y: 37.6,
      text: "cassie is cute !!!!!",
      type: Normal
    },
    {
      x: 111.04,
      y: 148.8,
      text: "some sheeps",
      type: Normal
    },
    {
      x: 734,
      y: 634.4,
      text: "karrot korner",
      type: Normal
    },
    {
      x: 795.13,
      y: 520.46,
      text: "secret entrance",
      type: Normal
    },
    {
      x: 752.4,
      y: 607.85,
      text: "entrance to Cursed Cave",
      type: Mining
    },
    {
      x: 1087.28,
      y: 574.48,
      text: "i made this map while i was lost. it did not help",
      type: Normal
    },
    {
      x: 194.38,
      y: 156.73,
      text: "mitchama canal on-ramp",
      type: Normal
    },
    {
      x: 784.47,
      y: 505.15,
      text: "mitchama canal terminus",
      type: Normal
    },
    {
      x: 52.64,
      y: 46.95,
      text: "forest of illusions",
      type: Normal
    },
    {
      x: 18.13,
      y: 38.27,
      text: "🍉",
      type: Normal
    },
    {
      x: 67.39,
      y: 52.14,
      text: "triangle mines entrance",
      type: Mining
    },
    {
      x: 68.16,
      y: 122.39,
      text: "triangle mines exit",
      type: Mining
    },
    {
      x: 81.44,
      y: 42.33,
      text: "players' residence",
      type: Normal
    },
    {
      x: 113.25,
      y: 33.69,
      text: "chaama enclosure",
      type: Normal
    },
    {
      x: 54.3,
      y: -1.34,
      text: "failed monster trap",
      type: Normal
    },
    {
      x: 2266.1,
      y: -1302.14,
      text: "crop circles",
      type: Normal
    },
    {
      x: 2312.86,
      y: -1319.27,
      text: "clown residence for clowns",
      type: Normal
    },
    {
      x: 2334.99,
      y: -1353.91,
      text: "at it again at pumpkin kremes",
      type: Normal
    },
    {
      x: 2389.65,
      y: -1360.65,
      text: "sheep",
      type: Normal
    },
    {
      x: 2401.2,
      y: -1338.9,
      text: "cows",
      type: Normal
    },
    {
      x: 2460.47,
      y: -1278.85,
      text: "canes",
      type: Normal
    },
    {
      x: 2364.44,
      y: -1234.01,
      text: "unfinished dock",
      type: Normal
    },
    {
      x: 2416.79,
      y: -1318.03,
      text: "vatican ravine",
      type: Mining
    },
    {
      x: 2300.16,
      y: -1169.73,
      text: "path 2 russel village",
      type: Normal
    },
    {
      x: 664.64,
      y: 462.72,
      text: "path 2 vatican city",
      type: Normal
    },
    {
      x: 2486.63,
      y: -1355.45,
      text: "open savanna",
      type: Normal
    },
    {
      x: 35.34,
      y: -118.35,
      text: "sarah's abode",
      type: Normal
    },
    {
      x: 2295.23,
      y: -1310.99,
      text: "sarah's Machine",
      type: Normal
    },
    {
      x: 50,
      y: -91,
      text: "sarah's portal to the highway",
      type: Normal
    },
    {
      x: 2378.01,
      y: -1337.17,
      text: "sarah's vacation home",
      type: Normal
    },
    {
      x: 2345.27,
      y: -1394.69,
      text: "cactus farm farm",
      type: Normal
    },
    {
      x: 2311.59,
      y: -1332.14,
      text: "portal to the nether superhighway",
      type: Normal
    },
    {
      x: 2299.66,
      y: -1295,
      text: "item sorter interface",
      type: Normal
    },
    {
      x: 861.12,
      y: 455.44,
      text: "remy's front entrance",
      type: Mining
    },
    {
      x: 124.5,
      y: 16.93,
      text: "superhighway portal",
      type: Normal
    },
    {
      x: 1605.47,
      y: 754.42,
      text: "superhighway portal",
      type: Normal
    },
    {
      x: 1606.62,
      y: 731.71,
      text: "flower path to russel village",
      type: Normal
    },
    {
      x: 1596.04,
      y: 797.91,
      text: "agriculture",
      type: Normal
    }
  ].map(p => new PointOfInterest(p, 0))
};

pois[3] = {
  level: 3,
  items: [
    {
      x: 64,
      y: 64,
      text: "World Spawn",
      type: POIType.Spawn
    },
    {
      x: 89.5,
      y: 96.24,
      text: "cuteville",
      type: Village,
      pathMarker: true
    },
    {
      x: 778.24,
      y: 570.64,
      text: "russel village",
      type: Village,
      pathMarker: true
    },
    {
      x: 566.4,
      y: 152.24,
      text: "the sloshy sea",
      type: Biome
    },
    {
      x: 16.56,
      y: 383.04,
      text: "swamp 👀",
      type: Biome
    },
    {
      x: 178.48,
      y: 244.64,
      text: "broken portal",
      type: Normal
    },
    {
      x: 154,
      y: 441.84,
      text: "cool ravine that goes through a mountain",
      type: Mining
    },
    {
      x: 253.76,
      y: 538.4,
      text: '"glory holes"',
      type: Normal
    },
    {
      x: 530.16,
      y: 920,
      text: "weird mini-ravine; visible iron",
      type: Mining
    },
    {
      x: 650.96,
      y: 297.04,
      text: "ravine through sand and sandstone",
      type: Mining
    },
    {
      x: 234.08,
      y: 456.88,
      text: "big cave boi",
      type: Mining
    },
    {
      x: 987.84,
      y: 653.04,
      text: "coochfield (flowerz)",
      type: Biome
    },
    {
      x: 884.96,
      y: 586.48,
      text: "remy's back entrance",
      type: Mining
    },
    {
      x: 827.6,
      y: 662.72,
      text: "scary hole",
      type: Mining
    },
    {
      x: 1914.32,
      y: 850,
      text: "three-passageway pit",
      type: Mining
    },
    {
      x: -39.92,
      y: -54.26,
      text: "cassie's ravine",
      type: Normal,
      pathMarker: true
    },
    {
      x: -825.52,
      y: -596.08,
      text: "the sultry savanna/acacia zone",
      type: Biome
    },
    {
      x: -1135.91,
      y: -716.5,
      text: "the sandy desert",
      type: Biome
    },
    {
      x: -1013.59,
      y: -909.47,
      text: "spidery mineshaft & ravine & bed & breakfast",
      type: Mining
    },
    {
      x: -779.6,
      y: -193.92,
      text: "northwestern flower field",
      type: Biome
    },
    {
      x: -128.16,
      y: -213.76,
      text: "underhill pass",
      type: Normal
    },
    {
      x: -44.64,
      y: -127.2,
      text: "doggo sighting",
      type: Normal
    },
    {
      x: 73.12,
      y: -989.12,
      text: "spider spawner scave",
      type: Monsters
    },
    {
      x: -430.96,
      y: -830.08,
      text: "wet broken portal",
      type: Normal
    },
    {
      x: -538.64,
      y: -822.48,
      text: "western underwater temple",
      type: Monsters
    },
    {
      x: 713.84,
      y: -820.88,
      text: "eastern underwater temple",
      type: Monsters
    },
    {
      x: 949.36,
      y: -822.48,
      text: "ancient ruin island",
      type: Normal
    },
    {
      x: 854.56,
      y: -577.76,
      text: "sunken ship with treasure map (pillaged by me)",
      type: Normal
    },
    {
      x: 518.08,
      y: -805.6,
      text: "middle underwater temple",
      type: Monsters
    },
    {
      x: 779.6,
      y: -163.92,
      text: "southern underwater temple",
      type: Monsters
    },
    {
      x: -998.32,
      y: -129.68,
      text: "here be llamas",
      type: Normal
    },
    {
      x: -986.08,
      y: -394.88,
      text: "donkey sighting",
      type: Normal
    },
    {
      x: -782.72,
      y: -1013.6,
      text: "niagra lavafall",
      type: Normal
    },
    {
      x: -666.48,
      y: -986.08,
      text: "hill of many holes",
      type: Mining
    },
    {
      x: -560.16,
      y: 141.68,
      text: "extra broken portal",
      type: Normal
    },
    {
      x: -576.72,
      y: 236.24,
      text: "swamp northern reaches",
      type: Biome
    },
    {
      x: -387.04,
      y: 932,
      text: "baby ravine",
      type: Mining
    },
    {
      x: -247.04,
      y: 310.24,
      text: "pillager outpost tower (looted)",
      type: Monsters
    },
    {
      x: -185.04,
      y: 436.72,
      text: "witch hut (wet)",
      type: Monsters
    },
    {
      x: -307.28,
      y: 724.24,
      text: "taiga ravine",
      type: Mining
    },
    {
      x: -731.76,
      y: 427.68,
      text: "spruce village",
      type: Village
    },
    {
      x: -713.76,
      y: 460.8,
      text: "spruce village ravine",
      type: Mining
    },
    {
      x: 1451.36,
      y: 191.36,
      text: "beautiful coral :)",
      type: Normal
    },
    {
      x: 1529.68,
      y: 138.64,
      text: "magma-powered portal (broken)",
      type: Normal
    },
    {
      x: 1552.24,
      y: 16.72,
      text: "coral continued",
      type: Normal
    },
    {
      x: 1305.36,
      y: 600.8,
      text: "eastern swamp",
      type: Biome
    },
    {
      x: 1644.08,
      y: 766.4,
      text: "border town",
      type: Village,
      pathMarker: true
    },
    {
      x: 1797.11,
      y: 799.14,
      text: "stronghold hill",
      type: Normal,
      pathMarker: true
    },
    {
      x: 2001.2,
      y: 78.4,
      text: "the savvy savanna",
      type: Biome
    },
    {
      x: -1093.47,
      y: -341.69,
      text: "desert pyramid (scared 2 touch)",
      type: Mining
    },
    {
      x: 1595.45,
      y: -874.76,
      text: "mooshroom island",
      type: Biome
    },
    {
      x: 2968.63,
      y: 1304.22,
      text: "spruce s'hovel",
      type: Village
    },
    {
      x: 2752.85,
      y: 572.36,
      text: "gravity feed mountains",
      type: Biome
    },
    {
      x: 2579.32,
      y: 747.4,
      text: "complementary colors ravine",
      type: Mining
    },
    {
      x: 2283.55,
      y: 207.18,
      text: "blueflower swamp",
      type: Biome
    },
    {
      x: 2897.71,
      y: 762.49,
      text: "the rms titanic",
      type: Normal
    },
    {
      x: 2856.97,
      y: 815.31,
      text: "pumpkintown",
      type: Village
    },
    {
      x: 2517.45,
      y: -477.9,
      text: "turtle towers",
      type: Normal
    },
    {
      x: 2380.13,
      y: -497.51,
      text: "redstone ravine entrance island",
      type: Mining
    },
    {
      x: 2319.77,
      y: -710.28,
      text: "sunk sand structure",
      type: Normal
    },
    {
      x: 2645.71,
      y: -426.59,
      text: "gerudo town",
      type: Village
    },
    {
      x: 2743.79,
      y: -251.55,
      text: "the watery well",
      type: Normal
    },
    {
      x: 2168.87,
      y: -535.24,
      text: "mean green ravine",
      type: Mining
    },
    {
      x: 2389.18,
      y: -1808.83,
      text: "bi-biome cleft",
      type: Normal
    },
    {
      x: 2671.36,
      y: -1611.15,
      text: "rome",
      type: Village
    },
    {
      x: 2357.9,
      y: -1272.89,
      text: "vatican city",
      type: Village,
      pathMarker: true
    },
    {
      x: 2642.69,
      y: -1940.11,
      text: "desert pyramid scheme",
      type: Monsters
    },
    {
      x: 2829.81,
      y: -1095.07,
      text: "the lonely acacia",
      type: Normal
    },
    {
      x: 1222.73,
      y: -1316.89,
      text: "the hms sinkytowne",
      type: Normal
    },
    {
      x: 1732.77,
      y: -1674.53,
      text: "beached village",
      type: Village
    },
    {
      x: -1108.65,
      y: -106.69,
      text: "ice farm farm",
      type: Normal,
      pathMarker: true
    },
    {
      x: -1179.58,
      y: -201.75,
      text: "ice farm broken portal",
      type: Normal
    },
    {
      x: -870.23,
      y: -91.6,
      text: "munnel (mitchama tunnel) emergence",
      type: Normal
    },
    {
      x: -844.58,
      y: -161.01,
      text: "skeleton spawner (underground, in a cave)",
      type: Monsters
    },
    {
      x: -1991.41,
      y: 480.31,
      text: "irregular ice island",
      type: Biome
    },
    {
      x: -1371.22,
      y: 917.92,
      text: "polar bear residence",
      type: Normal
    },
    {
      x: -1822.41,
      y: 269.05,
      text: "hay bale hovel",
      type: Village
    },
    {
      x: 1204.63,
      y: -1956.71,
      text: "center for the drowned",
      type: Monsters
    },
    {
      x: 475.78,
      y: 1088.43,
      text: "sunflower sunlands",
      type: Biome
    },
    {
      x: 400.33,
      y: 1690.52,
      text: "the pointy mountain",
      type: Normal
    },
    {
      x: 427.5,
      y: 1429.47,
      text: "trapdoor town",
      type: Village
    },
    {
      x: 1441.54,
      y: -778.19,
      text: "million guardian ruins",
      type: Monsters
    },
    {
      x: 1441.54,
      y: 1076.36,
      text: "the straight and narrow ravine",
      type: Mining
    },
    {
      x: 1689.01,
      y: 1978.74,
      text: "gravel field mountain",
      type: Normal
    },
    {
      x: 1770.5,
      y: 1363.07,
      text: "susurrus swamp",
      type: Biome
    },
    {
      x: 1637.71,
      y: 1539.62,
      text: "ruined portal float",
      type: Normal
    },
    {
      x: -117.25,
      y: 1343.45,
      text: "octoberville",
      type: Village
    },
    {
      x: -843.07,
      y: 1867.07,
      text: "normietown",
      type: Village
    },
    {
      x: -301.35,
      y: 1240.84,
      text: "look before you ravine",
      type: Mining
    },
    {
      x: -687.65,
      y: 1746.35,
      text: "donkey sighting",
      type: Normal
    },
    {
      x: -1481.37,
      y: -328.51,
      text: "pillager tower (unpillaged)",
      type: Monsters
    },
    {
      x: -1463.27,
      y: -917.01,
      text: "acacia town (pretty)",
      type: Village,
      pathMarker: true
    },
    {
      x: -1156.94,
      y: -787.24,
      text: "desert pyramid 2: tokyo drift (successfully looted)",
      type: Normal
    },
    {
      x: -1829.95,
      y: -120.27,
      text: "fountain mountain village",
      type: Village
    },
    {
      x: 2385.25,
      y: -1472.11,
      text: "vatican ravine back entrance",
      type: Mining
    },
    {
      x: 819.15,
      y: 1404.21,
      text: "amethyst cave",
      type: Mining
    },
    {
      x: 762.19,
      y: 942.32,
      text: "stumbleupon ravine",
      type: Mining
    },
    {
      x: -1836.69,
      y: 1818.37,
      text: "bed & breakfast & lagoon & swamp",
      type: Biome
    },
    {
      x: -1716.6,
      y: 1849.16,
      text: "witch's hut (conquered)",
      type: Monsters
    },
    {
      x: -1360.95,
      y: -912.92,
      text: "mitchama railroad last stop",
      type: Normal
    },
    {
      x: 2302.19,
      y: -2138.22,
      text: "amethyst cave (deep) (beware: venomous spiders)",
      type: Mining
    },
    {
      x: 2213.28,
      y: -1768.94,
      text: "turtles for days",
      type: Normal
    },
    {
      x: 2147.07,
      y: -2945.21,
      text: "drowned village",
      type: Monsters
    },
    {
      x: 2062.4,
      y: -2848.22,
      text: "magma trench",
      type: Biome
    },
    {
      x: 2194.8,
      y: -2822.04,
      text: "jungle ship",
      type: Normal
    },
    {
      x: 2906.11,
      y: -2092.26,
      text: "broken portal dig site",
      type: Normal
    },
    {
      x: 2909.19,
      y: -2471.01,
      text: "cliffside pyramid",
      type: Normal
    },
    {
      x: 2801.41,
      y: -2283.18,
      text: "tinytown",
      type: Village
    },
    {
      x: 3000.02,
      y: -2977.54,
      text: "savanna ravine",
      type: Mining
    },
    {
      x: 2402.65,
      y: -2745.06,
      text: "incomplete ship",
      type: Normal
    },
    {
      x: 2622.82,
      y: -2815.88,
      text: "Constantinople",
      type: Village
    },
    {
      x: 2327.21,
      y: -2081.49,
      text: "chunk anomaly mining site",
      type: Mining
    },
    {
      x: -881.35,
      y: -220.09,
      text: "there are straight-up a lot of caves in this area",
      type: Normal
    },
    {
      x: 1719.06,
      y: -2216.97,
      text: "crevasse: deep; watery",
      type: Mining
    },
    {
      x: 1837.61,
      y: -2498.72,
      text: "drowned town",
      type: Monsters
    },
    {
      x: 1278.73,
      y: -3012.96,
      text: "sunflower field (important)",
      type: Biome
    },
    {
      x: 1623.6,
      y: -2775.85,
      text: "half-seen ravine",
      type: Mining
    },
    {
      x: 1106.29,
      y: -2994.48,
      text: "unsuccessful attempt desert pyramid",
      type: Monsters
    },
    {
      x: 1269.49,
      y: -2429.44,
      text: "dead bush town",
      type: Village
    },
    {
      x: -1355.56,
      y: -1208.52,
      text: "pillager tower (as yet intact)",
      type: Monsters
    },
    {
      x: -1412.52,
      y: -1584.19,
      text: "i guess the spiders built these mineshafts?",
      type: Monsters
    },
    {
      x: -1133.85,
      y: -1825.91,
      text: "symmes' hole",
      type: Mining
    },
    {
      x: -2042.23,
      y: -1964.48,
      text: "zombie spawner",
      type: Monsters
    },
    {
      x: -1563.41,
      y: -1636.54,
      text: "intriguing ravine",
      type: Mining
    },
    {
      x: -1113.84,
      y: -1180.81,
      text: "town swampcurious",
      type: Village
    },
    {
      x: -952.18,
      y: -1718.14,
      text: "amethyst cave entrance (look for a purple tree)",
      type: Mining
    },
    {
      x: -942.94,
      y: -1801.28,
      text: "the national mall",
      type: Normal
    },
    {
      x: -454.88,
      y: -1996.81,
      text: "skeleton spawner",
      type: Monsters
    },
    {
      x: -675.05,
      y: -1427.15,
      text: "gotes",
      type: Normal
    },
    {
      x: -473.36,
      y: -1111.53,
      text: "ravioli ravine",
      type: Mining
    },
    {
      x: 9898.64,
      y: -1230.79,
      text: "Jungle~",
      type: Biome
    },
    {
      x: 9280.98,
      y: -1521.08,
      text: "the floating island",
      type: Normal
    },
    {
      x: 9839.64,
      y: -1792.05,
      text: "amethyst cave",
      type: Normal
    },
    {
      x: 9857.55,
      y: -1424.87,
      text: "the raviney ravine (underground)",
      type: Mining
    },
    {
      x: 9839.64,
      y: -1041.27,
      text: "the giant broken portal that it would be cool to get working again",
      type: Normal
    },
    {
      x: 10206.82,
      y: -1174.11,
      text: "bambooland",
      type: Biome
    },
    {
      x: 10197.86,
      y: -1659.21,
      text: "zomb spomber",
      type: Monsters
    },
    {
      x: 9651.57,
      y: -1936.83,
      text: "acacia village... 2!",
      type: Village
    },
    {
      x: 8950.05,
      y: -666.63,
      text: "nether portal (jungle zone entrance)",
      type: Normal,
      pathMarker: true
    },
    {
      x: 8435.1,
      y: -900.97,
      text: "talltree town",
      type: Village
    },
    {
      x: 8408.23,
      y: -781.56,
      text: "sunflower fields forever",
      type: Biome
    },
    {
      x: 8942.58,
      y: -363.63,
      text: "an entire gote",
      type: Normal
    },
    {
      x: 8838.1,
      y: -80.04,
      text: "the swampy swamp",
      type: Biome
    },
    {
      x: 9047.07,
      y: -903.95,
      text: "portalville",
      type: Village
    },
    {
      x: 3440.26,
      y: 1878.07,
      text: "tulpen!!",
      type: Biome
    },
    {
      x: 3173.62,
      y: 1876.1,
      text: "ravine-torn village",
      type: Village
    },
    {
      x: 3829.36,
      y: -2326.99,
      text: "gouged-out town",
      type: Village
    },
    {
      x: 3764.18,
      y: -2151.21,
      text: "a promising raviney thing",
      type: Mining
    },
    {
      x: 3171.64,
      y: -2727.95,
      text: "this one has a fucked-up floating bit",
      type: Village
    },
    {
      x: 3930.09,
      y: 88.6,
      text: "magmaed trench",
      type: Normal
    },
    {
      x: 4013.05,
      y: 485.6,
      text: "magma occurrence",
      type: Normal
    },
    {
      x: 3941.95,
      y: -480.24,
      text: 'coral "reef"',
      type: Normal
    },
    {
      x: 3657.53,
      y: -1665.32,
      text: "cool cool mountain",
      type: Mining
    },
    {
      x: 3860.97,
      y: -1459.91,
      text: "floodburgh",
      type: Village
    },
    {
      x: 840.28,
      y: 408.45,
      text: "slime farm farm",
      type: Monsters
    },
    {
      x: 9747.76,
      y: -819.96,
      text: "underground jungle ravine",
      type: Mining
    },
    {
      x: 9796.24,
      y: -781.18,
      text: "jungle temple",
      type: Monsters
    },
    {
      x: 9096.27,
      y: -592.11,
      text: "the Abyss",
      type: Normal
    },
    {
      x: 4780.79,
      y: -1055.88,
      text: "coral field",
      type: Biome
    },
    {
      x: 4483.08,
      y: -1082.14,
      text: "normal ravine",
      type: Mining
    },
    {
      x: 4938.4,
      y: -2027.81,
      text: "mystery swamp",
      type: Biome
    },
    {
      x: 3925.61,
      y: -218.21,
      text: "crystal cave",
      type: Mining
    },
    {
      x: 4124.04,
      y: -1470.33,
      text: "zombie spawner",
      type: Monsters
    },
    {
      x: 4955.87,
      y: -110.21,
      text: "mushroom island",
      type: Biome
    },
    {
      x: 5002.57,
      y: -8.06,
      text: "mushroom island ravine (partially plumbed)",
      type: Mining
    },
    {
      x: 4617.3,
      y: -915.78,
      text: "even more coral (a lot)",
      type: Biome
    },
    {
      x: 3077.64,
      y: -2023.12,
      text: "skeletman spawner",
      type: Monsters
    },
    {
      x: 6658.34,
      y: -525.62,
      text: "Mystery Zone",
      type: Normal
    },
    {
      x: 1639.74,
      y: 623.74,
      text: "we eat wheat",
      type: Normal
    }
  ].map(p => new PointOfInterest(p, 3))
};

export default pois;
