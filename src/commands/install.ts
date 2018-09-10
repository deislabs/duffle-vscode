import * as vscode from 'vscode';
import * as path from 'path';

import { selectQuickPick, longRunning, showDuffleResult, refreshBundleExplorer } from '../utils/host';
import * as duffle from '../duffle/duffle';
import { RepoBundle, RepoBundleRef } from '../duffle/duffle.objectmodel';
import { succeeded, map, Errorable } from '../utils/errorable';
import * as shell from '../utils/shell';
import { cantHappen } from '../utils/never';

interface FolderBundleSelection {
    readonly kind: 'folder';
    readonly label: string;
    readonly path: string;
}

interface RepoBundleSelection {
    readonly kind: 'repo';
    readonly label: string;
    readonly bundle: string;
}

type BundleSelection = FolderBundleSelection | RepoBundleSelection;

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
    const bundles = await vscode.workspace.findFiles('**/cnab/bundle.json');
    if (!bundles || bundles.length === 0) {
        await vscode.window.showErrorMessage("This command requires a bundle file in the current workspace.");
        return;
    }

    const bundleQuickPicks = bundles.map(fileBundleSelection);

    const bundlePick = await selectQuickPick(bundleQuickPicks, { placeHolder: "Select the bundle to install " });
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

    const installResult = await installTo(bundlePick, name);

    if (succeeded(installResult)) {
        await refreshBundleExplorer();
    }

    await showDuffleResult('install', (bundleId) => bundleId, installResult);
}

async function installTo(bundlePick: BundleSelection, name: string): Promise<Errorable<string>> {
    if (bundlePick.kind === 'folder') {
        const folderPath = bundlePick.path;
        const bundlePath = path.join(folderPath, "cnab", "bundle.json");
        const installResult = await longRunning(`Duffle installing ${bundlePath}`,
            () => duffle.installFile(shell.shell, bundlePath, name)
        );
        return map(installResult, (_) => bundlePath);
    } else if (bundlePick.kind === 'repo') {
        const installResult = await longRunning(`Duffle installing ${bundlePick.bundle}`,
            () => duffle.installBundle(shell.shell, bundlePick.bundle, name)
        );
        return map(installResult, (_) => bundlePick.bundle);
    }
    return cantHappen(bundlePick);
}

function fileBundleSelection(bundleFile: vscode.Uri): BundleSelection {
    const bundleDir = path.dirname(path.dirname(bundleFile.fsPath));
    return {
        kind: 'folder',
        label: path.basename(bundleDir),
        path: bundleDir
    };
}

function repoBundleSelection(bundle: RepoBundle): BundleSelection {
    return {
        kind: 'repo',
        label: bundle.name,
        bundle: `${bundle.repository}/${bundle.name}`
    };
}
