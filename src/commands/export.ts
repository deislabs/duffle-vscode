import * as vscode from 'vscode';

import { longRunning, showDuffleResult } from '../utils/host';
import * as duffle from '../duffle/duffle';
import { LocalBundleRef, LocalBundle } from '../duffle/duffle.objectmodel';
import { map, Errorable } from '../utils/errorable';
import * as shell from '../utils/shell';
import { cantHappen } from '../utils/never';
import { promptBundleFile, BundleSelection, fileBundleSelection, bundleFilePath, localBundleSelection } from '../utils/bundleselection';

export async function exportBundle(target?: any): Promise<void> {
    if (!target) {
        return await exportPrompted();
    }
    if (target.scheme) {
        return await exportFile(target as vscode.Uri);
    }
    if (target.bundleLocation === 'local') {
        return await exportLocalBundle((target as LocalBundleRef).bundle);
    }
    await vscode.window.showErrorMessage("Internal error: unexpected command target");
}

async function exportPrompted(): Promise<void> {
    const bundlePick = await promptBundleFile("Select the bundle to install");

    if (!bundlePick) {
        return;
    }

    return await exportCore(bundlePick);
}

async function exportFile(file: vscode.Uri): Promise<void> {
    if (file.scheme !== 'file') {
        vscode.window.showErrorMessage("This command requires a filesystem bundle");
        return;
    }
    return await exportCore(fileBundleSelection(file));
}

async function exportLocalBundle(bundle: LocalBundle): Promise<void> {
    return await exportCore(localBundleSelection(bundle));
}

async function exportCore(bundlePick: BundleSelection): Promise<void> {
    const bundleKind = await promptExportKind();
    if (!bundleKind) {
        return;
    }

    const outputFile = await vscode.window.showSaveDialog({
        saveLabel: "Export",
        filters: {
            "Bundle Export Files": ["tgz"]
        }
    });

    if (!outputFile || outputFile.scheme !== "file") {
        return;
    }

    const exportResult = await exportBundleTo(bundlePick, outputFile.fsPath, bundleKind);

    await showDuffleResult('export', (bundleId) => bundleId, exportResult);
}

enum ExportKind {
    Full = 1,
    ManifestOnly
}

async function promptExportKind(): Promise<ExportKind | undefined> {
    const kindOptions = [
        { label: 'Full bundle (include all images in installer)', resultValue: ExportKind.Full },
        { label: 'Manifest only (installer will pull images from registry)', resultValue: ExportKind.ManifestOnly },
    ];
    const pick = await vscode.window.showQuickPick(kindOptions);
    if (!pick) {
        return undefined;
    }
    return pick.resultValue;
}

async function exportBundleTo(bundlePick: BundleSelection, outputFile: string, exportKind: ExportKind): Promise<Errorable<string>> {
    const isFull = (exportKind === ExportKind.Full);
    if (bundlePick.kind === 'file') {
        const bundlePath = bundleFilePath(bundlePick);
        const exportResult = await longRunning("Duffle exporting required images...", () =>
            duffle.exportFile(shell.shell, bundlePath, outputFile, isFull)
        );
        return map(exportResult, (_) => bundlePath);
    }
    if (bundlePick.kind === 'local' || bundlePick.kind === 'repo') {
        const exportResult = await longRunning("Duffle exporting required images...", () =>
            duffle.exportBundle(shell.shell, bundlePick.bundle, outputFile, isFull)
        );
        return map(exportResult, (_) => bundlePick.bundle);
    }
    return cantHappen(bundlePick);
}
