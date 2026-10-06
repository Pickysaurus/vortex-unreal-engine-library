import { selectors, types, util } from "@nexusmods/vortex-api";

function makePrefix(input: number) {
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

export default loadOrderPrefix;