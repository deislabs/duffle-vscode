import * as vscode from 'vscode';

import { BundleSelection, localBundleSelection, promptLocalBundle } from '../utils/bundleselection';
import { showDuffleResult, refreshRepoExplorer, longRunning } from '../utils/host';
import { succeeded, Errorable, map, failed } from '../utils/errorable';
import { cantHappen } from '../utils/never';
import * as duffle from '../duffle/duffle';
import * as shell from '../utils/shell';
import { LocalBundleRef, LocalBundle } from '../duffle/duffle.objectmodel';

export async function push(target?: any): Promise<void> {
    if (!target) {
        return await pushPrompted();
    }
    if (target.bundleLocation === 'local') {
        return await pushLocalBundle((target as LocalBundleRef).bundle);
    }
    await vscode.window.showErrorMessage("Internal error: unexpected command target");
}

async function pushPrompted(): Promise<void> {
    const bundlePick = await promptLocalBundle("Select the bundle to push");

    if (!bundlePick) {
        return;
    }

    return await pushCore(bundlePick);
}

async function pushLocalBundle(bundle: LocalBundle): Promise<void> {
    return await pushCore(localBundleSelection(bundle));
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
        return { succeeded: false, error: ['Internal error - cannot push filesystem bundles - import it first'] };
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
