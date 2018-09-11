import * as sysfs from 'fs';
import { promisify } from 'util';

export const fs = {
    exists: promisify(sysfs.exists),
    mkdir: promisify(sysfs.mkdir),
    writeFile: promisify(sysfs.writeFile),
};
