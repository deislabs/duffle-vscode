import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';

import * as config from '../config/config';
import { Errorable } from '../utils/errorable';
import * as shell from '../utils/shell';
import { RepoBundle } from './duffle.objectmodel';

let sharedTerminalObj: vscode.Terminal | null = null;
const logChannel = vscode.window.createOutputChannel("Duffle");

function sharedTerminal(): vscode.Terminal {
    if (sharedTerminalObj) {
        return sharedTerminalObj;
    }

    const terminalOptions = {
        name: 'Duffle',
        env: shell.shellEnvironment(process.env)
    };
    sharedTerminalObj = vscode.window.createTerminal(terminalOptions);
    const disposable = vscode.window.onDidCloseTerminal((t) => {
        if (t === sharedTerminalObj) {
            sharedTerminalObj = null;
            disposable.dispose();
        }
    });
    vscode.workspace.onDidChangeConfiguration((change) => {
        if (config.affectsExtensionConfiguration(change) && sharedTerminalObj) {
            sharedTerminalObj.dispose();
        }
    });

    return sharedTerminalObj;
}

async function invokeObj<T>(sh: shell.Shell, command: string, args: string, opts: shell.ExecOpts, fn: (stdout: string) => T): Promise<Errorable<T>> {
    const bin = config.dufflePath() || 'duffle';
    const cmd = `${bin} ${command} ${args}`;
    logChannel.appendLine(`$ ${cmd}`);
    return await sh.execObj<T>(
        cmd,
        `duffle ${command}`,
        opts,
        andLog(fn)
    );
}

function invokeInTerminal(command: string): void {
    const fullCommand = `duffle ${command}`;
    sharedTerminal().sendText(fullCommand);
    sharedTerminal().show();
}

function andLog<T>(fn: (s: string) => T): (s: string) => T {
    return (s: string) => {
        logChannel.appendLine(s);
        return fn(s);
    };
}

export function list(sh: shell.Shell): Promise<Errorable<string[]>> {
    function parse(stdout: string): string[] {
        return stdout.split('\n')
            .map((l) => l.trim())
            .filter((l) => l.length > 0);
    }
    return invokeObj(sh, 'list', '', {}, parse);
}

export function listRepos(sh: shell.Shell): Promise<Errorable<string[]>> {
    function parse(stdout: string): string[] {
        return stdout.split('\n')
            .map((l) => l.trim())
            .filter((l) => l.length > 0);
    }
    return invokeObj(sh, 'repo list', '', {}, parse);
}

export function search(sh: shell.Shell): Promise<Errorable<RepoBundle[]>> {
    function parse(stdout: string): RepoBundle[] {
        const lines = stdout.split('\n')
            .map((l) => l.trim())
            .filter((l) => l.length > 0);
        return fromHeaderedTable<RepoBundle>(lines);
    }
    return invokeObj(sh, 'search', '', {}, parse);
}

export async function upgrade(sh: shell.Shell, bundleName: string): Promise<Errorable<null>> {
    return await invokeObj(sh, 'upgrade', bundleName, {}, (s) => null);
}

export function showStatus(bundleName: string): void {
    invokeInTerminal(`status ${bundleName}`);
}

export async function build(sh: shell.Shell, folderPath: string): Promise<Errorable<null>> {
    const buildFile = path.join(folderPath, 'duffle.toml');
    if (!fs.existsSync(buildFile)) {
        return { succeeded: false, error: [`${folderPath} does not contain a duffle.toml file`] };
    }
    // duffle build works *only* from the folder containing duffle.toml
    return await invokeObj(sh, 'build', '.', { cwd: folderPath }, (s) => null);
}

export async function installFile(sh: shell.Shell, bundleFilePath: string, name: string): Promise<Errorable<null>> {
    return await invokeObj(sh, 'install', `${name} -f "${bundleFilePath}"`, {}, (s) => null);
}

function fromHeaderedTable<T>(lines: string[]): T[] {
    if (lines.length === 0) {
        return [];
    }
    const headerLine = lines[0].split(/\s+/);
    const valueLines = lines.slice(1).map((l) => l.split(/\s+/));

    const values = valueLines.map((l) => asObj<T>(headerLine, l));
    return values;
}

function asObj<T>(labels: string[], columns: string[]): T {
    const o: any = {};
    for (const index in columns) {
        // TODO: improve flexibility and safety
        o[labels[index].toLowerCase()] = columns[index];
    }
    return o;
}
