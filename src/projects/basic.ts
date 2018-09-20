import * as path from 'path';

import { Errorable } from '../utils/errorable';
import { ProjectCreator } from './creator';
import { fs } from '../utils/fs';
import { substitutionValues, substitutePlaceholders } from './common';

export const basicProjectCreator: ProjectCreator = {
    name: "CNAB Hello World",
    create: create
};

async function create(rootPath: string): Promise<Errorable<string | undefined>> {
    const sourceDir = path.join(__dirname, '../../projects/basic');
    function src(f: string) { return path.join(sourceDir, f); }
    function dest(f: string) { return path.join(rootPath, f); }
    const substitutions = substitutionValues(rootPath);

    // TODO: drive this off the contents of projects/basic
    const folders = [
        'cnab',
        'cnab/app'
    ];
    const files = [
        'duffle.toml',
        'cnab/Dockerfile',
        'cnab/app/run'
    ];

    for (const f of files.concat(folders)) {
        if (await fs.exists(dest(f))) {
            return { succeeded: false, error: [`${f} already exists`] };
        }
    }

    try {
        for (const f of folders) {
            await fs.mkdir(dest(f));
        }
        for (const f of files) {
            await fs.copyFile(src(f), dest(f));
            await substitutePlaceholders(dest(f), substitutions);
        }
    } catch (e) {
        return { succeeded: false, error: [`Error creating new project: ${e}`] };
    }

    return { succeeded: true, result: dest('cnab/app/run') };
}
