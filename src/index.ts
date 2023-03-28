import { selectors, types, util } from 'vortex-api';
import * as path from 'path';
import { UnrealEngineGame, UnrealEngineGameData } from './unrealenginegame';

export interface IExtensionContextExt extends types.IExtensionContext {
  registerUnrealEngineGame: (game: UnrealEngineGameData) => void;
}

function main(context: IExtensionContextExt) {
  context.registerUnrealEngineGame = (game: UnrealEngineGameData) => {
    new UnrealEngineGame(context, game);
  };

  const testUnrealGame = (gameId: string): boolean => {
    const game: types.IGame = util.getGame(gameId);
    const unrealModsPath = util.getSafe(game, ['details', 'unrealModsPath'], undefined);
    return !!unrealModsPath;
  };

  const testForUnrealMod = (files, gameId) => {
    const supportedGame: boolean = testUnrealGame(gameId);
    const fileExt: string = util.getSafe(util.getGame(gameId), ['details', 'unrealFileExt'], undefined);
    let pakFiles = [];
    if (fileExt) pakFiles = files.filter(file => path.extname(file).toLowerCase() === fileExt.toLowerCase());
    
    const supported = (supportedGame && pakFiles.length > 0);

    return Promise.resolve({
      supported,
      requiredFiles: []
    })
  };

  context.registerInstaller('ue4-pak-installer', 25, testForUnrealMod, 
    (files, __destinationPath, gameId) => installUnrealMod(context.api, files, gameId)
  );

  // Mod type of standard (non-sortable) PAKs  
  context.registerModType('ue4-modtype', 25, testUnrealGame, 
    (game: types.IGame) => game.details.unrealModsPath(), 
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
    testUnrealGame, 
    // Install Path
    (game: types.IGame) => game.details.unrealModsPath(), 
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
  const fileExt: string = util.getSafe(game, ['details', 'unrealFileExt'], undefined);
  const sortable: boolean = util.getSafe(game, ['details', 'unrealLoadOrder'], false);
  if (!fileExt) Promise.reject('Unsupported game - UE4 installer failed.');

  const modFiles: string[] = files.filter(file => path.extname(file).toLowerCase() === fileExt.toLowerCase());

  const modType: types.IInstruction = {
    type: 'setmodtype',
    value: sortable ? 'ue4-sortable-modtype' : 'ue4-modtype'
  };

  const installFiles = (modFiles.length > 1) 
    ? await chooseFilesToInstall(api, modFiles, fileExt) 
    : modFiles;

  let instructions = installFiles.map(file => {
    return {
      type: 'copy',
      source: file,
      destination: path.basename(file)
    }
  });
  
  instructions.push(modType);

  return Promise.resolve({instructions});

}

async function chooseFilesToInstall(api: types.IExtensionApi, files: string[], fileExt: string) {
  const t = api.translate;

  return api.showDialog('question', t('Multiple {{PAK}} files', { replace: { PAK: fileExt } }), 
  {
    text: t('The mod you are installing contains {{x}} {{ext}} files.', { replace: { x: files.length, ext: fileExt } })+
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
      const installPAKS = installAll ? files : Object.keys(result.input).filter(s => result.input[s]);

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
  const loadOrder = util.getSafe(state, ['persistent', 'loadOrder', profile.id], {});
  const loKeys = Object.keys(loadOrder);
  const pos = loKeys.indexOf(mod.id);
  if (pos === -1) {
    return 'ZZZZ-';
  }

  return makePrefix(pos) + '-';
}


export default main;
