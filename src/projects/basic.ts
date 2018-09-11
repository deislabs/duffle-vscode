import * as path from 'path';

import { Errorable } from '../utils/errorable';
import { ProjectCreator } from './creator';
import { fs } from '../utils/fs';

export const basicProjectCreator: ProjectCreator = {
    create: create
};

async function create(rootPath: string): Promise<Errorable<null>> {
    const duffleTOMLPath = path.join(rootPath, 'duffle.toml');
    const cnabFolderPath = path.join(rootPath, 'cnab');
    const bundleJSONPath = path.join(cnabFolderPath, 'bundle.json');

    if (await fs.exists(duffleTOMLPath)) {
        return { succeeded: false, error: ['duffle.toml already exists'] };
    }
    if (await fs.exists(cnabFolderPath)) {
        return { succeeded: false, error: ['cnab folder already exists'] };
    }
    if (await fs.exists(bundleJSONPath)) {
        return { succeeded: false, error: ['cnab/bundle.json already exists'] };
    }

    try {
        await fs.writeFile(duffleTOMLPath, '[[Placeholder content for duffle.toml]]');
        await fs.mkdir(cnabFolderPath);
        await fs.writeFile(bundleJSONPath, '{ "placeholder": "content for bundle.json" }');
    } catch (e) {
        return { succeeded: false, error: [`Error writing file: ${e}`] };
    }

    return { succeeded: true, result: null };
}
