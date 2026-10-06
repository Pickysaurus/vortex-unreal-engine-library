import { types, util } from '@nexusmods/vortex-api';
import * as path from 'path';

import ue4pakinstaller from './installers/ue4-pak-installer';
import testUnrealGame from './util/testUnrealGame';
import ue4SortableModType from './modtypes/ue4-sortable-modtype';
import ue4ModType from './modtypes/ue4-modtype';

const asyncFalse = util.toBlue(async () => Promise.resolve(false));

function main(context: types.IExtensionContext) {

  const { name, priority, testForUnrealMod: test, installUnrealMod: install } = ue4pakinstaller;
  context.registerInstaller(name, priority, test, (files, _destinationPath, gameId) => install(context.api, files, gameId));

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
  const { name: unsortName, priority: unsortPriority, details: unsortDetails } = ue4ModType;
  context.registerModType(
    unsortName, 
    unsortPriority, 
    testUnrealGame, 
    getUnrealModsPath, 
    asyncFalse, 
    unsortDetails
  );

  // Mod type for PAKs that can be sorted in the load order. 
  const { name: sortableName, priority: sortablePriority, details: sortableDetails } = ue4SortableModType;
  context.registerModType(
    sortableName, 
    sortablePriority, 
    (gameId: string) => testUnrealGame(gameId, true),
    getUnrealModsPath, 
    asyncFalse, 
    sortableDetails(context)
  );

  return true;
}

export default main;
