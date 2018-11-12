import * as request from 'request-promise-native';

import { RepoIndex } from '../duffle/duffle.objectmodel';
import { Errorable } from '..//utils/errorable';

export async function readRepoIndex(repo: string): Promise<Errorable<RepoIndex>> {
    try {
        const url = `https://${repo}/index.json`;
        const json = await request.get(url);
        const index = JSON.parse(json);
        return { succeeded: true, result: index };
    } catch (e) {
        return { succeeded: false, error: [`${e}`] };
    }
}
