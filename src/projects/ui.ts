import * as vscode from 'vscode';

import { ProjectCreator } from './creator';
import { basicProjectCreator } from './basic';
import { armProjectCreator } from './arm';
import { terraformProjectCreator } from './terraform';

const creators = [
    basicProjectCreator,
    armProjectCreator,
    terraformProjectCreator
];

export async function selectProjectCreator(prompt: string): Promise<ProjectCreator | undefined> {
    const creatorPicks = creators.map(makePick);
    const pick = await vscode.window.showQuickPick(creatorPicks, { placeHolder: prompt });
    if (!pick) {
        return undefined;
    }
    return pick.creator;
}

interface ProjectCreatorQuickPick extends vscode.QuickPickItem {
    readonly creator: ProjectCreator;
}

function makePick(creator: ProjectCreator): ProjectCreatorQuickPick {
    return {
        label: creator.name,
        creator: creator
    };
}
