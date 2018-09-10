import * as fs from 'fs';
import * as path from 'path';

export function subdirectoriesFromFile(filePath: string): string[] {
    const fileDir = path.dirname(filePath);
    const entries = fs.readdirSync(fileDir);
    return entries.filter((d) => fs.statSync(path.join(fileDir, d)).isDirectory());
}
