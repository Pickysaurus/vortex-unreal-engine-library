import { selectors, types, util, VortexError } from '@nexusmods/vortex-api';
import * as path from 'path';

const asyncFalse = util.toBlue(async () => Promise.resolve(false));

function main(context: types.IExtensionContext) {

  const testUnrealGame = (gameId: string, withLoadOrder?: boolean): boolean => {
    const game: types.IGame = util.getGame(gameId);
    const unrealModsPath = game.details?.unrealEngine;
    const loadOrder = !!withLoadOrder ? (unrealModsPath?.loadOrder ?? false) : true;
    return (!!unrealModsPath && loadOrder === true);
  };

  const testForUnrealMod = (files: string[], gameId: string) => {
    const supportedGame: boolean = testUnrealGame(gameId); 
    let fileExt: (string | string[]) = util.getGame(gameId)?.details?.unrealEngine?.fileExit ?? ".pak";
    let modFiles: string[] = [];
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

  const getUnrealModsPath = (game: types.IGame): string  => {
    const ueConfig = game.details?.unrealEngine;
    if (!ueConfig) throw new Error("Not an Unreal Engine game");
    const { absModsPath, modsPath } = ueConfig;
    if (!absModsPath && !modsPath) throw new Error("Unreal Engine game extension is missing path details");
    // If we have an absolute path, we can just return that. 
    if (absModsPath) return absModsPath;
    // Get the game root folder
    const state = context.api.getState();
    const discoveryPath = state.settings.gameMode?.discovered?.[game.id]?.path;
    if (!discoveryPath) throw new Error("Unreal Engine game not discovered");
    // Combine the paths to get the deployment folder. 
    const installPath = [discoveryPath].concat(modsPath.split(path.sep));
    return path.join.apply(null, installPath);
  }

  // Mod type of standard (non-sortable) PAKs  
  context.registerModType('ue4-modtype', 25, testUnrealGame, 
    getUnrealModsPath, 
    asyncFalse, 
    {
      name: 'Unreal Engine Pak Mod',
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
    asyncFalse, 
    {
      name: 'Unreal Engine Pak Sortable Mod',
      mergeMods: mod => {
          const gameId = mod.attributes?.downloadGame;
          const game = util.getGame(gameId!);
          const loadOrderPrefixFunc = util.getSafe(game, ['details', 'unrealEngine', 'loadOrderPrefixFunc'], loadOrderPrefix);
          return loadOrderPrefixFunc(context, mod) + mod.id;
      }
    }
  );

  return true;
}

async function installUnrealMod(api: types.IExtensionApi, files: string[], gameId: string): Promise<types.IInstallResult> {
  const game: types.IGame = util.getGame(gameId);
  let fileExt: (string | string[]) = util.getSafe(game, ['details', 'unrealEngine', 'fileExt'], '.pak');
  const sortable: boolean = util.getSafe(game, ['details', 'unrealEngine', 'loadOrder'], false);
  if (!fileExt) Promise.reject('Unsupported game - UE installer failed.');

  if (!Array.isArray(fileExt)) fileExt = [fileExt]
  const modFiles: string[] = files.filter(file => fileExt.includes(path.extname(file).toLowerCase()));

  const modType: types.IInstruction = {
    type: 'setmodtype',
    value: sortable ? 'ue4-sortable-modtype' : 'ue4-modtype'
  };

  const installFiles: string[] = (modFiles.length > 1) 
    ? await chooseFilesToInstall(api, modFiles, fileExt) 
    : modFiles;

  const unrealModFiles: types.IInstruction = {
    type: 'attribute',
    key: 'unrealModFiles',
    value: modFiles.map(f => path.basename(f))
  }

  let instructions: types.IInstruction[] = installFiles?.map(file => {
    return {
      type: 'copy',
      source: file,
      destination: path.basename(file)
    }
  }) ?? [];
  
  instructions.push(modType);
  instructions.push(unrealModFiles);

  return Promise.resolve({instructions});

}

async function chooseFilesToInstall(api: types.IExtensionApi, files: string[], fileExt: string | string[]): Promise<string[]> {
  const t = api.translate;

  if (!Array.isArray(fileExt)) fileExt = [fileExt];

  try {
    const result = await api.showDialog?.('question', t('Multiple {{PAK}} files', { replace: { PAK: fileExt.join(`/`) } }), 
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
    );

    if (!result || result?.action === 'Cancel') throw new VortexError('User cancelled.', { kind: 'user-canceled', skipped: true });
    else {
      const installAll = (result.action === 'Install All' || result.action === 'Install All_plural');
      if (installAll) return files;

      const input = result.input ?? {};

      const paksToInstall = Object.keys(input).filter(s => input[s]).map(file => files.find(f => path.basename(f) === file)).filter(f => f !== undefined);

      if (paksToInstall.length === 0) {
        throw new VortexError('No files selected.', {
          kind: 'user-canceled',
          skipped: true,
        });
      }

      return paksToInstall;
    }

  }
  catch(e: unknown) {
    throw new VortexError("Failed to select PAK files", { kind: 'unknown' })
  }
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

function loadOrderPrefix(context: types.IExtensionContext, mod: types.IMod): string {
  const api = context.api;
  const state = api.getState() as types.IState & { persistent: { loadOrder?: any } };
  const gameId = mod.attributes?.downloadGame;
  if (!gameId) return 'ZZZZ-';
  const profile = selectors.lastActiveProfileForGame(state, gameId);
  const loadOrder = state.persistent.loadOrder?.[profile] ?? {};
  const loKeys = Object.keys(loadOrder);
  const pos = loKeys.indexOf(mod.id);
  if (pos === -1) {
    return 'ZZZZ-';
  }

  return makePrefix(pos) + '-';
}


export default main;
