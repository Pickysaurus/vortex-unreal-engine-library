import { types, VortexError } from '@nexusmods/vortex-api';
import * as path from 'path';

export default async function chooseFilesToInstall(api: types.IExtensionApi, files: string[], fileExt: string | string[]): Promise<string[]> {
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
    if (e instanceof VortexError) throw e;
    throw new VortexError("Failed to select PAK files", { kind: 'unknown' })
  }
}