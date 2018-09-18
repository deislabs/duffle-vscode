'use strict';

import * as vscode from 'vscode';

import { BundleRef } from './duffle/duffle.objectmodel';
import { BundleExplorer } from './explorer/bundle/bundle-explorer';
import { RepoExplorer } from './explorer/repo/repo-explorer';
import * as shell from './utils/shell';
import * as duffle from './duffle/duffle';
import { DuffleTOMLCompletionProvider } from './completion/duffle.toml.completions';
import { selectWorkspaceFolder, longRunning, showDuffleResult, refreshBundleExplorer } from './utils/host';
import { publish } from './commands/publish';
import { install } from './commands/install';
import { lintTo } from './lint/linters';
import { succeeded } from './utils/errorable';
import { basicProjectCreator } from './projects/basic';
import { exposeParameter } from './commands/exposeparameter';

const duffleDiagnostics = vscode.languages.createDiagnosticCollection("Duffle");

export function activate(context: vscode.ExtensionContext) {
    const bundleExplorer = new BundleExplorer(shell.shell);
    const repoExplorer = new RepoExplorer(shell.shell);
    const duffleTOMLCompletionProvider = new DuffleTOMLCompletionProvider();

    const subscriptions = [
        vscode.commands.registerCommand('duffle.refreshBundleExplorer', () => bundleExplorer.refresh()),
        vscode.commands.registerCommand('duffle.bundleStatus', (node) => bundleStatus(node)),
        vscode.commands.registerCommand('duffle.bundleUpgrade', (node) => bundleUpgrade(node)),
        vscode.commands.registerCommand('duffle.bundleUninstall', (node) => bundleUninstall(node)),
        vscode.commands.registerCommand('duffle.createProject', createProject),
        vscode.commands.registerCommand('duffle.build', build),
        vscode.commands.registerCommand('duffle.publish', publish),
        vscode.commands.registerCommand('duffle.install', install),
        vscode.commands.registerCommand('duffle.refreshRepoExplorer', () => repoExplorer.refresh()),
        vscode.commands.registerCommand('duffle.exposeParameter', exposeParameter),
        vscode.window.registerTreeDataProvider("duffle.bundleExplorer", bundleExplorer),
        vscode.window.registerTreeDataProvider("duffle.repoExplorer", repoExplorer),
        vscode.languages.registerCompletionItemProvider({ language: 'toml', pattern: '**/duffle.toml', scheme: 'file' }, duffleTOMLCompletionProvider)
    ];

    initDiagnostics();

    context.subscriptions.push(...subscriptions);
}

export function deactivate() {
}

function initDiagnostics() {
    const lint = lintTo(duffleDiagnostics);
    vscode.workspace.onDidOpenTextDocument(lint);
    vscode.workspace.onDidChangeTextDocument((e) => lint(e.document));  // TODO: we could use the change hint
    vscode.workspace.onDidSaveTextDocument(lint);
    vscode.workspace.onDidCloseTextDocument((d) => duffleDiagnostics.delete(d.uri));
    vscode.workspace.textDocuments.forEach(lint);
}

async function createProject(): Promise<void> {
    const folder = await selectWorkspaceFolder("Choose folder to create project in");
    if (!folder) {
        return;
    }

    const rootPath = folder.uri.fsPath;
    const createResult = await basicProjectCreator.create(rootPath);

    if (succeeded(createResult)) {
        if (createResult.result) {
            const fileToOpen = vscode.Uri.file(createResult.result);
            const document = await vscode.workspace.openTextDocument(fileToOpen);
            await vscode.window.showTextDocument(document);
        }
    } else {
        await vscode.window.showErrorMessage(`Unable to scaffold new Duffle project in ${rootPath}: ${createResult.error[0]}`);
    }
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

function bundleStatus(bundle: BundleRef) {
    duffle.showStatus(bundle.bundleName);
}

async function bundleUpgrade(bundle: BundleRef): Promise<void> {
    const upgradeResult = await longRunning(`Duffle upgrading ${bundle.bundleName}`,
        () => duffle.upgrade(shell.shell, bundle.bundleName)
    );

    await showDuffleResult('upgrade', bundle.bundleName, upgradeResult);
}

async function bundleUninstall(bundle: BundleRef): Promise<void> {
    const uninstallResult = await longRunning(`Duffle uninstalling ${bundle.bundleName}`,
        () => duffle.uninstall(shell.shell, bundle.bundleName)
    );

    if (succeeded(uninstallResult)) {
        await refreshBundleExplorer();
    }

    await showDuffleResult('uninstall', bundle.bundleName, uninstallResult);
}
