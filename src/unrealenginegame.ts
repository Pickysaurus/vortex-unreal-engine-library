import { actions, fs, types, util } from 'vortex-api';
import * as path from 'path';

export class UnrealEngineGame implements types.IGame {
    // Props from IGame
    public name: string;
    public id: string;
    public logo: string;
    public mergeMods: boolean | ((mod: types.IMod) => string);
    public executable: () => string;
    public queryPath: () => string;
    public queryModPath: () => string;
    public setup: (discovery: types.IDiscoveryResult) => Promise<void>;
    public requiresCleanup: boolean;
    public environment: {[key: string] : string};
    public details: {[key: string] : string};
    public supportedTools: any[];
    public requiredFiles: string[];
    // New props
    public loadOrder: boolean;
    public modsPath: string;
    private previousLO: any;

    private genericLOHelpText = 'Drag and drop the mods on the left to reorder them. {{game}} loads mods in alphanumerical order so Vortex prefixes '
    + 'the folder names with "AAA, AAB, AAC, ..." to ensure they load in the order you set here. '
    + 'The number in the left column represents the overwrite order. The changes from mods with higher numbers will take priority over other mods which make similar edits.'

    constructor(context, game: UnrealEngineGameData) {
        this.id = game.id;
        this.name = game.name;
        this.mergeMods = true;
        this.queryPath = game.queryPath;
        this.requiresCleanup = true;
        this.supportedTools = game.supportedTools || [];
        this.queryModPath = () => '.';
        // this.modsPath = this.getPakModsPath(context.api, game.modsPath),
        this.logo = game.logo;
        this.executable = game.executable;
        this.requiredFiles = game.requiredFiles || [];
        this.setup = () => this.prepareForModding(this.getPakModsPath(context.api, game.modsPath));
        this.environment = game.environment;
        // add more details for the installer/modtype to use. 
        this.details = {
            unrealFileExt: game.fileExt || '.pak',
            unrealModsPath: () => this.getPakModsPath(context.api, game.modsPath),
            unrealLoadOrder: (game.loadOrder === true),
            customOpenModsPath: game.modsPath,
            ...game.details
        }


        //context.registerGame(this);

        if (game.loadOrder) {
            context.registerLoadOrderPage({
                gameId: this.id,
                gameArtURL: game.defaultLOImage || `${__dirname}\\placeholder.png`,
                presort: (items, direction) => this.preSort(context.api, items, direction),
                filter: mods => mods.filter(mod => mod.type === 'ue4-sortable-modtype'),
                displayCheckboxes: false,
                callback: (loadOrder) => this.loadOrderCB(context, loadOrder),
                createInfoPanel: () => game.loadOrderHelpText || context.api.translate(this.genericLOHelpText, { replace:{ game: game.name } })
            });
        }
    }

    getPakModsPath = (api: types.IExtensionApi, modsPath: string) => {
        const state = api.store.getState();
        const discoveryPath = util.getSafe(state.settings, ['gameMode', 'discovered', this.id, 'path'], undefined);
        const pakPath = [discoveryPath].concat(modsPath.split(path.sep));
        return discoveryPath ? path.join.apply(null, pakPath) : undefined;
    }

    prepareForModding = (modPath) => {
        return fs.ensureDirWritableAsync(modPath);
    }

    preSort = async (api, items, direction) => {
        const mods = util.getSafe(api.store.getState(), ['persistent', 'mods', this.id], {});
      
        const loadOrder = items.map(mod => {
          const modInfo = mods[mod.id];
          let name = modInfo ? modInfo.attributes.customFileName ?? modInfo.attributes.logicalFileName ?? modInfo.attributes.name : mod.name;
          const paks = util.getSafe(modInfo.attributes, ['pakFiles'], []);
          if (paks.length > 1) name = name + ` (${paks.length} PAK files)`;
      
          return {
            id: mod.id,
            name,
            imgUrl: modInfo ? modInfo.attributes.pictureUrl : undefined
          }
        });
      
        return (direction === 'descending') ? Promise.resolve(loadOrder.reverse()) : Promise.resolve(loadOrder);
      
    }

    loadOrderCB = (context, loadOrder) => {
        if (this.previousLO === undefined) this.previousLO = loadOrder;
        if (loadOrder === this.previousLO) return;
        context.api.store.dispatch(actions.setDeploymentNecessary(this.id, true));
        this.previousLO = loadOrder;
    }
      

}

export interface UnrealEngineGameData {
    name : string;
    id : string;
    logo: string;
    queryPath: () => string;
    executable: () => string;
    supportedTools?: string[];
    requiredFiles?: string[];
    environment?: {[key: string] : string};
    details?: any;
    loadOrder?: boolean;
    modsPath: string;
    defaultLOImage?: string;
    fileExt?: string;
    loadOrderHelpText?: string;
}