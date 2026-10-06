import { types } from "@nexusmods/vortex-api";

type IUnrealEngineData = (
    { absModsPath: string } | { modsPath: string }
) & { 
    fileExt?: string, 
    loadOrder?: boolean; 
    loadOrderPrefixFunc?: 
        (context: types.IExtensionContext, mod: types.IMod) => string 
}

type IGameWithUnrealEngineData = types.IGame & { details?: { unrealEngine?: IUnrealEngineData } }

export { IGameWithUnrealEngineData, IUnrealEngineData };