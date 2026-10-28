// Legend: # wall, @ player, + player on goal, $ box, * box on goal, . goal, space floor
const LEVELS = [
  {
    name: "Primeiro Passo",
    map: [
      "######",
      "#@ $.#",
      "######",
    ],
  },
  {
    name: "Cantinho",
    map: [
      "#######",
      "#     #",
      "# .$  #",
      "#  @  #",
      "#######",
    ],
  },
  {
    name: "Dois Mais Dois",
    map: [
      "#######",
      "#. .  #",
      "#  $$ #",
      "#  @  #",
      "#######",
    ],
  },
  {
    name: "Corredor",
    map: [
      "########",
      "#  .   #",
      "# $$ # #",
      "#@ .   #",
      "########",
    ],
  },
  {
    name: "Armazém",
    map: [
      "  #####  ",
      "###   ###",
      "#  $.$  #",
      "# .@$.  #",
      "#   $   #",
      "#  .    #",
      "#########",
    ],
  },
];
if (typeof module !== "undefined") module.exports = LEVELS;
