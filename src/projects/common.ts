import * as path from 'path';
import * as vscode from 'vscode';

import { fs } from '../utils/fs';

export function substitutionValues(rootPath: string): { [key: string]: string } {
    return {
        BUNDLE_NAME: path.basename(rootPath),
        REGISTRY: inferRegistryPrefix()
    };
}

export async function substitutePlaceholders(filePath: string, values: { [key: string]: string }): Promise<void> {
    let content = await fs.readFile(filePath, 'utf8');
    for (const key of ['BUNDLE_NAME', 'REGISTRY']) {
        content = content.replace(`{{!${key}!}}`, values[key] || '');
    }
    await fs.writeFile(filePath, content);
}

function inferRegistryPrefix(): string {
    // Try the default used by the Docker extension
    const registryPath = vscode.workspace.getConfiguration().get<string>("docker.defaultRegistryPath");
    if (registryPath) {
        return registryPath;
    }
    // Try the key used by the k8s extension (and old Docker extension)
    const user = vscode.workspace.getConfiguration().get<string>("vsdocker.imageUser");
    if (user) {
        return user;
    }
    // TODO: Anything else we can think of trying?
    return "<< TODO: your registry prefix here >>";
}
