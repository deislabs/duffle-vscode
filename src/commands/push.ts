import * as vscode from 'vscode';

import { promptBundle, fileBundleSelection, BundleSelection, bundleFilePath } from '../utils/bundleselection';
import { showDuffleResult, refreshRepoExplorer, longRunning } from '../utils/host';
import { succeeded, Errorable, map, failed } from '../utils/errorable';
import { cantHappen } from '../utils/never';
import * as duffle from '../duffle/duffle';
import * as shell from '../utils/shell';

export async function push(target?: any): Promise<void> {
    if (!target) {
        return await pushPrompted();
    }
    if (target.scheme) {
        return await pushFile(target as vscode.Uri);
    }
    await vscode.window.showErrorMessage("Internal error: unexpected command target");
}

async function pushPrompted(): Promise<void> {
    const bundlePick = await promptBundle("Select the bundle to push");

    if (!bundlePick) {
        return;
    }

    return await pushCore(bundlePick);
}

async function pushFile(file: vscode.Uri): Promise<void> {
    if (file.scheme !== 'file') {
        vscode.window.showErrorMessage("This command requires a filesystem bundle");
        return;
    }
    return await pushCore(fileBundleSelection(file));
}

async function pushCore(bundlePick: BundleSelection): Promise<void> {
    const name = bundlePick.kind === 'file' ? await promptRepo(shell.shell, `Push bundle in ${bundlePick.label} to...`) : 'UNUSED';
    if (!name) {
        return;
    }

    const pushResult = await pushTo(bundlePick, name);

    if (succeeded(pushResult)) {
        await refreshRepoExplorer();
    }

    await showDuffleResult('push', (bundleId) => bundleId, pushResult);
}

async function pushTo(bundlePick: BundleSelection, repo: string): Promise<Errorable<string>> {
    if (bundlePick.kind === 'file') {
        const bundlePath = bundleFilePath(bundlePick);
        const pushResult = await longRunning(`Duffle push ${bundlePath}`,
            () => duffle.pushFile(shell.shell, bundlePath, repo)
        );
        return map(pushResult, (_) => bundlePath);
    } else if (bundlePick.kind === 'repo') {
        return { succeeded: false, error: ['Internal error - cannot push bundles already in repos'] };
    } else if (bundlePick.kind === 'local') {
        const pushResult = await longRunning(`Duffle push ${bundlePick.bundle}`,
            () => duffle.pushBundle(shell.shell, bundlePick.bundle)
        );
        return map(pushResult, (_) => bundlePick.bundle);
    }
    return cantHappen(bundlePick);
}

async function promptRepo(shell: shell.Shell, prompt: string): Promise<string | undefined> {
    const repos = await duffle.listRepos(shell);
    if (failed(repos)) {
        vscode.window.showErrorMessage("Unable to list repos to which you can push");
        return undefined;
    }
    if (!repos.result || !repos.result.length) {
        vscode.window.showErrorMessage("You don't have any repos to which you can push");
        return undefined;
    }
    const repo = await vscode.window.showQuickPick(repos.result, { placeHolder: prompt });
    return repo;
}
