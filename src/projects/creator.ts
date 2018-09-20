import { Errorable } from "../utils/errorable";

export interface ProjectCreator {
    readonly name: string;
    create(rootPath: string): Promise<Errorable<string | undefined>>;  // Success result is the absolute path of a file to open for the user to work on
}
