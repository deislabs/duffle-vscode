'use strict';

import * as path from 'path';
import * as vscode from 'vscode';

import { BundleRef, RepoBundleRef, RepoBundle } from './duffle/duffle.objectmodel';
import { BundleExplorer } from './explorer/bundle/bundle-explorer';
import { RepoExplorer } from './explorer/repo/repo-explorer';
import * as shell from './utils/shell';
import * as duffle from './duffle/duffle';
import { DuffleTOMLCompletionProvider } from './completion/duffle.toml.completions';
import { selectWorkspaceFolder, selectQuickPick, longRunning } from './utils/host';
import { failed, Errorable, map, succeeded } from './utils/errorable';

export function activate(context: vscode.ExtensionContext) {
    const bundleExplorer = new BundleExplorer(shell.shell);
    const repoExplorer = new RepoExplorer(shell.shell);
    const duffleTOMLCompletionProvider = new DuffleTOMLCompletionProvider();

    const subscriptions = [
        vscode.commands.registerCommand('duffle.refreshBundleExplorer', () => bundleExplorer.refresh()),
        vscode.commands.registerCommand('duffle.bundleStatus', (node) => bundleStatus(node)),
        vscode.commands.registerCommand('duffle.bundleUpgrade', (node) => bundleUpgrade(node)),
        vscode.commands.registerCommand('duffle.build', build),
        vscode.commands.registerCommand('duffle.install', install),
        vscode.commands.registerCommand('duffle.refreshRepoExplorer', () => repoExplorer.refresh()),
        vscode.window.registerTreeDataProvider("duffle.bundleExplorer", bundleExplorer),
        vscode.window.registerTreeDataProvider("duffle.repoExplorer", repoExplorer),
        vscode.languages.registerCompletionItemProvider({ language: 'toml', pattern: '**/duffle.toml', scheme: 'file' }, duffleTOMLCompletionProvider, '[', ',')
    ];

    context.subscriptions.push(...subscriptions);
}

export function deactivate() {
}

async function build(): Promise<void> {
    const folder = await selectWorkspaceFolder("Choose folder to build");
    if (!folder) {
        return;
    }

    if (folder.uri.scheme !== 'file') {
        vscode.window.showErrorMessage("This command requires a filesystem folder");
        return;
    }

    const folderPath = folder.uri.fsPath;
    const buildResult = await longRunning(`Duffle building ${folderPath}`,
        () => duffle.build(shell.shell, folderPath)
    );

    await showDuffleResult('build', folderPath, buildResult);
}

interface BundleSelection {
    readonly kind: 'folder' | 'repo';
    readonly label: string;
    readonly path: string;
    readonly bundle: string;
}

async function install(target?: any): Promise<void> {
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
        await vscode.commands.executeCommand("duffle.refreshBundleExplorer");
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
    return { succeeded: false, error: [`Internal error: unknown bundle installation source ${bundlePick.kind}`] };
}

function fileBundleSelection(bundleFile: vscode.Uri): BundleSelection {
    const bundleDir = path.dirname(path.dirname(bundleFile.fsPath));
    return {
        kind: 'folder',
        label: path.basename(bundleDir),
        path: bundleDir,
        bundle: ''
    };
}

function repoBundleSelection(bundle: RepoBundle): BundleSelection {
    return {
        kind: 'repo',
        label: bundle.name,
        path: '',
        bundle: `${bundle.repository}/${bundle.name}`
    };
}

function bundleStatus(bundle: BundleRef) {
    duffle.showStatus(bundle.bundleName);
}

async function bundleUpgrade(bundle: BundleRef): Promise<void> {
    const upgradeResult = await longRunning(`Duffle upgrading ${bundle.bundleName}`,
        () => duffle.upgrade(shell.shell, bundle.bundleName)
    );

    await showDuffleResult('upgrade', bundle.bundleName, upgradeResult);
}

async function showDuffleResult<T>(command: string, resource: string | ((r: T) => string), duffleResult: Errorable<T>): Promise<void> {
    if (failed(duffleResult)) {
        // The invocation infrastructure adds blurb about what command failed, and
        // Duffle's CLI parser adds 'Error:'. We don't need that here because we're
        // going to prepend our own blurb.
        const message = trimPrefix(duffleResult.error[0], `duffle ${command} error: Error:`).trim();
        await vscode.window.showErrorMessage(`Duffle ${command} failed: ${message}`);
    } else {
        const resourceText = resource instanceof Function ? resource(duffleResult.result) : resource;
        await vscode.window.showInformationMessage(`Duffle ${command} complete for ${resourceText}`);
    }
}

function trimPrefix(text: string, prefix: string): string {
    if (text.startsWith(prefix)) {
        return text.substring(prefix.length);
    }
    return text;
}
