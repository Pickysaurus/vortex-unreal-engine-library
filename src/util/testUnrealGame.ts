import { util } from '@nexusmods/vortex-api';
import type { IGameWithUnrealEngineData } from '../types'

const testUnrealGame = (gameId: string, withLoadOrder: boolean = false): boolean => {
    const game: IGameWithUnrealEngineData = util.getGame(gameId);
    const unrealModsPath = game.details?.unrealEngine;
    const correctLoadOrder = withLoadOrder === (unrealModsPath?.loadOrder ?? false);
    return (!!unrealModsPath && correctLoadOrder === true);
};

export default testUnrealGame;