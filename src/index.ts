import { selectors, types, util } from 'vortex-api';
import * as path from 'path';

function main(context: types.IExtensionContext) {

  const testUnrealGame = (gameId: string, withLoadOrder?: boolean): boolean => {
    const game: types.IGame = util.getGame(gameId);
    const unrealModsPath = util.getSafe(game, ['details', 'unrealEngine'], undefined);
    const loadOrder = !!withLoadOrder ? util.getSafe(game, ['details', 'unrealEngine', 'loadOrder'], false) : true;
    return (!!unrealModsPath && loadOrder === true);
  };

  const testForUnrealMod = (files: string[], gameId: string) => {
    const supportedGame: boolean = testUnrealGame(gameId); 
    let fileExt: (string | string[]) = util.getSafe(util.getGame(gameId), ['details', 'unrealEngine', 'fileExt'], '.pak');
    let modFiles = [];
    if (fileExt) {
      if (!Array.isArray(fileExt)) fileExt = [fileExt]
      modFiles = files.filter(file => fileExt.includes(path.extname(file).toLowerCase()));
    }
    const supported = (supportedGame && modFiles.length > 0);

    return Promise.resolve({
      supported,
      requiredFiles: []
    })
  };

  context.registerInstaller('ue4-pak-installer', 25, testForUnrealMod, 
    (files, __destinationPath, gameId) => installUnrealMod(context.api, files, gameId)
  );

  const getUnrealModsPath = (game: types.IGame): string => {
    // Get the absModsPath from the game details.
    const absModsPath = util.getSafe(game, ['details', 'unrealEngine', 'absModsPath'], undefined);
    // If we have an absolute path, we can just return that. 
    if (absModsPath) return absModsPath;
    // Get the modsPath from the game details.
    const modsPath = util.getSafe(game, ['details', 'unrealEngine', 'modsPath'], undefined);
    // Get the game root folder
    const state = context.api.getState();
    const discoveryPath = util.getSafe(state.settings, ['gameMode', 'discovered', game.id, 'path'], undefined);
    // Combine the paths to get the deployment folder. 
    const installPath = [discoveryPath].concat(modsPath.split(path.sep));
    return discoveryPath ? path.join.apply(null, installPath) : undefined;
  }

  // Mod type of standard (non-sortable) PAKs  
  context.registerModType('ue4-modtype', 25, testUnrealGame, 
    getUnrealModsPath, 
    () => Promise.resolve(false), 
    {
      name: 'Unreal Engine 4 Mod',
      mergeMods: false
    }
  );

  // Mod type for PAKs that can be sorted in the load order. 
  context.registerModType(
    'ue4-sortable-modtype', 
    25, 
    // Test for game ID
    (gameId: string) => testUnrealGame(gameId, true),
    // Install Path
    getUnrealModsPath, 
    // Alway return false for auto detection as we can't determine the game. 
    () => Promise.resolve(false), 
    {
      name: 'Unreal Engine 4 Sortable Mod',
      mergeMods: mod => loadOrderPrefix(context.api, mod) + mod.id
    }
  );

  return true;
}

async function installUnrealMod(api: types.IExtensionApi, files: string[], gameId: string) {
  const game: types.IGame = util.getGame(gameId);
  let fileExt: (string | string[]) = util.getSafe(game, ['details', 'unrealEngine', 'fileExt'], '.pak');
  const sortable: boolean = util.getSafe(game, ['details', 'unrealEngine', 'loadOrder'], false);
  if (!fileExt) Promise.reject('Unsupported game - UE4 installer failed.');

  if (!Array.isArray(fileExt)) fileExt = [fileExt]
  const modFiles: string[] = files.filter(file => fileExt.includes(path.extname(file).toLowerCase()));

  const modType: types.IInstruction = {
    type: 'setmodtype',
    value: sortable ? 'ue4-sortable-modtype' : 'ue4-modtype'
  };

  const installFiles = (modFiles.length > 1) 
    ? await chooseFilesToInstall(api, modFiles, fileExt) 
    : modFiles;

  const unrealModFiles = {
    type: 'attribute',
    key: 'unrealModFiles',
    value: modFiles.map(f => path.basename(f))
  }

  let instructions = installFiles.map(file => {
    return {
      type: 'copy',
      source: file,
      destination: path.basename(file)
    }
  });
  
  instructions.push(modType);
  instructions.push(unrealModFiles);

  return Promise.resolve({instructions});

}

async function chooseFilesToInstall(api: types.IExtensionApi, files: string[], fileExt: string | string[]) {
  const t = api.translate;

  if (!Array.isArray(fileExt)) fileExt = [fileExt]

  return api.showDialog('question', t('Multiple {{PAK}} files', { replace: { PAK: fileExt.join(`/`) } }), 
  {
    text: t('The mod you are installing contains {{x}} {{ext}} files.', { replace: { x: files.length, ext: fileExt.join(`/`) } })+
    `This can be because the author intended for you to chose one of several options. Please select which files to install below:`,
    checkboxes: files.map((pak: string) => {
      return {
        id: path.basename(pak),
        text: path.basename(pak),
        value: false
      }
    })
  },
  [
    { label: 'Cancel' },
    { label: 'Install Selected' },
    { label: 'Install All_plural' }
  ]
  ).then((result) => {
    if (result.action === 'Cancel') return Promise.reject( new util.ProcessCanceled('User cancelled.') );
    else {
      const installAll = (result.action === 'Install All' || result.action === 'Install All_plural');
      const installPAKS = installAll ? files : Object.keys(result.input).filter(s => result.input[s])
      .map(file => files.find(f => path.basename(f) === file));

      return installPAKS;
    }
  });
}

function makePrefix(input) {
  let res: any = '';
  let rest: number = input;
  while (rest > 0) {
    res = String.fromCharCode(65 + (rest % 25)) + res;
    rest = Math.floor(rest / 25);
  }
  return util.pad(res, 'A', 3);
}

function loadOrderPrefix(api: types.IExtensionApi, mod: types.IMod): string {
  const state = api.getState();
  const gameId = mod.attributes.downloadGame;
  if (!gameId) return 'ZZZZ-';
  const profile = selectors.lastActiveProfileForGame(state, gameId);
  const loadOrder = util.getSafe(state, ['persistent', 'loadOrder', profile], {});
  const loKeys = Object.keys(loadOrder);
  const pos = loKeys.indexOf(mod.id);
  if (pos === -1) {
    return 'ZZZZ-';
  }

  return makePrefix(pos) + '-';
}


export default main;
