'use strict';

import * as vscode from 'vscode';

import { InstallationRef, CredentialSetRef, RepoBundleRef } from './duffle/duffle.objectmodel';
import { InstallationExplorer } from './explorer/installation/installation-explorer';
import { BundleExplorer } from './explorer/bundle/bundle-explorer';
import { CredentialExplorer } from './explorer/credential/credential-explorer';
import * as shell from './utils/shell';
import * as duffle from './duffle/duffle';
import { selectWorkspaceFolder, longRunning, showDuffleResult, refreshInstallationExplorer, refreshCredentialExplorer, confirm, refreshBundleExplorer } from './utils/host';
import { push } from './commands/push';
import { install } from './commands/install';
import { lintTo } from './lint/linters';
import { succeeded, failed } from './utils/errorable';
import { selectProjectCreator } from './projects/ui';
import { exposeParameter } from './commands/exposeparameter';
import { generateCredentials } from './commands/generatecredentials';
import { repoBundleRef } from './utils/bundleselection';
import { promptForCredentials } from './utils/credentials';
import { Reporter } from './utils/telemetry';
import * as telemetry from './utils/telemetry-helper';

const duffleDiagnostics = vscode.languages.createDiagnosticCollection("Duffle");

export function activate(context: vscode.ExtensionContext) {
    const installationExplorer = new InstallationExplorer(shell.shell);
    const bundleExplorer = new BundleExplorer(shell.shell);
    const credentialExplorer = new CredentialExplorer(shell.shell);

    const subscriptions = [
        registerCommand('duffle.refreshInstallationExplorer', () => installationExplorer.refresh()),
        registerCommand('duffle.installationStatus', (node) => installationStatus(node)),
        registerCommand('duffle.installationUpgrade', (node) => installationUpgrade(node)),
        registerCommand('duffle.installationUninstall', (node) => installationUninstall(node)),
        registerCommand('duffle.createProject', createProject),
        registerCommand('duffle.build', build),
        registerCommand('duffle.pull', pull),
        registerCommand('duffle.push', push),
        registerCommand('duffle.install', install),
        registerCommand('duffle.generateCredentials', generateCredentials),
        registerCommand('duffle.refreshBundleExplorer', () => bundleExplorer.refresh()),
        registerCommand('duffle.refreshRepoExplorer', () => { /* (TODO: REPO: restore when repos land for real) repoExplorer.refresh() */ }),
        registerCommand('duffle.refreshCredentialExplorer', () => credentialExplorer.refresh()),
        registerCommand('duffle.credentialsetAdd', credentialSetAdd),
        registerCommand('duffle.credentialsetDelete', (node) => credentialsetDelete(node)),
        registerCommand('duffle.exposeParameter', exposeParameter),
        vscode.window.registerTreeDataProvider("duffle.installationExplorer", installationExplorer),
        vscode.window.registerTreeDataProvider("duffle.bundleExplorer", bundleExplorer),
        vscode.window.registerTreeDataProvider("duffle.credentialExplorer", credentialExplorer),
        // vscode.languages.registerCompletionItemProvider({ language: buildDefinition.oldLanguageId, pattern: `**/${buildDefinition.oldDefinitionFile}`, scheme: 'file' }, duffleBuildDefinitionCompletionProvider)  // TODO: rewrite for JSON
        registerTelemetry(context),
    ];

    initDiagnostics();

    context.subscriptions.push(...subscriptions);
}

export function deactivate() {
}

function registerCommand(command: string, callback: (...args: any[]) => any): vscode.Disposable {
    const wrappedCallback = telemetry.telemetrise(command, callback);
    return vscode.commands.registerCommand(command, wrappedCallback);
}

function registerTelemetry(context: vscode.ExtensionContext): vscode.Disposable {
    return new Reporter(context);
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

    if (succeeded(buildResult)) {
        refreshBundleExplorer();
    }

    await showDuffleResult('build', folderPath, buildResult);
}

async function withClaimCredentials(bundle: InstallationRef, description: string, action: (credentialSet: string | undefined) => Promise<void>): Promise<void> {
    const claim = await duffle.getClaim(shell.shell, bundle.installationName);
    if (failed(claim)) {
        await vscode.window.showErrorMessage(`Error getting claim information: ${claim.error[0]}`);
        return;
    }

    const credentialSet = await promptForCredentials(claim.result.bundle, shell.shell, `Credential set to ${description} with`);
    if (credentialSet.cancelled) {
        return;
    }

    return await action(credentialSet.value);
}

async function installationStatus(bundle: InstallationRef): Promise<void> {
    await withClaimCredentials(bundle, 'query bundle status', async (credentialSet) => {
        duffle.showStatus(bundle.installationName, credentialSet);
    });
}

async function installationUpgrade(bundle: InstallationRef): Promise<void> {
    await withClaimCredentials(bundle, 'upgrade bundle', async (credentialSet) => {
        const upgradeResult = await longRunning(`Duffle upgrading ${bundle.installationName}`,
            () => duffle.upgrade(shell.shell, bundle.installationName, credentialSet)
        );

        await showDuffleResult('upgrade', bundle.installationName, upgradeResult);
    });
}

async function installationUninstall(bundle: InstallationRef): Promise<void> {
    await withClaimCredentials(bundle, 'uninstall bundle', async (credentialSet) => {
        const uninstallResult = await longRunning(`Duffle uninstalling ${bundle.installationName}`,
            () => duffle.uninstall(shell.shell, bundle.installationName, credentialSet)
        );

        if (succeeded(uninstallResult)) {
            await refreshInstallationExplorer();
        }

        await showDuffleResult('uninstall', bundle.installationName, uninstallResult);
    });
}

async function pull(repoBundle: RepoBundleRef): Promise<void> {
    const bundleName = repoBundleRef(repoBundle.bundle);
    const pullResult = await longRunning(`Duffle pulling ${bundleName}`, () =>
        duffle.pull(shell.shell, bundleName)
    );

    if (succeeded(pullResult)) {
        await refreshBundleExplorer();
    }

    await showDuffleResult('pull', bundleName, pullResult);
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
