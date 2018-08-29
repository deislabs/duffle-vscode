'use strict';

import * as path from 'path';
import * as vscode from 'vscode';

import { BundleRef } from './duffle/duffle.objectmodel';
import { BundleExplorer } from './explorer/bundle/bundle-explorer';
import { RepoExplorer } from './explorer/repo/repo-explorer';
import * as shell from './utils/shell';
import * as duffle from './duffle/duffle';
import { DuffleTOMLCompletionProvider } from './completion/duffle.toml.completions';
import { selectWorkspaceFolder, selectQuickPick, longRunning } from './utils/host';
import { failed } from './utils/errorable';

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

    if (failed(buildResult)) {
        await vscode.window.showErrorMessage(`Duffle build failed: ${buildResult.error[0]}`);
    } else {
        await vscode.window.showInformationMessage(`Duffle build complete for ${folderPath}`);
    }
}

interface BundleSelection {
    readonly label: string;
    readonly path: string;
}

async function install(file?: vscode.Uri): Promise<void> {
    if (file) {
        if (file.scheme !== 'file') {
            vscode.window.showErrorMessage("This command requires a filesystem bundle");
            return;
        }
        return await installCore(bundleSelection(file));
    }

    const bundles = await vscode.workspace.findFiles('**/cnab/bundle.json');
    if (!bundles || bundles.length === 0) {
        await vscode.window.showErrorMessage("This command requires a bundle file in the current workspace.");
        return;
    }

    const bundleQuickPicks = bundles.map(bundleSelection);

    const bundlePick = await selectQuickPick(bundleQuickPicks, { placeHolder: "Select the bundle to install " });
    if (!bundlePick) {
        return;
    }

    return await installCore(bundlePick);
}

async function installCore(bundlePick: BundleSelection): Promise<void> {
    const name = await vscode.window.showInputBox({ prompt: `Install bundle in ${bundlePick.label} as...`, value: bundlePick.label });
    if (!name) {
        return;
    }

    const folderPath = bundlePick.path;
    const bundlePath = path.join(folderPath, "cnab", "bundle.json");
    const installResult = await longRunning(`Duffle installing ${bundlePath}`,
        () => duffle.installFile(shell.shell, bundlePath, name)
    );

    if (failed(installResult)) {
        await vscode.window.showErrorMessage(`Duffle install failed: ${installResult.error[0]}`);
    } else {
        await vscode.commands.executeCommand("duffle.refreshBundleExplorer");
        await vscode.window.showInformationMessage(`Duffle install complete for ${bundlePath}`);
    }
}

function bundleSelection(bundleFile: vscode.Uri): BundleSelection {
    const bundleDir = path.dirname(path.dirname(bundleFile.fsPath));
    return {
        label: path.basename(bundleDir),
        path: bundleDir
    };
}

function bundleStatus(bundle: BundleRef) {
    duffle.showStatus(bundle.bundleName);
}

async function bundleUpgrade(bundle: BundleRef): Promise<void> {
    const upgradeResult = await longRunning(`Duffle upgrading ${bundle.bundleName}`,
        () => duffle.upgrade(shell.shell, bundle.bundleName)
    );

    if (failed(upgradeResult)) {
        await vscode.window.showErrorMessage(`Duffle upgrade failed: ${upgradeResult.error[0]}`);
    } else {
        await vscode.window.showInformationMessage(`Duffle upgrade complete for ${bundle.bundleName}`);
    }
}
