/*
** Script to parse Tiled JSON map data into:
** Server-ready TypeScript format.
**
** Usage:
** (from project root)
** npm run parse [TiledMapFile.json]
*/

const fs = require('fs');

const tiledFilePath = process.argv[2];

const rawData = fs.readFileSync(tiledFilePath);
const tiledJSON = JSON.parse(rawData);

let outputJSON = {
  'width': tiledJSON.width,
  'height': tiledJSON.height,
  'tile_width': tiledJSON.tilewidth,
  'tile_height': tiledJSON.tileheight
};

// Calculate number of rooms in each direction (including start room_0)
const roomsLayer = tiledJSON.layers.find((layer) => layer.name === 'rooms');

outputJSON = {
  ...outputJSON,
  'rooms': roomsLayer.objects
};

// Transform tile collision data
const groundLayer = tiledJSON.layers.find((layer) => layer.name === 'ground');
let collisionMap = [];

groundLayer.data.forEach((tile, i) => {
  const collider = (tile > 0 ? 1 : 0);
  collisionMap[i] = collider;
});

outputJSON = {
  ...outputJSON,
  'collision_map': collisionMap
};

// Copy the spawn points
const spawnPointsLayer = tiledJSON.layers.find((layer) => layer.name === 'spawn_points');
let spawnPoints = [];

spawnPointsLayer.objects.forEach((spawnPoint) => {
  spawnPoints = [
    ...spawnPoints,
    {
      room: spawnPoint.name,
      x: spawnPoint.x,
      y: spawnPoint.y,
      type: spawnPoint.type
    }
  ];
});

outputJSON = {
  ...outputJSON,
  'spawn_points': spawnPoints
};

// Copy the win objects
const winObjsLayer = tiledJSON.layers.find((layer) => layer.name === 'win_objects');
let winObjs = [];

winObjsLayer.objects.forEach((obj) => {
  winObjs = [
    ...winObjs,
    {
      x: obj.x,
      y: obj.y,
    }
  ];
});

outputJSON = {
  ...outputJSON,
  'win_objects': winObjs
};

// Save to TS file
const outputString = `export default ${JSON.stringify(outputJSON)};`;
const inputPath = tiledFilePath.split('/');
const outputFile = inputPath[inputPath.length - 1].replace('.json', '.ts');

fs.writeFileSync(outputFile, outputString);