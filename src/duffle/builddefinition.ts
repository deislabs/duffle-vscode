import * as vscode from 'vscode';
import * as path from 'path';

import { fs } from '../utils/fs';
import { selectWorkspaceFolder } from '../utils/host';

export const definitionFile = 'duffle.json';
export const languageId = 'json';

export async function locate(): Promise<string | undefined> {
    const folder = await selectWorkspaceFolder("Choose Duffle project folder");
    if (!folder) {
        return undefined;
    }

    if (folder.uri.scheme !== 'file') {
        vscode.window.showErrorMessage("This command requires a filesystem folder");
        return undefined;
    }

    const folderPath = folder.uri.fsPath;

    const buildFile = path.join(folderPath, definitionFile);
    if (!(await fs.exists(buildFile))) {
        vscode.window.showErrorMessage(`${folderPath} does not contain a ${definitionFile} file`);
        return undefined;
    }

    return buildFile;
}
