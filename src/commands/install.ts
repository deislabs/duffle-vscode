import * as vscode from 'vscode';

import { longRunning, showDuffleResult, refreshBundleExplorer } from '../utils/host';
import * as duffle from '../duffle/duffle';
import { RepoBundle, RepoBundleRef } from '../duffle/duffle.objectmodel';
import { succeeded, map, Errorable, failed } from '../utils/errorable';
import * as shell from '../utils/shell';
import { cantHappen } from '../utils/never';
import { promptBundle, BundleSelection, fileBundleSelection, repoBundleSelection, bundleManifest, parseNameOnly, bundleFilePath } from '../utils/bundleselection';
import { promptForParameters } from '../utils/parameters';
import { promptForCredentials } from '../utils/credentials';

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
    const suggestedName = safeName(bundlePick.label);
    const name = await vscode.window.showInputBox({ prompt: `Install bundle in ${bundlePick.label} as...`, value: suggestedName });
    if (!name) {
        return;
    }

    const manifest = await bundleManifest(bundlePick);
    if (failed(manifest)) {
        vscode.window.showErrorMessage(`Unable to load bundle: ${manifest.error[0]}`);
        return;
    }

    const credentialSet = await promptForCredentials(manifest.result, shell.shell, 'Credential set to install bundle with');
    if (credentialSet.cancelled) {
        return;
    }

    const parameterValues = await promptForParameters(bundlePick, manifest.result, 'Install', 'Enter installation parameters');
    if (parameterValues.cancelled) {
        return;
    }

    const installResult = await installTo(bundlePick, name, parameterValues.value, credentialSet.value);

    if (succeeded(installResult)) {
        await refreshBundleExplorer();
    }

    await showDuffleResult('install', (bundleId) => bundleId, installResult);
}

async function installTo(bundlePick: BundleSelection, name: string, params: { [key: string]: string }, credentialSet: string | undefined): Promise<Errorable<string>> {
    if (bundlePick.kind === 'folder') {
        const bundlePath = bundleFilePath(bundlePick);
        const installResult = await longRunning(`Duffle installing ${bundlePath}`,
            () => duffle.installFile(shell.shell, bundlePath, name, params, credentialSet)
        );
        return map(installResult, (_) => bundlePath);
    } else if (bundlePick.kind === 'repo') {
        const installResult = await longRunning(`Duffle installing ${bundlePick.bundle}`,
            () => duffle.installBundle(shell.shell, bundlePick.bundle, name, params, credentialSet)
        );
        return map(installResult, (_) => bundlePick.bundle);
    }
    return cantHappen(bundlePick);
}

const INSTALL_NAME_ILLEGAL_CHARACTERS = /[^A-Za-z0-9_-]/g;

function safeName(bundleName: string): string {
    const baseName = parseNameOnly(bundleName);
    return baseName.replace(INSTALL_NAME_ILLEGAL_CHARACTERS, '-');
}
