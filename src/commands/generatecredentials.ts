import * as vscode from 'vscode';

import { longRunning, showDuffleResult, refreshCredentialExplorer } from '../utils/host';
import * as duffle from '../duffle/duffle';
import { RepoBundle, RepoBundleRef } from '../duffle/duffle.objectmodel';
import * as dufflepaths from '../duffle/duffle.paths';
import { succeeded, map, Errorable } from '../utils/errorable';
import * as shell from '../utils/shell';
import { cantHappen } from '../utils/never';
import { promptBundle, BundleSelection, fileBundleSelection, repoBundleSelection, bundleFilePath, suggestName } from '../utils/bundleselection';

export async function generateCredentials(target?: any): Promise<void> {
    if (!target) {
        return await generateCredentialsPrompted();
    }
    if (target.scheme) {
        return await generateCredentialsForFile(target as vscode.Uri);
    }
    if (target.bundle) {
        return await generateCredentialsForRepoBundle((target as RepoBundleRef).bundle);
    }
    await vscode.window.showErrorMessage("Internal error: unexpected command target");
}

async function generateCredentialsPrompted(): Promise<void> {
    const bundlePick = await promptBundle("Select the bundle to generate credentials for");

    if (!bundlePick) {
        return;
    }

    return await generateCredentialsCore(bundlePick);
}

async function generateCredentialsForFile(file: vscode.Uri): Promise<void> {
    if (file.scheme !== 'file') {
        vscode.window.showErrorMessage("This command requires a filesystem bundle");
        return;
    }
    return await generateCredentialsCore(fileBundleSelection(file));
}

async function generateCredentialsForRepoBundle(bundle: RepoBundle): Promise<void> {
    return await generateCredentialsCore(repoBundleSelection(bundle));
}

async function generateCredentialsCore(bundlePick: BundleSelection): Promise<void> {
    const credentialSetName = suggestName(bundlePick);
    const generateResult = await generateCredentialsTo(bundlePick, credentialSetName);

    if (succeeded(generateResult)) {
        await refreshCredentialExplorer();
        await openCredentialSet(credentialSetName);
    }

    await showDuffleResult('generate credentials', (bundleId) => bundleId, generateResult);
}

async function generateCredentialsTo(bundlePick: BundleSelection, credentialSetName: string): Promise<Errorable<string>> {
    if (bundlePick.kind === 'file') {
        const bundlePath = bundleFilePath(bundlePick);
        const generateResult = await longRunning(`Duffle generating credentials for ${bundlePath}`,
            () => duffle.generateCredentialsForFile(shell.shell, bundlePath, credentialSetName)
        );
        return map(generateResult, (_) => bundlePath);
    } else if (bundlePick.kind === 'repo') {
        const installResult = await longRunning(`Duffle generating credentials for ${bundlePick.bundle}`,
            () => duffle.generateCredentialsForBundle(shell.shell, bundlePick.bundle, credentialSetName)
        );
        return map(installResult, (_) => bundlePick.bundle);
    } else if (bundlePick.kind === 'local') {
        const installResult = await longRunning(`Duffle generating credentials for ${bundlePick.bundle}`,
            () => duffle.generateCredentialsForBundle(shell.shell, bundlePick.bundle, credentialSetName)
        );
        return map(installResult, (_) => bundlePick.bundle);
    }
    return cantHappen(bundlePick);
}

async function openCredentialSet(credentialSetName: string): Promise<void> {
    const filePath = dufflepaths.credentialSetPath(credentialSetName);
    const fileUri = vscode.Uri.file(filePath);
    await vscode.commands.executeCommand("vscode.open", fileUri);
}