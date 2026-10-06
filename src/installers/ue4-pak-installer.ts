import { types, util } from '@nexusmods/vortex-api';
import * as path from 'path';
import chooseFilesToInstall from '../util/chooseFilesToInstall';
import testUnrealGame from '../util/testUnrealGame';

export const name = 'ue4-pak-installer'
export const priority = 25;


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

  async function installUnrealMod(api: types.IExtensionApi, files: string[], gameId: string): Promise<types.IInstallResult> {
  const game: types.IGame = util.getGame(gameId);
  let fileExt: (string | string[]) = game?.details?.unrealEngine?.fileExt ?? '.pak';
  const sortable: boolean = game?.details?.unrealEngine?.loadOrder ?? false;
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

const ue4pakinstaller = {
    name,
    priority,
    testForUnrealMod,
    installUnrealMod
};

export default ue4pakinstaller;