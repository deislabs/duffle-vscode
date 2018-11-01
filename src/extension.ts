'use strict';

import * as vscode from 'vscode';

import { InstallationRef, CredentialSetRef } from './duffle/duffle.objectmodel';
import { InstallationExplorer } from './explorer/installation/installation-explorer';
import { RepoExplorer } from './explorer/repo/repo-explorer';
import { CredentialExplorer } from './explorer/credential/credential-explorer';
import * as shell from './utils/shell';
import * as duffle from './duffle/duffle';
import { DuffleTOMLCompletionProvider } from './completion/duffle.toml.completions';
import { selectWorkspaceFolder, longRunning, showDuffleResult, refreshInstallationExplorer, refreshCredentialExplorer, confirm } from './utils/host';
import { push } from './commands/push';
import { install } from './commands/install';
import { lintTo } from './lint/linters';
import { succeeded } from './utils/errorable';
import { selectProjectCreator } from './projects/ui';
import { exposeParameter } from './commands/exposeparameter';
import { generateCredentials } from './commands/generatecredentials';

const duffleDiagnostics = vscode.languages.createDiagnosticCollection("Duffle");

export function activate(context: vscode.ExtensionContext) {
    const installationExplorer = new InstallationExplorer(shell.shell);
    const repoExplorer = new RepoExplorer(shell.shell);
    const credentialExplorer = new CredentialExplorer(shell.shell);
    const duffleTOMLCompletionProvider = new DuffleTOMLCompletionProvider();

    const subscriptions = [
        vscode.commands.registerCommand('duffle.refreshInstallationExplorer', () => installationExplorer.refresh()),
        vscode.commands.registerCommand('duffle.installationStatus', (node) => installationStatus(node)),
        vscode.commands.registerCommand('duffle.installationUpgrade', (node) => installationUpgrade(node)),
        vscode.commands.registerCommand('duffle.installationUninstall', (node) => installationUninstall(node)),
        vscode.commands.registerCommand('duffle.createProject', createProject),
        vscode.commands.registerCommand('duffle.build', build),
        vscode.commands.registerCommand('duffle.push', push),
        vscode.commands.registerCommand('duffle.install', install),
        vscode.commands.registerCommand('duffle.generateCredentials', generateCredentials),
        vscode.commands.registerCommand('duffle.refreshRepoExplorer', () => repoExplorer.refresh()),
        vscode.commands.registerCommand('duffle.refreshCredentialExplorer', () => credentialExplorer.refresh()),
        vscode.commands.registerCommand('duffle.credentialsetAdd', credentialSetAdd),
        vscode.commands.registerCommand('duffle.credentialsetDelete', (node) => credentialsetDelete(node)),
        vscode.commands.registerCommand('duffle.exposeParameter', exposeParameter),
        vscode.window.registerTreeDataProvider("duffle.installationExplorer", installationExplorer),
        vscode.window.registerTreeDataProvider("duffle.repoExplorer", repoExplorer),
        vscode.window.registerTreeDataProvider("duffle.credentialExplorer", credentialExplorer),
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

    const creator = await selectProjectCreator("Choose template to create project from");
    if (!creator) {
        return;
    }

    const rootPath = folder.uri.fsPath;
    const createResult = await creator.create(rootPath);

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

function installationStatus(bundle: InstallationRef) {
    duffle.showStatus(bundle.installationName);
}

async function installationUpgrade(bundle: InstallationRef): Promise<void> {
    const upgradeResult = await longRunning(`Duffle upgrading ${bundle.installationName}`,
        () => duffle.upgrade(shell.shell, bundle.installationName)
    );

    await showDuffleResult('upgrade', bundle.installationName, upgradeResult);
}

async function installationUninstall(bundle: InstallationRef): Promise<void> {
    const uninstallResult = await longRunning(`Duffle uninstalling ${bundle.installationName}`,
        () => duffle.uninstall(shell.shell, bundle.installationName)
    );

    if (succeeded(uninstallResult)) {
        await refreshInstallationExplorer();
    }

    await showDuffleResult('uninstall', bundle.installationName, uninstallResult);
}

async function credentialsetDelete(credentialSet: CredentialSetRef): Promise<void> {
    const confirmed = await confirm(`Deleting ${credentialSet.credentialSetName} cannot be undone.`, 'Delete');
    if (!confirmed) {
        return;
    }

    const deleteResult = await longRunning(`Duffle deleting credential set ${credentialSet.credentialSetName}`,
        () => duffle.deleteCredentialSet(shell.shell, credentialSet.credentialSetName)
    );

    if (succeeded(deleteResult)) {
        await refreshCredentialExplorer();
    }

    await showDuffleResult('credential remove', credentialSet.credentialSetName, deleteResult);
}

async function credentialSetAdd(): Promise<void> {
    const uris = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: true,
        filters: {
            'YAML files': ['yaml', 'yml'],
            'All files': ['*']
        },
        openLabel: 'Add Credential Set'
    });

    if (!uris || uris.length === 0) {
        return;
    }

    if (!uris.every((uri) => uri.scheme === 'file')) {
        await vscode.window.showErrorMessage('Credential sets to be added must be on the filesystem');
        return;
    }

    const files = uris.map((uri) => uri.fsPath);

    const description = files.length === 1 ?
        files[0] :
        `${files[0]} and ${files.length - 1} other(s)`;

    const addResult = await longRunning(`Duffle adding credential set ${description}`,
        () => duffle.addCredentialSets(shell.shell, files)
    );

    if (succeeded(addResult)) {
        await refreshCredentialExplorer();
    }

    await showDuffleResult('credential add', description, addResult);
}
