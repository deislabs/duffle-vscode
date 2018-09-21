import * as vscode from 'vscode';
import * as path from 'path';

import { longRunning, showDuffleResult, refreshBundleExplorer } from '../utils/host';
import * as duffle from '../duffle/duffle';
import { RepoBundle, RepoBundleRef } from '../duffle/duffle.objectmodel';
import { succeeded, map, Errorable } from '../utils/errorable';
import * as shell from '../utils/shell';
import { cantHappen } from '../utils/never';
import { promptBundle, BundleSelection, fileBundleSelection, repoBundleSelection } from '../utils/bundleselection';
import { promptForParameters } from '../utils/parameters';
import { withOptionalTempFile } from '../utils/tempfile';

export async function install(target?: any): Promise<void> {
    if (!target) {
        return await installPrompted();
    }
    if (target.scheme) {
        return await installFile(target as vscode.Uri);
    }
    if (target.bundle) {
        return await installRepoBundle((target as RepoBundleRef).bundle);
    }
    await vscode.window.showErrorMessage("Internal error: unexpected command target");
}

async function installPrompted(): Promise<void> {
    const bundlePick = await promptBundle("Select the bundle to install");

    if (!bundlePick) {
        return;
    }

    return await installCore(bundlePick);
}

async function installFile(file: vscode.Uri): Promise<void> {
    if (file.scheme !== 'file') {
        vscode.window.showErrorMessage("This command requires a filesystem bundle");
        return;
    }
    return await installCore(fileBundleSelection(file));
}

async function installRepoBundle(bundle: RepoBundle): Promise<void> {
    return await installCore(repoBundleSelection(bundle));
}

async function installCore(bundlePick: BundleSelection): Promise<void> {
    const name = await vscode.window.showInputBox({ prompt: `Install bundle in ${bundlePick.label} as...`, value: bundlePick.label });
    if (!name) {
        return;
    }

    const parameterValues = await promptForParameters(bundlePick, 'Install', 'Enter installation parameters');
    if (parameterValues.cancelled) {
        return;
    }

    const installResult = await installToViaTempFile(bundlePick, name, parameterValues.values);

    if (succeeded(installResult)) {
        await refreshBundleExplorer();
    }

    await showDuffleResult('install', (bundleId) => bundleId, installResult);
}

async function installToViaTempFile(bundlePick: BundleSelection, name: string, parameterValues: any): Promise<Errorable<string>> {
    const parametersJSON = parameterValues ? JSON.stringify(parameterValues, undefined, 2) : undefined;
    return withOptionalTempFile(parametersJSON, 'json', (paramsFile) => installTo(bundlePick, name, paramsFile));
}

async function installTo(bundlePick: BundleSelection, name: string, paramsFile: string | undefined): Promise<Errorable<string>> {
    if (bundlePick.kind === 'folder') {
        const folderPath = bundlePick.path;
        const bundlePath = path.join(folderPath, "cnab", "bundle.json");
        const installResult = await longRunning(`Duffle installing ${bundlePath}`,
            () => duffle.installFile(shell.shell, bundlePath, name, paramsFile)
        );
        return map(installResult, (_) => bundlePath);
    } else if (bundlePick.kind === 'repo') {
        const installResult = await longRunning(`Duffle installing ${bundlePick.bundle}`,
            () => duffle.installBundle(shell.shell, bundlePick.label /* because bundlePick.bundle doesn't work */, name, paramsFile)
        );
        return map(installResult, (_) => bundlePick.bundle);
    }
    return cantHappen(bundlePick);
}
