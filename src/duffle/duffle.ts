import * as config from '../config/config';
import { Errorable } from '../utils/errorable';
import * as shell from '../utils/shell';

async function invokeObj<T>(sh: shell.Shell, command: string, args: string, fn: (stdout: string) => T): Promise<Errorable<T>> {
    const bin = config.dufflePath() || 'duffle';
    return await sh.execObj<T>(
        `${bin} ${command} ${args}`,
        `duffle ${command}`,
        fn
    );
}

export async function list(sh: shell.Shell): Promise<Errorable<string[]>> {
    function parse(stdout: string): string[] {
        return stdout.split('\n')
            .map((l) => l.trim())
            .filter((l) => l.length > 0);
    }
    return invokeObj(sh, 'list', '', parse);
}

export async function listRepos(sh: shell.Shell): Promise<Errorable<string[]>> {
    function parse(stdout: string): string[] {
        return stdout.split('\n')
            .map((l) => l.trim())
            .filter((l) => l.length > 0);
    }
    return invokeObj(sh, 'repo list', '', parse);
}