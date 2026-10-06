import { types, util } from "@nexusmods/vortex-api";
import loadOrderPrefix from "../util/loadOrder";
import type { IGameWithUnrealEngineData } from '../types'


const details: (context: types.IExtensionContext) => types.IModTypeOptions = (context) => ({
    name: 'Unreal Engine Pak Sortable Mod',
    mergeMods: (mod) => {
        const gameId = mod.attributes?.downloadGame;
        const game: IGameWithUnrealEngineData = util.getGame(gameId!);
        const loadOrderPrefixFunc = game.details?.unrealEngine?.loadOrderPrefixFunc ?? loadOrderPrefix;
        return loadOrderPrefixFunc(context, mod) + mod.id
    }
});

const ue4SortableModType = {
    name: 'ue4-sortable-modtype',
    priority: 25,
    details,
        
}


export default ue4SortableModType;
