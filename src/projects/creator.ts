import { Errorable } from "../utils/errorable";

export interface ProjectCreator {
    create(rootPath: string): Promise<Errorable<null>>;
}
