import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

import { promptBundle, fileBundleSelection, BundleSelection } from '../utils/bundleselection';
import { showDuffleResult, refreshRepoExplorer, longRunning } from '../utils/host';
import { succeeded, Errorable, map, failed } from '../utils/errorable';
import { cantHappen } from '../utils/never';
import * as duffle from '../duffle/duffle';
import * as shell from '../utils/shell';
import { promisify } from 'util';

export async function publish(target?: any): Promise<void> {
    if (!target) {
        return await publishPrompted();
    }
    if (target.scheme) {
        return await publishFile(target as vscode.Uri);
    }
    await vscode.window.showErrorMessage("Internal error: unexpected command target");
}

async function publishPrompted(): Promise<void> {
    const bundlePick = await promptBundle("Select the bundle to publish");

    if (!bundlePick) {
        return;
    }

    return await publishCore(bundlePick);
}

async function publishFile(file: vscode.Uri): Promise<void> {
    if (file.scheme !== 'file') {
        vscode.window.showErrorMessage("This command requires a filesystem bundle");
        return;
    }
    return await publishCore(fileBundleSelection(file));
}

async function publishCore(bundlePick: BundleSelection): Promise<void> {
    const name = await promptRepo(shell.shell, `Publish bundle in ${bundlePick.label} to...`);
    if (!name) {
        return;
    }

    const publishResult = await publishTo(bundlePick, name);

    if (succeeded(publishResult)) {
        await refreshRepoExplorer();
    }

    await showDuffleResult('publish', (bundleId) => bundleId, publishResult);
}

async function publishTo(bundlePick: BundleSelection, repo: string): Promise<Errorable<string>> {
    if (bundlePick.kind === 'folder') {
        const folderPath = bundlePick.path;
        const bundlePath = path.join(folderPath, "cnab", "bundle.json");
        const repoBundlesDir = path.join(duffle.home(shell.shell), "repositories", repo, "bundles");
        const repoPath = path.join(repoBundlesDir, `${bundlePick.label}.json`);
        const publishResult = await longRunning(`Duffle publishing ${bundlePath}`,
            () => publishByCopying(bundlePath, repoPath)
        );
        return map(publishResult, (_) => bundlePath);
    } else if (bundlePick.kind === 'repo') {
        return { succeeded: false, error: ['Internal error - cannot publish bundles already in repos'] };
    }
    return cantHappen(bundlePick);
}

async function publishByCopying(sourcePath: string, repoPath: string): Promise<Errorable<null>> {
    try {
        await promisify(fs.copyFile)(sourcePath, repoPath);  // TODO: replace with promisified fs layer once merged
        return { succeeded: true, result: null };
    } catch (e) {
        return { succeeded: false, error: [`Error copying ${sourcePath} to ${repoPath}: ${e}`] };
    }
}

async function promptRepo(shell: shell.Shell, prompt: string): Promise<string | undefined> {
    const repos = await duffle.listRepos(shell);
    if (failed(repos)) {
        vscode.window.showErrorMessage("Unable to list repos to which you can publish");
        return undefined;
    }
    if (!repos.result || !repos.result.length) {
        vscode.window.showErrorMessage("You don't have any repos to which you can publish");
        return undefined;
    }
    const repo = await vscode.window.showQuickPick(repos.result, { placeHolder: prompt });
    return repo;
}
