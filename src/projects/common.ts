import * as path from 'path';

import { fs } from '../utils/fs';

export function substitutionValues(rootPath: string): { [key: string]: string } {
    return {
        BUNDLE_NAME: path.basename(rootPath)
    };
}

export async function substitutePlaceholders(filePath: string, values: { [key: string]: string }): Promise<void> {
    let content = await fs.readFile(filePath, 'utf8');
    for (const key of ['BUNDLE_NAME']) {
        content = content.replace(`{{!${key}!}}`, values[key] || '');
    }
    await fs.writeFile(filePath, content);
}
