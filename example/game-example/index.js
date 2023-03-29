// Libraries required for the extension.
const { actions, fs, util } = require('vortex-api');
const path = require('path');

// Basic Game Information
const GAMEID = 'nexusmodsdomainid'; //Nexus Mods ID (the part of the URL before "mods")
const GAME_NAME = 'Name of the Game';
const GAME_ARTWORK = 'gameart.png';
const EXE_PATH = path.join('NamedFolder', 'Binaries', 'Win64', 'SoulcaliburVI.exe');

// Game store IDs - fill in the ones that apply, leave any others as ''. 
const STEAMAPP_ID = '';
const GOGAPP_ID = '';
const EPICAPP_ID = '';
const WINDOWSAPP_ID = '';
const UPLAYAPP_ID = '';
const GAMESTORES = [STEAMAPP_ID, GOGAPP_ID, EPICAPP_ID, WINDOWSAPP_ID, UPLAYAPP_ID];

/* 
  Unreal Engine Game Data 
  - absModsPath: if the mods folder isn't inside the game directly, define the full path here. 
  - modsPath: this is where the mod files need to be installed, relative to the game install folder.
  - fileExt(optional): if for some reason the game uses something other than PAK files, add the extensions here.
  - loadOrder: do we want to show the load order tab? 
*/
const UNREALDATA = {
  // absModsPath: path.join(app.getPath('Documents'), 'My Games', 'Some game', 'Mods),
  modsPath: path.join('NamedFolder', 'Content', 'Paks', '~mods'),
  fileExt: '.pak',
  loadOrder: true,
}

function main(context) {

  context.requireExtension('Unreal Engine Mod Installer');

  context.registerGame({
    id: GAMEID,
    name: GAME_NAME,
    mergeMods: true,
    queryPath: findGame,
    requiresCleanup: true,
    supportedTools: [],
    queryModPath: () => '.',
    compatible: {
      unrealEngine: true
    },
    logo: GAME_ARTWORK,
    executable: () => EXE_PATH,
    requiredFiles: [
      EXE_PATH,
    ],
    setup: prepareForModding,
    environment: {
      SteamAPPId: STEAMAPP_ID
    },
    details: {
      unrealEngine: UNREALDATA,
      steamAppId: STEAMAPP_ID,
      customOpenModsPath: UNREALDATA.absModsPath || UNREALDATA.modsPath
    }
  });

  if (UNREALDATA.loadOrder === true) {
    let previousLO;
    context.registerLoadOrderPage({
      gameId: GAMEID,
      gameArtURL: path.join(__dirname, GAME_ARTWORK),
      preSort: (items, direction) => preSort(context.api, items, direction),
      filter: mods => mods.filter(mod => mod.type === 'ue4-sortable-modtype'),
      displayCheckboxes: false,
      callback: (loadOrder) => {
        if (previousLO === undefined) previousLO = loadOrder;
        if (loadOrder === previousLO) return;
        context.api.store.dispatch(actions.setDeploymentNecessary(GAMEID, true));
        previousLO = loadOrder;
      },
      createInfoPanel: () => 
      context.api.translate(`Drag and drop the mods on the left to reorder them. {{gameName}} loads mods in alphanumerical order so Vortex prefixes `
      + 'the folder names with "AAA, AAB, AAC, ..." to ensure they load in the order you set here. '
      + 'The number in the left column represents the overwrite order. The changes from mods with higher numbers will take priority over other mods which make similar edits.',
      { replace: { gameName: GAME_NAME }}),
    });
  }
}

function findGame() {
  return util.GameStoreHelper.findByAppId(GAMESTORES.filter(id => id !== ''))
    .then(game => game.gamePath);
}

function prepareForModding(discovery) {
  return fs.ensureDirWritableAsync(path.join(discovery.path, UNREALDATA.modsPath));
}

async function preSort(api, items, direction) {
  const mods = util.getSafe(api.store.getState(), ['persistent', 'mods', GAMEID], {});
  const fileExt = (UNREALDATA.fileExt || '.pak').substr(1).toUpperCase();

  const loadOrder = items.map(mod => {
    const modInfo = mods[mod.id];
    let name = modInfo ? modInfo.attributes.customFileName ?? modInfo.attributes.logicalFileName ?? modInfo.attributes.name : mod.name;
    const paks = util.getSafe(modInfo.attributes, ['unrealModFiles'], []);
    if (paks.length > 1) name = name + ` (${paks.length} ${fileExt} files)`;
    
    return {
      id: mod.id,
      name,
      imgUrl: util.getSafe(modInfo, ['attributes', 'pictureUrl'], path.join(__dirname, GAME_ARTWORK))
    }
  });

  return (direction === 'descending') ? Promise.resolve(loadOrder.reverse()) : Promise.resolve(loadOrder);
}

module.exports = {
  default: main,
};