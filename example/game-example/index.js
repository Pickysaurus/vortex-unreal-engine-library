const { actions, fs, util } = require('vortex-api');
const { mainModule } = require('process');

function main(context) {

  context.requireExtension('unreal-engine-game-library');

  context.registerUnrealEngineGame({
    name: 'Test Game 1',
    id: 'test1',
    logo: 'placeholder.png',
    queryPath: () => fs.ensureDirWritableAsync(path.join('c:', 'games', 'fake games', 'fakegame1')),
    executable: () => 'test.exe',
    modsPath: path.join('testgame', 'content', 'paks', '~mods')
  });

  context.registerUnrealEngineGame({
    name: 'Test Game 2',
    id: 'test2',
    logo: 'placeholder.png',
    queryPath: () => fs.ensureDirWritableAsync(path.join('c:', 'games', 'fake games', 'fakegame2')),
    executable: () => 'test.exe',
    modsPath: path.join('testgame', 'content', 'paks', '~mod'),
    loadOrder: true
  });
}

module.exports = {
  default: main,
};
